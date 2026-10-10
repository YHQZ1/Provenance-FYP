import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { accountLimits, limits } from "../middleware/rate-limit.middleware.js";
import { complianceController } from "../controllers/compliance.controller.js";

const router = Router();

router.use(authenticate, accountLimits);

router.get("/filing", complianceController.getFiling);
router.post("/filing/finalize", limits.filing, complianceController.finalize);
router.post("/filing/reopen", limits.filing, complianceController.reopen);
router.post(
  "/filing/regulatory-review",
  limits.regulatoryReview,
  complianceController.regulatoryReview,
);

export default router;
