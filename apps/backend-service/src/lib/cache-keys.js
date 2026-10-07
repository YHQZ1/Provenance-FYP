import crypto from "crypto";

// Cache key material for model outputs. Pure, so the rules are unit-tested.

export const digest = (value, length = 16) =>
  crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);

const normalizeText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// A line's material doesn't depend on how much was bought, and quantity_kg is computed here, not
// by the classifier, so the key is the description and unit without the number. Next month's
// invoice for the same product then reuses the answer.
export const classificationCacheText = (item) =>
  `${normalizeText(item?.description || item?.raw_text)}|${normalizeText(item?.unit)}`;

// Questions differing only in case, spacing or a trailing question mark share an answer.
export const questionCacheText = (question) => normalizeText(question).replace(/[?.!\s]+$/, "");

// A tag that changes whenever whatever produced the answer changes: the model, the embedding
// model, the synonym index, or the indexed regulatory sources. Null when it can't be known, in
// which case nothing is cached.
export const answerSourceTag = (parts) =>
  parts.every((part) => part !== undefined && part !== null && part !== "")
    ? digest(JSON.stringify(parts), 12)
    : null;
