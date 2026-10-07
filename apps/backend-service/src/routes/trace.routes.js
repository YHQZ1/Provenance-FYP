import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { traceController } from "../controllers/trace.controller.js";

const router = Router();

router.post("/chat", authenticate, traceController.chat);

export default router;
