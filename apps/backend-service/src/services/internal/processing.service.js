import { supabaseAdmin } from "../../config/database.js";
import { documentQueue, documentJobState, enqueueDocument } from "../../queues/document.queue.js";
import { storageService } from "../storage.service.js";
import { ocrService } from "../external/ocr.service.js";
import { ragService } from "../external/rag.service.js";
import { documentTypeOf } from "../external/normalization.js";
import { PROCESSING_STATUSES } from "./filing.summary.js";
import { failedMessage, readingMessage, retryingMessage } from "./processing.rules.js";
import { workspaceCache } from "./workspace.cache.js";
import { runWithContext } from "../../lib/context.js";
import { logger } from "../../lib/logger.js";
import { documentProcessingDuration, documentsProcessed } from "../../lib/metrics.js";

const now = () => new Date().toISOString();

const updateDocument = async (documentId, changes) => {
  const { data } = await supabaseAdmin
    .from("documents")
    .update({ ...changes, updated_at: now() })
    .eq("id", documentId)
    .select("company_id");
  await workspaceCache.invalidate(data?.[0]?.company_id);
};

const setStatus = (documentId, status, reasoning) =>
  updateDocument(documentId, { status, reasoning });

export const processingService = {
  processDocument(documentId, options = {}) {
    return runWithContext({ documentId }, async () => {
      const stop = documentProcessingDuration.startTimer();
      let outcome = "error";
      try {
        const result = await this.run(documentId, options);
        outcome = result.skipped ? "skipped" : "ok";
        return result;
      } finally {
        stop({ outcome });
        documentsProcessed.inc({ outcome });
      }
    });
  },

  async run(documentId, { attempt = 1, attempts = 1 } = {}) {
    const { data: document, error } = await supabaseAdmin
      .from("documents")
      .select("id, company_id, filename, file_path, mime_type, extracted_data")
      .eq("id", documentId)
      .maybeSingle();
    if (error) throw new Error(`Couldn't load the document: ${error.message}`);
    if (!document) return { skipped: "deleted" };

    await setStatus(documentId, "OCR_PROCESSING", readingMessage(attempt, attempts));

    const meta = {
      document_type: documentTypeOf(document.extracted_data),
      file_hash: document.extracted_data?.file_hash || null,
    };
    const buffer = await storageService.downloadFile(document.file_path);
    const ocrResult = await ocrService.submitForOcr(
      documentId,
      { buffer, originalname: document.filename, mimetype: document.mime_type },
      meta,
    );

    const items = ocrResult.line_items || [];
    if (items.length > 0) await ragService.processDocument(documentId, items);
    await workspaceCache.invalidate(document.company_id);
    return { items: items.length };
  },

  markRetrying(documentId, attemptsMade, attempts, error) {
    return setStatus(documentId, "PENDING", retryingMessage(attemptsMade, attempts, error));
  },

  markFailed(documentId, attempts, error) {
    return updateDocument(documentId, {
      status: "OCR_FAILED",
      reasoning: failedMessage(attempts, error),
      requires_human_review: true,
      verified_by_user: false,
    });
  },

  async schedule(documentId) {
    if (documentQueue()) {
      try {
        await enqueueDocument(documentId);
        return "queued";
      } catch (error) {
        logger.error("queue unavailable, processing inline", { document_id: documentId, error });
      }
    }
    this.processDocument(documentId).catch(async (error) => {
      logger.error("processing failed", { document_id: documentId, error });
      await this.markFailed(documentId, 1, error);
    });
    return "inline";
  },

  async recoverInterrupted() {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id")
      .in("status", PROCESSING_STATUSES);
    if (error) {
      logger.error("recovery check failed", { error });
      return;
    }

    let resumed = 0;
    for (const { id } of data || []) {
      const state = documentQueue() ? await documentJobState(id).catch(() => "none") : "none";
      if (["active", "waiting", "delayed", "prioritized"].includes(state)) continue;
      await setStatus(id, "PENDING", "Queued again after a restart.");
      await this.schedule(id);
      resumed += 1;
    }
    if (resumed) logger.info("re-queued interrupted documents", { count: resumed });
  },
};
