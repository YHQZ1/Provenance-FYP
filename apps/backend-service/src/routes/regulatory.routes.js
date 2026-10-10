import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { accountLimits, limits } from "../middleware/rate-limit.middleware.js";
import { regulatoryController } from "../controllers/regulatory.controller.js";

const router = Router();

router.use(authenticate, accountLimits);
router.get("/sources", regulatoryController.sources);
router.post("/query", limits.regulatory, regulatoryController.query);

export default router;
