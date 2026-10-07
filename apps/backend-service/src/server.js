import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { schema } from "./config/schema.js";
import { closeRedis } from "./config/redis.js";
import { closeDocumentQueue } from "./queues/document.queue.js";
import { processingService } from "./services/internal/processing.service.js";
import { startDocumentWorker } from "./workers/document.worker.js";

const PORT = env.PORT;
const worker = env.RUN_WORKER ? startDocumentWorker() : null;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  if (!env.REDIS_URL) {
    console.warn(
      "[Processing] REDIS_URL not set: documents are processed in this process and nothing is cached.",
    );
  }
  schema();
  processingService.recoverInterrupted();
});

const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close();
  await worker?.close().catch(() => {});
  await closeDocumentQueue().catch(() => {});
  await closeRedis();
  console.log("Server closed. Process exiting.");
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  }
  console.error("Server error:", err.message);
  process.exit(1);
});
