import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { regulatoryController } from "../controllers/regulatory.controller.js";

const router = Router();

router.use(authenticate);
router.post("/query", regulatoryController.query);

export default router;
