import "./config/load-env.js";
import app from "./app.js";
import { env } from "./config/env.js";
import { schema } from "./config/schema.js";
import { closeRedis } from "./config/redis.js";
import { logger } from "./lib/logger.js";
import { flushSentry, initSentry } from "./lib/sentry.js";
import { closeDocumentQueue } from "./queues/document.queue.js";
import { processingService } from "./services/internal/processing.service.js";
import { startDocumentWorker } from "./workers/document.worker.js";

initSentry();

const PORT = env.PORT;
const worker = env.RUN_WORKER ? startDocumentWorker() : null;

const server = app.listen(PORT, () => {
  logger.info("server running", { port: PORT, environment: env.NODE_ENV });
  if (!env.REDIS_URL) {
    logger.warn("REDIS_URL not set: documents are processed in this process and nothing is cached");
  }
  schema();
  processingService.recoverInterrupted();
});

const gracefulShutdown = async (signal) => {
  logger.info("shutting down", { signal });
  server.close();
  await worker?.close().catch(() => {});
  await closeDocumentQueue().catch(() => {});
  await closeRedis();
  await flushSentry();
  logger.info("server closed");
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.error("port is already in use", { port: PORT });
    process.exit(1);
  }
  logger.error("server error", { error: err });
  process.exit(1);
});
