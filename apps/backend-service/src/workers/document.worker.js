import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { createQueueConnection, redisEnabled } from "../config/redis.js";
import { DOCUMENT_QUEUE } from "../queues/document.queue.js";
import { processingService } from "../services/internal/processing.service.js";
import { isFinalAttempt } from "../services/internal/processing.rules.js";

export const startDocumentWorker = () => {
  if (!redisEnabled) return null;

  const worker = new Worker(
    DOCUMENT_QUEUE,
    (job) =>
      processingService.processDocument(job.data.documentId, {
        attempt: job.attemptsMade + 1,
        attempts: job.opts.attempts ?? 1,
      }),
    { connection: createQueueConnection(), concurrency: env.PROCESSING_CONCURRENCY },
  );

  worker.on("failed", async (job, error) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const { documentId } = job.data;
    console.error(
      `[Worker] ${documentId} attempt ${job.attemptsMade}/${attempts} failed:`,
      error.message,
    );
    try {
      if (isFinalAttempt(job.attemptsMade, attempts)) {
        await processingService.markFailed(documentId, attempts, error);
      } else {
        await processingService.markRetrying(documentId, job.attemptsMade, attempts, error);
      }
    } catch (statusError) {
      console.error(`[Worker] Couldn't record the failure for ${documentId}:`, statusError.message);
    }
  });
  worker.on("error", (error) => console.error("[Worker]", error.message));

  console.log(`[Worker] Processing documents, ${env.PROCESSING_CONCURRENCY} at a time`);
  return worker;
};
