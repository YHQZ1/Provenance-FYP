import { supabaseAdmin } from "../../config/database.js";
import { documentQueue, documentJobState, enqueueDocument } from "../../queues/document.queue.js";
import { storageService } from "../storage.service.js";
import { ocrService } from "../external/ocr.service.js";
import { ragService } from "../external/rag.service.js";
import { documentTypeOf } from "../external/normalization.js";
import { PROCESSING_STATUSES } from "./filing.summary.js";
import { failedMessage, readingMessage, retryingMessage } from "./processing.rules.js";
import { workspaceCache } from "./workspace.cache.js";

const now = () => new Date().toISOString();

// Status changes move documents between the filing's counters, so each one invalidates the
// company's cached filing.
const updateDocument = async (documentId, changes) => {
  const { data } = await supabaseAdmin
    .from("documents")
    .update({ ...changes, updated_at: now() })
    .eq("id", documentId)
    .select("company_id");
  await workspaceCache.invalidate(data?.[0]?.company_id);
};

const setStatus = (documentId, status, reasoning) => updateDocument(documentId, { status, reasoning });

export const processingService = {
  // The whole pipeline for one document: read it, then classify its lines. Each run starts from
  // the stored file, so it can be repeated safely; OCR output is cached by file hash, so a
  // retry after a classification failure doesn't read the document again.
  async processDocument(documentId, { attempt = 1, attempts = 1 } = {}) {
    const { data: document, error } = await supabaseAdmin
      .from("documents")
      .select("id, company_id, filename, file_path, mime_type, extracted_data")
      .eq("id", documentId)
      .maybeSingle();
    if (error) throw new Error(`Couldn't load the document: ${error.message}`);
    // Deleted while it waited in the queue: nothing to do.
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

  // Queue the document when Redis is available; otherwise process it here, as before the queue.
  async schedule(documentId) {
    if (documentQueue()) {
      try {
        await enqueueDocument(documentId);
        return "queued";
      } catch (error) {
        console.error(`[Processing] Queue unavailable, processing ${documentId} inline:`, error.message);
      }
    }
    this.processDocument(documentId).catch(async (error) => {
      console.error(`[Processing] ${documentId} failed:`, error.message);
      await this.markFailed(documentId, 1, error);
    });
    return "inline";
  },

  // Documents left mid-processing by a restart, or whose job is gone (Redis was wiped), are put
  // back in the queue. Jobs that are still in Redis resume by themselves.
  async recoverInterrupted() {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id")
      .in("status", PROCESSING_STATUSES);
    if (error) {
      console.error("[Processing] Recovery check failed:", error.message);
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
    if (resumed) console.log(`[Processing] Re-queued ${resumed} interrupted document(s)`);
  },
};
