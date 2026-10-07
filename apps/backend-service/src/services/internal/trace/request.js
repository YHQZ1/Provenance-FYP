import { badRequest } from "../../../utils/errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const parseTraceRequest = (body = {}) => {
  const question = typeof body.message === "string" ? body.message.trim() : "";
  if (question.length < 2 || question.length > 1000) {
    throw badRequest("Ask a question between 2 and 1,000 characters.");
  }
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  for (const turn of history) {
    if (!["user", "assistant"].includes(turn?.role) || typeof turn.content !== "string") {
      throw badRequest("History must be a list of user and assistant messages.");
    }
  }
  const raw = body.context || {};
  const fy = raw.fy == null || raw.fy === "" ? null : Number(raw.fy);
  if (fy !== null && (!Number.isInteger(fy) || fy < 2000 || fy > 2100)) {
    throw badRequest("fy must be the financial year's start year, e.g. 2026");
  }
  const documentId = raw.documentId && UUID.test(raw.documentId) ? raw.documentId : null;
  const page = typeof raw.page === "string" ? raw.page.slice(0, 60) : "";
  return { question, history, context: { fy, documentId, page } };
};
