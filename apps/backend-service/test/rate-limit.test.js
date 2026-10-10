import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { createCache } from "../src/lib/cache.js";
import { createRateLimiter } from "../src/lib/rate-limit.js";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL ||= "http://127.0.0.1:9";
process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-key";
process.env.PORT ||= "3000";
process.env.CORS_ORIGIN ||= "http://app.test";

const { createRateLimit, waitText } = await import("../src/middleware/rate-limit.middleware.js");
const { errorHandler } = await import("../src/middleware/error.middleware.js");

const memoryClient = () => {
  const store = new Map();
  const counter = (key) => {
    const next = Number(store.get(key) || 0) + 1;
    store.set(key, String(next));
    return next;
  };
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    multi: () => {
      const steps = [];
      const chain = {
        incr: (key) => (steps.push(() => [null, counter(key)]), chain),
        expire: () => (steps.push(() => [null, 1]), chain),
        exec: async () => steps.map((step) => step()),
      };
      return chain;
    },
  };
};

const clock = (startSeconds) => {
  let current = startSeconds * 1000;
  return {
    now: () => current,
    advance: (seconds) => {
      current += seconds * 1000;
    },
  };
};

const limiterWith = (options = {}) => {
  const time = clock(1_000_000);
  const cache = createCache({
    client: "client" in options ? options.client : memoryClient(),
    log: () => {},
  });
  return { time, cache, limiter: createRateLimiter({ cache, now: time.now, ...options.limiter }) };
};

const rule = { name: "ask", id: "user-1", max: 3, windowSeconds: 60 };

test("requests up to the limit pass and the next one is refused", async () => {
  const { limiter } = limiterWith();
  for (let call = 1; call <= 3; call++) {
    const result = await limiter.hit(rule);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 3 - call);
  }
  const refused = await limiter.hit(rule);
  assert.equal(refused.allowed, false);
  assert.equal(refused.remaining, 0);
  assert.equal(refused.limit, 3);
});

test("the count resets when the window rolls over", async () => {
  const { limiter, time } = limiterWith();
  for (let call = 0; call < 4; call++) await limiter.hit(rule);
  assert.equal((await limiter.hit(rule)).allowed, false);
  time.advance(60);
  const fresh = await limiter.hit(rule);
  assert.equal(fresh.allowed, true);
  assert.equal(fresh.used, 1);
});

test("the reset time counts down to the end of the window", async () => {
  const { limiter, time } = limiterWith();
  const first = await limiter.hit(rule);
  assert.ok(first.resetSeconds >= 1 && first.resetSeconds <= 60);
  time.advance(first.resetSeconds - 1);
  assert.equal((await limiter.hit(rule)).resetSeconds, 1);
});

test("users and limits are counted separately", async () => {
  const { limiter } = limiterWith();
  for (let call = 0; call < 4; call++) await limiter.hit(rule);
  assert.equal((await limiter.hit(rule)).allowed, false);
  assert.equal((await limiter.hit({ ...rule, id: "user-2" })).allowed, true);
  assert.equal((await limiter.hit({ ...rule, name: "upload" })).allowed, true);
});

test("a missing or broken Redis lets requests through", async () => {
  const broken = {
    multi: () => {
      throw new Error("connection refused");
    },
    get: async () => {
      throw new Error("connection refused");
    },
  };
  for (const client of [null, () => null, broken]) {
    const { limiter } = limiterWith({ client });
    for (let call = 0; call < 10; call++) {
      const result = await limiter.hit(rule);
      assert.equal(result.allowed, true);
    }
    assert.equal((await limiter.peek(rule)).exceeded, false);
  }
});

test("a disabled limiter never counts or refuses", async () => {
  const client = memoryClient();
  const { limiter } = limiterWith({ client, limiter: { enabled: false } });
  for (let call = 0; call < 10; call++) {
    assert.equal((await limiter.hit(rule)).allowed, true);
  }
  assert.equal(client.store.size, 0);
});

