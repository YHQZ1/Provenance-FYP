import assert from "node:assert/strict";
import test from "node:test";

import {
  failedMessage,
  isFinalAttempt,
  jobOptions,
  readingMessage,
  retryingMessage,
} from "../src/services/internal/processing.rules.js";

test("jobs retry with exponential backoff and keep failures for a week", () => {
  const options = jobOptions(3);
  assert.equal(options.attempts, 3);
  assert.deepEqual(options.backoff, { type: "exponential", delay: 15000 });
  assert.equal(options.removeOnFail.age, 7 * 24 * 3600);
});

test("only the last attempt marks a document failed", () => {
  assert.equal(isFinalAttempt(1, 3), false);
  assert.equal(isFinalAttempt(2, 3), false);
  assert.equal(isFinalAttempt(3, 3), true);
  assert.equal(isFinalAttempt(1, 1), true);
});

test("messages say which attempt this is and what went wrong", () => {
  const error = new Error("OCR service returned 503");
  assert.equal(
    retryingMessage(1, 3, error),
    "Attempt 1 of 3 failed (OCR service returned 503). Retrying shortly.",
  );
  assert.match(
    failedMessage(3, error),
    /^Processing failed after 3 attempts: OCR service returned 503/,
  );
  assert.match(failedMessage(1, error), /^Processing failed: OCR service returned 503/);
  assert.equal(readingMessage(1, 3), "Reading the document.");
  assert.equal(readingMessage(2, 3), "Reading the document (attempt 2 of 3).");
});
