import { documentService } from "../services/internal/document.service.js";
import { badRequest } from "../utils/errors.js";
import { activityService } from "../services/internal/activity.service.js";

const recordDocument = (req, document, action, summary, details = {}) =>
  activityService.record(req.user, {
    action,
    summary,
    documentId: document.id,
    financialYear: document.financial_year,
    details: { filename: document.filename, ...details },
  });

export const documentController = {
  async upload(req, res, next) {
    try {
      if (!req.file) throw badRequest("No file uploaded");

      const document = await documentService.createDocument(
        req.user.id,
        req.file,
        { documentType: req.body?.document_type },
      );
      await recordDocument(req, document, "document.uploaded", `uploaded ${document.filename}`, {
        document_type: document.document_type,
      });

      res.status(201).json({
        success: true,
        message: "Document uploaded. Processing has started.",
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const result = await documentService.listDocuments(req.user.id, {
        page: Math.max(parseInt(req.query.page) || 1, 1),
        limit: Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200),
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
      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const { document_date } = req.body || {};
      if (
        document_date !== undefined &&
        document_date !== null &&
        !/^\d{4}-\d{2}-\d{2}$/.test(document_date)
      ) {
        throw badRequest("document_date must be YYYY-MM-DD");
      }
      const document = await documentService.updateDocument(
        req.params.id,
        req.user.id,
        { document_date },
      );
      if (document_date !== undefined) {
        await recordDocument(
          req,
          document,
          "document.redated",
          document_date
            ? `dated ${document.filename} ${document_date}`
            : `cleared the date on ${document.filename}`,
          { document_date },
        );
      }
      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  },

  async retry(req, res, next) {
    try {
      const data = await documentService.retryDocument(
        req.params.id,
        req.user.id,
      );
      await recordDocument(req, data, "document.retried", `retried ${data.filename}`);
      res.status(202).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async deleteDocument(req, res, next) {
    try {
      const document = await documentService.deleteDocument(req.params.id, req.user.id);
      await recordDocument(req, document, "document.deleted", `deleted ${document.filename}`);
      res.json({ success: true, message: "Document deleted" });
    } catch (error) {
      next(error);
    }
  },
};
