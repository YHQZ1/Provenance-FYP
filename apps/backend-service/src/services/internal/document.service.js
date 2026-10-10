import crypto from "crypto";
import fs from "fs/promises";
import { supabaseAdmin } from "../../config/database.js";
import { env } from "../../config/env.js";
import { storageService } from "../storage.service.js";
import { documentQueue, dequeueDocument } from "../../queues/document.queue.js";
import { processingService } from "./processing.service.js";
import { workspaceCache } from "./workspace.cache.js";
import {
  documentTypeOf,
  financialYearOf,
  financialYearRange,
  normalizeDocumentType,
} from "../external/normalization.js";
import { conflict, notFound } from "../../utils/errors.js";
import { schema } from "../../config/schema.js";
import { PROCESSING_STATUSES, effectiveDate } from "./filing.summary.js";
import {
  assertDocumentEditable,
  assertDocumentRemovable,
  filingPosition,
  finalizedYears,
} from "./filing.lock.js";

export { PROCESSING_STATUSES, effectiveDate };

const LIST_COLUMNS =
  "id, filename, status, reasoning, mime_type, file_size, created_at, updated_at, ocr_confidence, rag_confidence, requires_human_review, verified_by_user, extracted_data, document_classifications(id, material_code, quantity_kg, verified_by_user, requires_human_review)";

const STALE_PROCESSING_MS = env.OCR_TIMEOUT_MS + env.RAG_TIMEOUT_MS + 2 * 60 * 1000;

const isStale = (document) =>
  Date.now() - new Date(document.updated_at || document.created_at).getTime() > STALE_PROCESSING_MS;

const duplicateError = (duplicate) => {
  const fy = financialYearOf(effectiveDate(duplicate));
  const range = financialYearRange(fy);
  return conflict(
    `Already uploaded as "${duplicate.filename}" (${range.label}). Uploading it again would double-count its quantities.`,
    {
      document_id: duplicate.id,
      filename: duplicate.filename,
      financial_year: fy,
      financial_year_label: range.label,
    },
  );
};

const findByHash = async (userId, fileHash) => {
  const { data } = await supabaseAdmin
    .from("documents")
    .select("id, filename, created_at, extracted_data")
    .eq("company_id", userId)
    .eq("extracted_data->>file_hash", fileHash)
    .limit(1)
    .maybeSingle();
  return data;
};

const toListItem = (doc, years = new Map()) => {
  const items = doc.document_classifications || [];
  const { extracted_data: extracted = {}, document_classifications, ...rest } = doc;
  return {
    ...rest,
    document_type: documentTypeOf(extracted),
    document_date: extracted.document_date || null,
    effective_date: effectiveDate(doc),
    financial_year: financialYearOf(effectiveDate(doc)),
    fields: extracted.fields || {},
    warnings: extracted.warnings || [],
    items_count: items.length,
    items_verified: items.filter((c) => c.verified_by_user).length,
    items_pending: items.filter((c) => !c.verified_by_user).length,
    filing: describePosition(filingPosition(doc, years)),
  };
};

const describePosition = (position) => ({
  ...position,
  financial_year_label: financialYearRange(position.financial_year).label,
});

