import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL ||= "http://127.0.0.1:9";
process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-key";
process.env.PORT ||= "3000";
process.env.CORS_ORIGIN ||= "http://app.test";

const { createLogger } = await import("../src/lib/logger.js");
const { currentContext, runWithContext, setContext } = await import("../src/lib/context.js");
const { registry, timeDownstream } = await import("../src/lib/metrics.js");
const { outboundFetch, outboundHeaders } = await import("../src/lib/outbound.js");
const { observeRequests } = await import("../src/middleware/observability.middleware.js");
const { captureError, initSentry } = await import("../src/lib/sentry.js");
const { createCache } = await import("../src/lib/cache.js");

const collector = (options = {}) => {
  const lines = [];
  const logger = createLogger({
    service: "backend",
    level: "debug",
    format: "json",
    write: (line) => lines.push(line),
    ...options,
  });
  return { lines, logger, entries: () => lines.map((line) => JSON.parse(line)) };
};

test("log lines are JSON with the service, level and message", () => {
  const { logger, entries } = collector();
  logger.info("hello", { lines: 3 });
  const [entry] = entries();
  assert.equal(entry.service, "backend");
  assert.equal(entry.level, "info");
  assert.equal(entry.msg, "hello");
  assert.equal(entry.lines, 3);
  assert.ok(!Number.isNaN(Date.parse(entry.time)));
});

test("request, document and user IDs from the context are on every line", () => {
  const { logger, entries } = collector();
  runWithContext({ requestId: "req-12345678", documentId: "doc-1" }, () => {
    setContext({ userId: "user-1" });
    logger.info("inside");
  });
  logger.info("outside");
  const [inside, outside] = entries();
  assert.equal(inside.request_id, "req-12345678");
  assert.equal(inside.document_id, "doc-1");
  assert.equal(inside.user_id, "user-1");
  assert.equal(outside.request_id, undefined);
});

test("errors are written as a message and a stack", () => {
  const { logger, entries } = collector();
  logger.error("failed", { error: new Error("boom") });
  logger.error("failed", { error: "plain" });
  const [first, second] = entries();
  assert.equal(first.error, "boom");
  assert.match(first.stack, /boom/);
  assert.equal(second.error, "plain");
});

test("lines below the configured level are dropped", () => {
  const { logger, lines } = collector({ level: "warn" });
  logger.debug("a");
  logger.info("b");
  logger.warn("c");
  logger.error("d");
  assert.equal(lines.length, 2);
});

test("pretty output stays on one readable line", () => {
  const { logger, lines } = collector({ format: "pretty" });
  runWithContext({ requestId: "abcdef123456" }, () => logger.info("saved", { lines: 2 }));
  assert.match(lines[0], /^\d\d:\d\d:\d\d INFO {2}\[abcdef12\] saved lines=2$/);
});

test("context nests without leaking into the caller", () => {
  runWithContext({ requestId: "outer" }, () => {
    runWithContext({ documentId: "inner" }, () => {
      assert.equal(currentContext().requestId, "outer");
      assert.equal(currentContext().documentId, "inner");
    });
    assert.equal(currentContext().documentId, undefined);
  });
});

const withApp = async (build, fn) => {
  const app = express();
  app.use(observeRequests);
  build(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("every response carries a request ID, reusing a valid incoming one", async () => {
  await withApp(
    (app) => app.get("/ping", (req, res) => res.json({ ok: true })),
    async (base) => {
      const generated = await fetch(`${base}/ping`);
      assert.match(generated.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);

      const reused = await fetch(`${base}/ping`, { headers: { "x-request-id": "trace-abc12345" } });
      assert.equal(reused.headers.get("x-request-id"), "trace-abc12345");

      const hostile = await fetch(`${base}/ping`, {
        headers: { "x-request-id": "bad id\t\u00e9" },
      });
      assert.match(hostile.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
    },
  );
});

test("requests are timed under their route template and status", async () => {
  await withApp(
    (app) => {
      const router = express.Router();
      router.get("/:id", (req, res) => res.json({ id: req.params.id }));
      app.use("/items", router);
    },
    async (base) => {
      await fetch(`${base}/items/one`);
      await fetch(`${base}/items/two`);
      await fetch(`${base}/missing`);
      const text = await registry.metrics();
      assert.match(
        text,
        /http_request_duration_seconds_count\{method="GET",route="\/items\/:id",status="200"\} 2/,
      );
      assert.match(text, /route="unmatched",status="404"/);
      assert.doesNotMatch(text, /items\/one/);
    },
  );
});

test("downstream calls are timed and carry the request and document IDs", async () => {
  const seen = [];
  const upstream = http.createServer((req, res) => {
    seen.push(req.headers);
    res.statusCode = req.url === "/bad" ? 500 : 200;
    res.end("{}");
  });
  await new Promise((resolve) => upstream.listen(0, resolve));
  const base = `http://127.0.0.1:${upstream.address().port}`;
  try {
    await runWithContext({ requestId: "req-12345678", documentId: "doc-9" }, async () => {
      await outboundFetch("ocr", `${base}/good`);
      await outboundFetch("ocr", `${base}/bad`);
    });
    assert.equal(seen[0]["x-request-id"], "req-12345678");
    assert.equal(seen[0]["x-document-id"], "doc-9");
    const text = await registry.metrics();
    assert.match(text, /downstream_request_duration_seconds_count\{service="ocr",outcome="ok"\} 1/);
    assert.match(
      text,
      /downstream_request_duration_seconds_count\{service="ocr",outcome="error"\} 1/,
    );
  } finally {
    await new Promise((resolve) => upstream.close(resolve));
  }
});

test("timeDownstream records a failure and rethrows it", async () => {
  await assert.rejects(
    timeDownstream("ollama", async () => {
      throw new Error("down");
    }),
    /down/,
  );
  assert.match(
    await registry.metrics(),
    /downstream_request_duration_seconds_count\{service="ollama",outcome="error"\} 1/,
  );
});

test("outbound headers are empty outside a request", () => {
  assert.deepEqual(outboundHeaders({ A: "1" }), { A: "1" });
});

test("cache lookups report hits and misses", async () => {
  const store = new Map();
  const results = [];
  const cache = createCache({
    client: {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => store.set(key, value),
    },
    observe: (result) => results.push(result),
  });
  await cache.wrap("k", 60, async () => "v");
  await cache.wrap("k", 60, async () => "v");
  assert.deepEqual(results, ["miss", "hit"]);
});

test("error reporting does nothing without a DSN", () => {
  assert.equal(initSentry(), false);
  assert.doesNotThrow(() => captureError(new Error("ignored")));
});
