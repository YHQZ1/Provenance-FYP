import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { accountLimits, limits } from "../middleware/rate-limit.middleware.js";
import { systemService } from "../services/system.service.js";

const router = Router();

router.get("/status", authenticate, accountLimits, limits.status, async (req, res, next) => {
  try {
    res.json({ success: true, data: await systemService.status() });
  } catch (error) {
    next(error);
  }
});

export default router;
