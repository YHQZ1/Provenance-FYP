import { feedbackService } from "../services/internal/feedback.service.js";

export const feedbackController = {
  async getPending(req, res, next) {
    try {
      const result = await feedbackService.getPendingReview(req.user.id, {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        documentId: req.query.document_id,
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

  async verify(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const result = await feedbackService.verifyClassification(
        id,
        req.user.id,
        notes,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async correct(req, res, next) {
    try {
      const { id } = req.params;
      const {
        corrected_material_code,
        corrected_quantity_kg,
        feedback_type,
        notes,
      } = req.body;

      if (!corrected_material_code && !corrected_quantity_kg) {
        return res.status(400).json({
          success: false,
          message: "Correction data required",
        });
      }

      const result = await feedbackService.correctClassification(
        id,
        req.user.id,
        {
          corrected_material_code,
          corrected_quantity_kg,
          feedback_type: feedback_type || "OTHER",
          notes,
        },
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const result = await feedbackService.getClassification(
        req.params.id,
        req.user.id,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async bulkVerify(req, res, next) {
    try {
      const { classification_ids } = req.body;

      if (
        !Array.isArray(classification_ids) ||
        classification_ids.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "No IDs provided",
        });
      }

      const results = await feedbackService.bulkVerify(
        classification_ids,
        req.user.id,
      );
      const successCount = results.filter((r) => r.success).length;

      res.json({
        success: true,
        data: results,
        count: successCount,
      });
    } catch (error) {
      next(error);
    }
  },
};
