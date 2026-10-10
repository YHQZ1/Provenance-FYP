import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { accountLimits, limits } from "../middleware/rate-limit.middleware.js";

const router = Router();

router.post("/sync", limits.authSync, authController.syncUser);
router.post("/logout", authController.logout);
router.get("/me", authenticate, accountLimits, authController.getCurrentUser);

export default router;
