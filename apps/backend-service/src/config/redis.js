import { Redis } from "ioredis";
import { env } from "./env.js";
import { createCache } from "../lib/cache.js";

export const redisEnabled = Boolean(env.REDIS_URL);

export const createQueueConnection = () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

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

export const cache = createCache({ client: cacheConnection });

export const redisStatus = async () => {
  if (!redisEnabled) return { status: "not_configured" };
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