test("peek reports a lockout only once the limit is reached", async () => {
  const { limiter } = limiterWith();
  assert.equal((await limiter.peek(rule)).exceeded, false);
  await limiter.hit(rule);
  await limiter.hit(rule);
  assert.equal((await limiter.peek(rule)).exceeded, false);
  await limiter.hit(rule);
  assert.equal((await limiter.peek(rule)).exceeded, true);
});

test("wait times read in seconds or minutes", () => {
  assert.equal(waitText(1), "1 second");
  assert.equal(waitText(45), "45 seconds");
  assert.equal(waitText(60), "1 minute");
  assert.equal(waitText(61), "2 minutes");
  assert.equal(waitText(600), "10 minutes");
});

const withApp = async (build, fn) => {
  const { limiter } = limiterWith();
  const rateLimit = createRateLimit({ limiter });
  const app = express();
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    const user = req.headers["x-test-user"];
    if (user) req.user = { id: user };
    next();
  });
  build(app, rateLimit);
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("the refused request gets a 429 with a retry hint and a plain message", async () => {
  await withApp(
    (app, rateLimit) => {
      const guard = rateLimit({
        name: "ask",
        max: 2,
        windowSeconds: 300,
        message: "You've asked a lot.",
      });
      app.post("/ask", guard, (req, res) => res.json({ ok: true }));
    },
    async (base) => {
      const headers = { "x-test-user": "u1" };
      assert.equal((await fetch(`${base}/ask`, { method: "POST", headers })).status, 200);
      assert.equal((await fetch(`${base}/ask`, { method: "POST", headers })).status, 200);

      const refused = await fetch(`${base}/ask`, { method: "POST", headers });
      assert.equal(refused.status, 429);
      const seconds = Number(refused.headers.get("retry-after"));
      assert.ok(seconds >= 1 && seconds <= 300);
      assert.equal(refused.headers.get("ratelimit-remaining"), "0");
      const body = await refused.json();
      assert.equal(body.success, false);
      assert.equal(body.code, "RATE_LIMITED");
      assert.equal(body.details.retry_after_seconds, seconds);
      assert.match(body.message, /^You've asked a lot\. Try again in /);

      const other = await fetch(`${base}/ask`, {
        method: "POST",
        headers: { "x-test-user": "u2" },
      });
      assert.equal(other.status, 200);
    },
  );
});

test("limits by network address count each client separately", async () => {
  await withApp(
    (app, rateLimit) => {
      const guard = rateLimit({
        name: "ip",
        by: "ip",
        max: 1,
        windowSeconds: 60,
        message: "Too many requests.",
      });
      app.get("/open", guard, (req, res) => res.json({ ok: true }));
    },
    async (base) => {
      const from = (address) => fetch(`${base}/open`, { headers: { "x-forwarded-for": address } });
      assert.equal((await from("203.0.113.1")).status, 200);
      assert.equal((await from("203.0.113.1")).status, 429);
      assert.equal((await from("203.0.113.2")).status, 200);
    },
  );
});

test("a rule can skip requests, so reads are not counted as writes", async () => {
  await withApp(
    (app, rateLimit) => {
      const writes = rateLimit({
        name: "writes",
        max: 1,
        windowSeconds: 60,
        message: "Too many changes.",
        skip: (req) => req.method === "GET",
      });
      app.use(writes);
      app.get("/item", (req, res) => res.json({ ok: true }));
      app.post("/item", (req, res) => res.json({ ok: true }));
    },
    async (base) => {
      const headers = { "x-test-user": "u1" };
      for (let read = 0; read < 5; read++) {
        assert.equal((await fetch(`${base}/item`, { headers })).status, 200);
      }
      assert.equal((await fetch(`${base}/item`, { method: "POST", headers })).status, 200);
      assert.equal((await fetch(`${base}/item`, { method: "POST", headers })).status, 429);
    },
  );
});
