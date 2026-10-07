import { financialYearRange } from "../../external/normalization.js";
import { ollamaService } from "../../external/ollama.service.js";
import { regulatoryService } from "../../external/regulatory.service.js";
import { activityService } from "../activity.service.js";
import { complianceService, currentFinancialYear } from "../compliance.service.js";
import { documentService } from "../document.service.js";
import { feedbackService } from "../feedback.service.js";
import { obligationService } from "../obligation.service.js";
import { buildBrief } from "./brief.js";
import { gatherFacts } from "./facts.js";
import { detectAction } from "./action.js";
import { detectIntents } from "./intent.js";
import { buildLinks, buildSources } from "./links.js";
import { buildMessages } from "./prompt.js";

export const readers = {
  filing: (userId, fy) => complianceService.getFiling(userId, fy),
  obligations: (userId, fy) => obligationService.get(userId, fy),
  reviewQueue: (userId) => feedbackService.getReviewQueue(userId),
  activity: (userId, fy) => activityService.list(userId, { fy, limit: 8 }),
  document: (documentId, userId) => documentService.getDocument(documentId, userId),
  regulations: (question, topK) => regulatoryService.search(question, topK),
};

const knownDocuments = ({ filing, queue, document }) => {
  const byId = new Map();
  for (const item of filing?.documents || []) byId.set(item.id, item.filename);
  for (const item of queue?.data || []) byId.set(item.document_id, item.document_filename);
  if (document) byId.set(document.id, document.filename);
  return [...byId].map(([id, filename]) => ({ id, filename }));
};

export const traceService = {
  available: () => ollamaService.configured(),

  async respond({ userId, question, history, context, signal, onToken }) {
    const action = detectAction(question);
    if (action) {
      onToken(action.answer);
      const links = context.page === action.link.to ? [] : [action.link];
      return { answer: action.answer, links, sources: [] };
    }

    const fy = context.fy ?? currentFinancialYear();
    const intents = detectIntents(question, context);
    const facts = await gatherFacts({
      readers,
      userId,
      intents,
      fy,
      documentId: context.documentId,
      question,
    });

    const messages = buildMessages({
      question,
      history,
      brief: buildBrief(facts),
      passages: facts.passages,
      page: context.page,
      fyLabel: financialYearRange(fy).label,
      today: new Date().toISOString().slice(0, 10),
    });

    const answer = await ollamaService.streamChat(messages, { signal, onToken });
    return {
      answer,
      links: buildLinks({ answer, documents: knownDocuments(facts), intents, page: context.page }),
      sources: buildSources(facts.passages, answer, intents.regulation && !intents.workspace),
    };
  },
};
