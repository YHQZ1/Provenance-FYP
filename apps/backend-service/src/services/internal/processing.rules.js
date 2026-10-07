export const RETRY_BASE_DELAY_MS = 15_000;

export const jobOptions = (attempts) => ({
  attempts,
  backoff: { type: "exponential", delay: RETRY_BASE_DELAY_MS },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
});

export const isFinalAttempt = (attemptsMade, attempts) => attemptsMade >= attempts;

export const retryingMessage = (attemptsMade, attempts, error) =>
  `Attempt ${attemptsMade} of ${attempts} failed (${error.message}). Retrying shortly.`;

export const failedMessage = (attempts, error) =>
  attempts > 1
    ? `Processing failed after ${attempts} attempts: ${error.message}. Retry the document.`
    : `Processing failed: ${error.message}. Retry the document.`;

export const readingMessage = (attempt, attempts) =>
  attempt > 1
    ? `Reading the document (attempt ${attempt} of ${attempts}).`
    : "Reading the document.";
