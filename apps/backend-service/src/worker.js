import "dotenv/config";
import { schema } from "./config/schema.js";
import { closeRedis, redisEnabled } from "./config/redis.js";
import { closeDocumentQueue } from "./queues/document.queue.js";
import { startDocumentWorker } from "./workers/document.worker.js";

if (!redisEnabled) {
  console.error("REDIS_URL is required to run a separate worker.");
  process.exit(1);
}

await schema();
const worker = startDocumentWorker();

const shutdown = async (signal) => {
  console.log(`[Worker] ${signal} received, finishing current jobs…`);
  await worker.close();
  await closeDocumentQueue();
  await closeRedis();
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
