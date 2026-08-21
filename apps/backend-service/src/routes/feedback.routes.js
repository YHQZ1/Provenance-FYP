import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { feedbackController } from "../controllers/feedback.controller.js";

const router = Router();

router.use(authenticate);

router.get("/pending", feedbackController.getPending);
router.get("/:id", feedbackController.getById);
router.post("/:id/verify", feedbackController.verify);
router.post("/:id/correct", feedbackController.correct);
router.post("/bulk-verify", feedbackController.bulkVerify);

export default router;
