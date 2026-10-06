import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/sync", authController.syncUser);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.getCurrentUser);

export default router;
