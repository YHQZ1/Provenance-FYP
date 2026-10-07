const OPERATION_TIMEOUT_MS = 300;
const WARN_EVERY_MS = 60_000;

const withDeadline = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("cache timeout")), OPERATION_TIMEOUT_MS),
    ),
  ]);

export const createCache = ({ client, prefix = "prov:", log = console.warn } = {}) => {
  let lastWarning = 0;
  const warn = (operation, error) => {
    if (Date.now() - lastWarning < WARN_EVERY_MS) return;
    lastWarning = Date.now();
    log(`[Cache] ${operation} skipped: ${error.message}`);
  };

  const run = async (operation, fn) => {
    const redis = typeof client === "function" ? client() : client;
    if (!redis) return null;
    try {
      return await withDeadline(fn(redis));
    } catch (error) {
      warn(operation, error);
      return null;
    }
  };

  const key = (...parts) => prefix + parts.join(":");

  const cache = {
    key,

    async get(name) {
      const raw = await run("get", (redis) => redis.get(name));
      if (raw == null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    async set(name, value, ttlSeconds) {
      if (value === undefined) return;
      await run("set", (redis) =>
        redis.set(name, JSON.stringify(value), "EX", Math.max(1, Math.round(ttlSeconds))),
      );
    },

    async del(...names) {
      if (names.length) await run("del", (redis) => redis.del(...names));
    },

    async incr(name) {
      return run("incr", (redis) => redis.incr(name));
    },

    async wrap(name, ttlSeconds, compute, { shouldCache = () => true } = {}) {
      const hit = await cache.get(name);
      if (hit !== null) return hit;
      const value = await compute();
      if (value !== undefined && shouldCache(value)) await cache.set(name, value, ttlSeconds);
      return value;
    },
  };

  return cache;
};
