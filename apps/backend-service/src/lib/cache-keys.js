import crypto from "crypto";

export const digest = (value, length = 16) =>
  crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);

const normalizeText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const classificationCacheText = (item) =>
  `${normalizeText(item?.description || item?.raw_text)}|${normalizeText(item?.unit)}`;

export const questionCacheText = (question) => normalizeText(question).replace(/[?.!\s]+$/, "");

export const answerSourceTag = (parts) =>
  parts.every((part) => part !== undefined && part !== null && part !== "")
    ? digest(JSON.stringify(parts), 12)
    : null;
