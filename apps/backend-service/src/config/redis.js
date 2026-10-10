import { Redis } from "ioredis";
import { env } from "./env.js";
import { createCache } from "../lib/cache.js";
import { logger } from "../lib/logger.js";
import { cacheRequests } from "../lib/metrics.js";

export const redisEnabled = Boolean(env.REDIS_URL);

const WARN_EVERY_MS = 60_000;

export const createQueueConnection = () => {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  let lastWarning = 0;
  connection.on("error", (error) => {
    if (Date.now() - lastWarning < WARN_EVERY_MS) return;
    lastWarning = Date.now();
    logger.warn("queue connection error", { error: error.message });
  });
  return connection;
};

let cacheClient = null;
const connectCache = () => {
  cacheClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
  });
  cacheClient.on("error", () => {});
};
if (redisEnabled) connectCache();

const cacheConnection = () => (cacheClient?.status === "ready" ? cacheClient : null);

export const cache = createCache({
  client: cacheConnection,
  log: (message) => logger.warn(message),
  observe: (result) => cacheRequests.inc({ result }),
});

const waitUntilReady = (client, timeoutMs) =>
  client.status === "ready"
    ? Promise.resolve()
    : new Promise((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        client.once("ready", () => {
          clearTimeout(timer);
          resolve();
        });
      });

export const redisStatus = async () => {
  if (!redisEnabled) return { status: "not_configured" };
  if (cacheClient) await waitUntilReady(cacheClient, 1500);
  const client = cacheConnection();
  if (!client) return { status: "down", detail: "Can't connect to Redis" };
  try {
    await client.ping();
    return { status: "up" };
  } catch (error) {
    return { status: "down", detail: error.message };
  }
};

export const closeRedis = async () => {
  await cacheClient?.quit().catch(() => {});
};
