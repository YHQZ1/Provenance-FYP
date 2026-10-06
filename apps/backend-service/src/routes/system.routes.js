import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { systemService } from "../services/system.service.js";

const router = Router();

router.get("/status", authenticate, async (req, res, next) => {
  try {
    res.json({ success: true, data: await systemService.status() });
  } catch (error) {
    next(error);
  }
});

export default router;
