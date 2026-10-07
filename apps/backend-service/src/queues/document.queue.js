import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { createQueueConnection, redisEnabled } from "../config/redis.js";
import { jobOptions } from "../services/internal/processing.rules.js";

export const DOCUMENT_QUEUE = "document-processing";
const PENDING_STATES = ["waiting", "delayed", "prioritized", "waiting-children"];

let queue = null;
export const documentQueue = () => {
  if (!redisEnabled) return null;
  queue ??= new Queue(DOCUMENT_QUEUE, { connection: createQueueConnection() });
  return queue;
};

export const enqueueDocument = async (documentId) => {
  const jobs = documentQueue();
  const existing = await jobs.getJob(documentId);
  if (existing) {
    const state = await existing.getState();
    if (state === "active" || PENDING_STATES.includes(state)) return existing;
    await existing.remove();
  }
  return jobs.add(
    "process-document",
    { documentId },
    {
      ...jobOptions(env.PROCESSING_ATTEMPTS),
      jobId: documentId,
    },
  );
};

export const documentJobState = async (documentId) => {
  const job = await documentQueue()?.getJob(documentId);
  return job ? job.getState() : "none";
};

export const dequeueDocument = async (documentId) => {
  const job = await documentQueue()?.getJob(documentId);
  if (!job) return true;
  const state = await job.getState();
  if (state === "active") return false;
  await job.remove();
  return true;
};

export const queueCounts = async () =>
  documentQueue().getJobCounts("waiting", "active", "delayed", "failed");

export const closeDocumentQueue = async () => {
  if (queue) await queue.close();
  queue = null;
};
