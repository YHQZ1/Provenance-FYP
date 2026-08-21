import { supabaseAdmin } from "../../config/database.js";
import { storageService } from "../storage.service.js";
import { ocrService } from "../external/ocr.service.js";
import { ragService } from "../external/rag.service.js";

export const documentService = {
  async createDocument(userId, fileInfo) {
    const { originalname, mimetype, size, path: localPath } = fileInfo;

    const { path: storagePath } = await storageService.uploadFile(
      localPath,
      userId,
      originalname,
    );

    const { data: document, error } = await supabaseAdmin
      .from("documents")
      .insert({
        company_id: userId,
        filename: originalname,
        file_path: storagePath,
        mime_type: mimetype,
        file_size: size,
        status: "PENDING",
        extracted_data: {},
      })
      .select()
      .single();

    if (error) {
      await storageService.deleteFile(storagePath).catch(() => {});
      throw new Error(`Database insert failed: ${error.message}`);
    }

    this.startOcrProcessing(document.id, storagePath, userId).catch((err) => {
      console.error(`[Document] OCR startup failed for ${document.id}:`, err);
      supabaseAdmin
        .from("documents")
        .update({
          status: "OCR_FAILED",
          error_message: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", document.id)
        .then();
    });

    return document;
  },

  async startOcrProcessing(documentId, storagePath, userId) {
    await supabaseAdmin
      .from("documents")
      .update({
        status: "OCR_PROCESSING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    await ocrService.submitForOcr(documentId, storagePath);

    setTimeout(async () => {
      try {
        const { data: doc } = await supabaseAdmin
          .from("documents")
          .select("extracted_data, status")
          .eq("id", documentId)
          .single();

        if (doc && doc.status === "COMPLETED" && doc.extracted_data?.items) {
          await ragService.submitForClassification(
            documentId,
            doc.extracted_data.items,
            userId,
          );
        }
      } catch (error) {
        console.error(
          `[Document] RAG trigger failed for ${documentId}:`,
          error,
        );
      }
    }, 3000);
  },

  async getDocument(documentId, userId) {
    const { data: document, error } = await supabaseAdmin
      .from("documents")
      .select(`*, document_classifications(*)`)
      .eq("id", documentId)
      .eq("company_id", userId)
      .single();

    if (error || !document) {
      throw new Error("Document not found");
    }

    const fileUrl = await storageService.getSignedUrl(document.file_path, 300);

    return {
      ...document,
      file_url: fileUrl,
      summary: {
        total_items: document.document_classifications?.length || 0,
        pending_review:
          document.document_classifications?.filter((c) => !c.verified_by_user)
            .length || 0,
        verified:
          document.document_classifications?.filter((c) => c.verified_by_user)
            .length || 0,
        avg_confidence: document.rag_confidence || document.ocr_confidence,
      },
    };
  },

  async listDocuments(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;

    let query = supabaseAdmin
      .from("documents")
      .select(
        `id, filename, status, created_at, updated_at, ocr_confidence, rag_confidence, requires_human_review, document_classifications(id)`,
        { count: "exact" },
      )
      .eq("company_id", userId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error(`Failed to fetch documents: ${error.message}`);

    return {
      data: (data || []).map((doc) => ({
        ...doc,
        items_count: doc.document_classifications?.length || 0,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  },
};
