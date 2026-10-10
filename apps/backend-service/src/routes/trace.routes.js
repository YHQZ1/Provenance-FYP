import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { accountLimits, limits } from "../middleware/rate-limit.middleware.js";
import { traceController } from "../controllers/trace.controller.js";

const router = Router();

router.post("/chat", authenticate, accountLimits, limits.trace, traceController.chat);

export default router;
