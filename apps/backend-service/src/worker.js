import "./config/load-env.js";
import { env } from "./config/env.js";
import { schema } from "./config/schema.js";
import { closeRedis, redisEnabled } from "./config/redis.js";
import { logger } from "./lib/logger.js";
import { startMetricsServer } from "./lib/metrics-server.js";
import { flushSentry, initSentry } from "./lib/sentry.js";
import { closeDocumentQueue } from "./queues/document.queue.js";
import { startDocumentWorker } from "./workers/document.worker.js";

if (!redisEnabled) {
  logger.error("REDIS_URL is required to run a separate worker");
  process.exit(1);
}

initSentry();
await schema();
const worker = startDocumentWorker();
const metrics = startMetricsServer(env.METRICS_PORT);

const shutdown = async (signal) => {
  logger.info("finishing current jobs", { signal });
  metrics.close();
  await worker.close();
  await closeDocumentQueue();
  await closeRedis();
  await flushSentry();
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
