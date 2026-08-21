import { complianceService } from "../services/internal/compliance.service.js";

export const complianceController = {
  async listFilings(req, res, next) {
    try {
      const data = await complianceService.getFilingPeriods(req.user.id, {
        year: req.query.year ? parseInt(req.query.year) : null,
        status: req.query.status,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getCurrent(req, res, next) {
    try {
      const data = await complianceService.getCurrentFiling(req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getFiling(req, res, next) {
    try {
      const data = await complianceService.getFilingDetails(
        req.params.id,
        req.user.id,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getFilingDocuments(req, res, next) {
    try {
      const result = await complianceService.getFilingDocuments(
        req.params.id,
        req.user.id,
        {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 20,
        },
      );
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  async submitFiling(req, res, next) {
    try {
      const data = await complianceService.submitFiling(
        req.params.id,
        req.user.id,
        req.body.notes,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getDashboardStats(req, res, next) {
    try {
      const data = await complianceService.getDashboardStats(req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getRecentActivity(req, res, next) {
    try {
      const data = await complianceService.getRecentActivity(
        req.user.id,
        parseInt(req.query.limit) || 10,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getQuarterlyReport(req, res, next) {
    try {
      const data = await complianceService.generateQuarterlyReport(
        req.user.id,
        req.query.year ? parseInt(req.query.year) : null,
        req.query.quarter,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
