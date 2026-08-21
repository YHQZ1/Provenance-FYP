import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { complianceController } from "../controllers/compliance.controller.js";

const router = Router();

router.use(authenticate);

router.get("/filings", complianceController.listFilings);
router.get("/filings/current", complianceController.getCurrent);
router.get("/filings/:id", complianceController.getFiling);
router.get("/filings/:id/documents", complianceController.getFilingDocuments);
router.post("/filings/:id/submit", complianceController.submitFiling);
router.get("/dashboard/stats", complianceController.getDashboardStats);
router.get(
  "/dashboard/recent-activity",
  complianceController.getRecentActivity,
);
router.get(
  "/reports/quarterly-summary",
  complianceController.getQuarterlyReport,
);

export default router;
