import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { complianceController } from "../controllers/compliance.controller.js";

const router = Router();

router.use(authenticate);

router.get("/filing", complianceController.getFiling);
router.post("/filing/finalize", complianceController.finalize);
router.post("/filing/reopen", complianceController.reopen);
router.post("/filing/regulatory-review", complianceController.regulatoryReview);

export default router;
