import * as companyService from "../services/internal/company.service.js";
import { badRequest } from "../utils/errors.js";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
export const PIBO_CATEGORIES = ["PRODUCER", "IMPORTER", "BRAND_OWNER"];

const validateProfile = (body) => {
  const updates = {};
  if (body.company_name !== undefined) {
    const name = String(body.company_name).trim();
    if (name.length < 2) throw badRequest("Company name is required");
    updates.company_name = name;
  }
  if (body.gst_number !== undefined) {
    const gst = String(body.gst_number || "").trim().toUpperCase();
    if (gst && !GSTIN_PATTERN.test(gst)) {
      throw badRequest("GSTIN should be 15 characters, e.g. 27ABCDE1234F1Z5");
    }
    updates.gst_number = gst || null;
  }
  if (body.epr_registration_number !== undefined) {
    const registration = String(body.epr_registration_number || "").trim().toUpperCase();
    if (registration.length > 60 || /[^A-Z0-9/\-. ]/.test(registration)) {
      throw badRequest("EPR registration number can contain letters, numbers, /, - and . only");
    }
    updates.epr_registration_number = registration || null;
  }
  if (body.Pibo_category !== undefined) {
    const categories = Array.isArray(body.Pibo_category) ? body.Pibo_category : [];
    if (categories.some((c) => !PIBO_CATEGORIES.includes(c))) {
      throw badRequest(`PIBO category must be one of ${PIBO_CATEGORIES.join(", ")}`);
    }
    updates.Pibo_category = categories;
  }
  return updates;
};

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
      const updates = validateProfile(req.body || {});
      if (Object.keys(updates).length === 0) throw badRequest("Nothing to update");
      updates.onboarding_completed = Boolean(
        (updates.gst_number ?? req.company?.gst_number) &&
          (updates.Pibo_category ?? req.company?.Pibo_category)?.length,
      );
      const company = await companyService.updateCompany(req.user.id, updates);

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