export const documentService = {
  async createDocument(userId, fileInfo, options = {}) {
    const { originalname, mimetype, size, path: localPath } = fileInfo;
    const documentType = normalizeDocumentType(options.documentType);
    const fileBuffer = await fs.readFile(localPath);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const duplicate = await findByHash(userId, fileHash);
    if (duplicate) {
      await fs.unlink(localPath).catch(() => {});
      throw duplicateError(duplicate);
    }

    let storagePath;
    try {
      ({ path: storagePath } = await storageService.uploadFile(localPath, userId, originalname));
    } finally {
      await fs.unlink(localPath).catch(() => {});
    }

    const { data: document, error } = await supabaseAdmin
      .from("documents")
      .insert({
        company_id: userId,
        filename: originalname,
        file_path: storagePath,
        mime_type: mimetype,
        file_size: size,
        status: "PENDING",
        extracted_data: { document_type: documentType, file_hash: fileHash },
      })
      .select()
      .single();

    if (error) {
      await storageService.deleteFile(storagePath).catch(() => {});
      if (error.code === "23505") {
        const winner = await findByHash(userId, fileHash);
        if (winner) throw duplicateError(winner);
      }
      throw new Error(`Database insert failed: ${error.message}`);
    }

    await workspaceCache.invalidate(userId);
    await processingService.schedule(document.id);

    return toListItem({ ...document, document_classifications: [] }, await finalizedYears(userId));
  },

  async countProcessing(userId) {
    const { count } = await supabaseAdmin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", userId)
      .in("status", PROCESSING_STATUSES);
    return count ?? 0;
  },

  async retryDocument(documentId, userId) {
    const { data: document } = await supabaseAdmin
      .from("documents")
      .select("id, filename, file_path, mime_type, status, extracted_data, created_at")
      .eq("id", documentId)
      .eq("company_id", userId)
      .maybeSingle();

    if (!document) throw notFound("Document not found");
    await assertDocumentEditable(userId, document);
    if (PROCESSING_STATUSES.includes(document.status)) {
      throw conflict("This document is already being processed.");
    }

    await supabaseAdmin
      .from("documents")
      .update({
        status: "PENDING",
        reasoning: "Queued for reprocessing.",
        verified_by_user: false,
        requires_human_review: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    await workspaceCache.invalidate(userId);
    await processingService.schedule(documentId);

    return {
      id: documentId,
      status: "PENDING",
      filename: document.filename,
      financial_year: financialYearOf(effectiveDate(document)),
    };
  },

  async updateDocument(documentId, userId, updates) {
    const { data: document } = await supabaseAdmin
      .from("documents")
      .select("id, extracted_data, created_at")
      .eq("id", documentId)
      .eq("company_id", userId)
      .maybeSingle();

    if (!document) throw notFound("Document not found");
    await assertDocumentEditable(userId, document);

    const extracted = { ...(document.extracted_data || {}) };
    if (updates.document_date !== undefined) {
      extracted.document_date = updates.document_date || null;
      await assertDocumentEditable(userId, { ...document, extracted_data: extracted });
    }

    const { error } = await supabaseAdmin
      .from("documents")
      .update({ extracted_data: extracted, updated_at: new Date().toISOString() })
      .eq("id", documentId);

    if (error) throw new Error(`Update failed: ${error.message}`);
    await workspaceCache.invalidate(userId);
    return this.getDocument(documentId, userId);
  },

  async deleteDocument(documentId, userId) {
    const { data: document } = await supabaseAdmin
      .from("documents")
      .select("id, filename, file_path, status, extracted_data, created_at, updated_at")
      .eq("id", documentId)
      .eq("company_id", userId)
      .maybeSingle();

    if (!document) throw notFound("Document not found");
    if (PROCESSING_STATUSES.includes(document.status)) {
      const removable = documentQueue()
        ? await dequeueDocument(documentId).catch(() => isStale(document))
        : isStale(document);
      if (!removable) {
        throw conflict("This document is being read right now. Delete it once it finishes.");
      }
    }
    await assertDocumentRemovable(userId, document);

    await supabaseAdmin.from("document_classifications").delete().eq("document_id", documentId);
    const { error } = await supabaseAdmin.from("documents").delete().eq("id", documentId);
    if (error) throw new Error(`Delete failed: ${error.message}`);
    await workspaceCache.invalidate(userId);

    await storageService.deleteFile(document.file_path).catch((err) => {
      console.error(`[Document] Stored file cleanup failed: ${err.message}`);
    });

    return { ...document, financial_year: financialYearOf(effectiveDate(document)) };
  },

  async getDocument(documentId, userId) {
    const { data: document, error } = await supabaseAdmin
      .from("documents")
      .select(`*, document_classifications(*)`)
      .eq("id", documentId)
      .eq("company_id", userId)
      .maybeSingle();

    if (error || !document) {
      throw notFound("Document not found");
    }

    const fileUrl = await storageService.getSignedUrl(document.file_path, 600).catch(() => null);
    const classifications = [...(document.document_classifications || [])].sort((a, b) =>
      String(a.created_at).localeCompare(String(b.created_at)),
    );

    return {
      ...toListItem(document, await finalizedYears(userId)),
      raw_text: document.raw_text,
      file_url: fileUrl,
      classifications,
    };
  },

  async listDocuments(userId, options = {}) {
    const { page = 1, limit = 50, status } = options;

    let query = supabaseAdmin
      .from("documents")
      .select(LIST_COLUMNS, { count: "exact" })
      .eq("company_id", userId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error(`Failed to fetch documents: ${error.message}`);

    const years = await finalizedYears(userId);
    return {
      data: (data || []).map((doc) => toListItem(doc, years)),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  },

  async listAllWithClassifications(userId) {
    const { classificationCategory } = await schema();
    const lineColumns = [
      "id, material_code, quantity_kg, corrected_material_code, corrected_quantity_kg, verified_by_user, requires_human_review",
      classificationCategory && "cpcb_category, corrected_cpcb_category",
    ]
      .filter(Boolean)
      .join(", ");

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select(
        `id, filename, status, reasoning, created_at, verified_by_user, extracted_data, document_classifications(${lineColumns})`,
      )
      .eq("company_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
    return data || [];
  },
};
