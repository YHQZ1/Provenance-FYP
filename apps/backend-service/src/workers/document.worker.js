import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { createQueueConnection, redisEnabled } from "../config/redis.js";
import { DOCUMENT_QUEUE } from "../queues/document.queue.js";
import { processingService } from "../services/internal/processing.service.js";
import { isFinalAttempt } from "../services/internal/processing.rules.js";
import { randomUUID } from "node:crypto";
import { runWithContext } from "../lib/context.js";
import { logger } from "../lib/logger.js";
import { captureError } from "../lib/sentry.js";

export const startDocumentWorker = () => {
  if (!redisEnabled) return null;

  const worker = new Worker(
    DOCUMENT_QUEUE,
    (job) =>
      runWithContext({ requestId: randomUUID(), documentId: job.data.documentId }, async () => {
        logger.info("processing started", { attempt: job.attemptsMade + 1 });
        return processingService.processDocument(job.data.documentId, {
          attempt: job.attemptsMade + 1,
          attempts: job.opts.attempts ?? 1,
        });
      }),
    { connection: createQueueConnection(), concurrency: env.PROCESSING_CONCURRENCY },
  );

  worker.on("failed", async (job, error) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const { documentId } = job.data;
    logger.error("processing attempt failed", {
      document_id: documentId,
      attempt: job.attemptsMade,
      attempts,
      error,
    });
    try {
      if (isFinalAttempt(job.attemptsMade, attempts)) {
        captureError(error, { documentId });
        await processingService.markFailed(documentId, attempts, error);
      } else {
        await processingService.markRetrying(documentId, job.attemptsMade, attempts, error);
      }
    } catch (statusError) {
      logger.error("couldn't record the failure", { document_id: documentId, error: statusError });
    }
  });
  worker.on("error", (error) => logger.error("worker error", { error }));

  logger.info("processing documents", { concurrency: env.PROCESSING_CONCURRENCY });
  return worker;
};
