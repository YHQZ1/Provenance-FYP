import * as companyService from "../services/internal/company.service.js";

export const companyController = {
  async createCompany(req, res, next) {
    try {
      const userId = req.user.id;

      const existing = await companyService.getCompanyById(userId);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Company already exists",
        });
      }

      const { company_name, gst_number, Pibo_category } = req.body;

      if (!company_name) {
        return res.status(400).json({
          success: false,
          message: "Company name is required",
        });
      }

      const company = await companyService.createCompany(userId, {
        company_name,
        gst_number: gst_number || null,
        Pibo_category: Pibo_category || [],
        email_id: req.user.email,
      });

      return res.status(201).json({
        success: true,
        data: company,
      });
    } catch (err) {
      next(err);
    }
  },

  async updateCompany(req, res, next) {
    try {
      const company = await companyService.updateCompany(req.user.id, req.body);

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Profile not found",
        });
      }

      return res.json({
        success: true,
        data: company,
      });
    } catch (err) {
      next(err);
    }
  },

  async getMyCompany(req, res, next) {
    try {
      const company = await companyService.getCompanyById(req.user.id);

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Profile not found",
        });
      }

      return res.json({
        success: true,
        data: company,
      });
    } catch (err) {
      next(err);
    }
  },

  async getCompanyById(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.id !== id) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const company = await companyService.getCompanyById(id);

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      return res.json({
        success: true,
        data: company,
      });
    } catch (err) {
      next(err);
    }
  },
};
