import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { feedbackController } from "../controllers/feedback.controller.js";

const router = Router();

router.use(authenticate);

router.get("/queue", feedbackController.queue);
router.post("/approve-suggested", feedbackController.approveSuggested);
router.get("/:id", feedbackController.getById);
router.post("/:id/approve", feedbackController.approve);
router.post("/:id/correct", feedbackController.correct);
router.post("/:id/exclude", feedbackController.exclude);

export default router;
