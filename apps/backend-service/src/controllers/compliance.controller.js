import {
  complianceService,
  currentFinancialYear,
} from "../services/internal/compliance.service.js";
import { badRequest } from "../utils/errors.js";

const readYear = (req) => {
  const raw = req.query.fy ?? req.body?.fy;
  if (raw === undefined || raw === "") return currentFinancialYear();
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw badRequest("fy must be the financial year's start year, e.g. 2026");
  }
  return year;
};

const handle = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

export const complianceController = {
  getFiling: handle((req) => complianceService.getFiling(req.user.id, readYear(req))),
  finalize: handle((req) =>
    complianceService.finalize(req.user.id, readYear(req), req.body?.notes),
  ),
  reopen: handle((req) => complianceService.reopen(req.user.id, readYear(req))),
  regulatoryReview: handle((req) =>
    complianceService.getRegulatoryReview(req.user.id, readYear(req)),
  ),
};
