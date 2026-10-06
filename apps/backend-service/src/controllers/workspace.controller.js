import { currentFinancialYear } from "../services/internal/compliance.service.js";
import { activityService, ACTIVITY_GROUPS } from "../services/internal/activity.service.js";
import { obligationService } from "../services/internal/obligation.service.js";
import { materialsService } from "../services/internal/materials.service.js";
import { badRequest } from "../utils/errors.js";

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ success: true, data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

const readYear = (raw, fallback) => {
  if (raw === undefined || raw === "") return fallback;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw badRequest("fy must be the financial year's start year, e.g. 2026");
  }
  return year;
};

// Activity, obligations and the materials library: the workspace tools around the filing.
export const workspaceController = {
  activity: async (req, res, next) => {
    try {
      const { group, before } = req.query;
      if (group && !ACTIVITY_GROUPS[group]) {
        throw badRequest(`group must be one of ${Object.keys(ACTIVITY_GROUPS).join(", ")}`);
      }
      if (before && Number.isNaN(Date.parse(before))) throw badRequest("before must be a timestamp");
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 1000);
      const result = await activityService.list(req.user.id, {
        fy: req.query.fy === "all" ? null : readYear(req.query.fy, null),
        group,
        before,
        limit,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  obligations: handle((req) =>
    obligationService.get(
      req.user.id,
      readYear(req.query.fy, currentFinancialYear()),
      req.query.basis || "current",
    ),
  ),
  updateObligation: handle((req) =>
    obligationService.update(
      req.user,
      readYear(req.body?.fy, currentFinancialYear()),
      req.params.category,
      req.body || {},
    ),
  ),

  materials: handle((req) => materialsService.library(req.user.id)),
  addTradeName: handle((req) => materialsService.addTradeName(req.user, req.body), 201),
  removeTradeName: handle((req) => materialsService.removeTradeName(req.user, req.params.id)),
};
