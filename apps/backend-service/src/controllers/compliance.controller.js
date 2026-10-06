import {
  complianceService,
  currentFinancialYear,
} from "../services/internal/compliance.service.js";
import { badRequest } from "../utils/errors.js";
import { activityService } from "../services/internal/activity.service.js";
import { financialYearRange } from "../services/external/normalization.js";

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
  finalize: handle(async (req) => {
    const fy = readYear(req);
    const filing = await complianceService.finalize(req.user.id, fy, req.body?.notes);
    await activityService.record(req.user, {
      action: "filing.finalized",
      summary: `finalized ${financialYearRange(fy).label}`,
      financialYear: fy,
      details: {
        introduced_kg: filing.totals.introduced.total_kg,
        recycled_kg: filing.totals.recycled.total_kg,
        notes: req.body?.notes || null,
      },
    });
    return filing;
  }),
  reopen: handle(async (req) => {
    const fy = readYear(req);
    const filing = await complianceService.reopen(req.user.id, fy);
    await activityService.record(req.user, {
      action: "filing.reopened",
      summary: `reopened ${financialYearRange(fy).label}`,
      financialYear: fy,
    });
    return filing;
  }),
  regulatoryReview: handle((req) =>
    complianceService.getRegulatoryReview(req.user.id, readYear(req)),
  ),
};
