import { documentService } from "../services/internal/document.service.js";
import { supabaseAdmin } from "../config/database.js";

export const documentController = {
  async upload(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const document = await documentService.createDocument(
        req.user.id,
        req.file,
      );

      res.status(201).json({
        success: true,
        message: "Document uploaded and processing started",
        data: {
          id: document.id,
          filename: document.filename,
          status: document.status,
          created_at: document.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const result = await documentService.listDocuments(req.user.id, {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        status: req.query.status,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const document = await documentService.getDocument(
        req.params.id,
        req.user.id,
      );

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  async getStatus(req, res, next) {
    try {
      const { data: document, error } = await supabaseAdmin
        .from("documents")
        .select(
          "id, status, ocr_confidence, rag_confidence, requires_human_review, verified_by_user, updated_at, error_message",
        )
        .eq("id", req.params.id)
        .eq("company_id", req.user.id)
        .single();

      if (error || !document) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteDocument(req, res, next) {
    try {
      const { id } = req.params;

      const { data: document, error: fetchError } = await supabaseAdmin
        .from("documents")
        .select("id, file_path")
        .eq("id", id)
        .eq("company_id", req.user.id)
        .single();

      if (fetchError || !document) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      await supabaseAdmin
        .from("document_classifications")
        .delete()
        .eq("document_id", id);
      await supabaseAdmin.from("documents").delete().eq("id", id);

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};
