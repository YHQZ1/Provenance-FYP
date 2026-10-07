import assert from "node:assert/strict";
import test from "node:test";

import { createCache } from "../src/lib/cache.js";

const memoryClient = () => {
  const store = new Map();
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    set: async (key, value, mode, ttl) => {
      store.set(key, value);
      store.set(`${key}#ttl`, ttl);
      return "OK";
    },
    del: async (...keys) => keys.forEach((key) => store.delete(key)),
    incr: async (key) => {
      const next = Number(store.get(key) || 0) + 1;
      store.set(key, String(next));
      return next;
    },
  };
};

test("wrap computes once, then serves the cached value", async () => {
  const client = memoryClient();
  const cache = createCache({ client });
  let calls = 0;
  const compute = async () => ({ total: ++calls });

  assert.deepEqual(await cache.wrap("k", 60, compute), { total: 1 });
  assert.deepEqual(await cache.wrap("k", 60, compute), { total: 1 });
  assert.equal(calls, 1);
  assert.equal(client.store.get("k#ttl"), 60);
});

test("values the caller rejects are returned but not stored", async () => {
  const cache = createCache({ client: memoryClient() });
  let calls = 0;
  const failed = async () => ({ material_code: null, n: ++calls });
  const keepOnlyClassified = (value) => Boolean(value.material_code);

  await cache.wrap("line", 60, failed, { shouldCache: keepOnlyClassified });
  await cache.wrap("line", 60, failed, { shouldCache: keepOnlyClassified });
  assert.equal(calls, 2);
});

test("a missing or broken Redis falls through to the source without throwing", async () => {
  const warnings = [];
  const broken = {
    get: async () => {
      throw new Error("connection refused");
    },
    set: async () => {
      throw new Error("connection refused");
    },
  };
  for (const client of [null, () => null, broken]) {
    const cache = createCache({ client, log: (message) => warnings.push(message) });
    assert.equal(await cache.wrap("k", 60, async () => "fresh"), "fresh");
    assert.equal(await cache.get("k"), null);
    assert.equal(await cache.incr("v"), null);
  }
  assert.ok(warnings.some((message) => message.includes("connection refused")));
});

test("a hung Redis call gives up quickly instead of holding the request", async () => {
  const hung = { get: () => new Promise(() => {}) };
  const cache = createCache({ client: hung, log: () => {} });
  const started = Date.now();
  assert.equal(await cache.wrap("k", 60, async () => "fresh"), "fresh");
  assert.ok(Date.now() - started < 1000);
});

test("keys are prefixed and joined", () => {
  const cache = createCache({ client: null, prefix: "prov:" });
  assert.equal(cache.key("ocr", "v1", "abc"), "prov:ocr:v1:abc");
});
