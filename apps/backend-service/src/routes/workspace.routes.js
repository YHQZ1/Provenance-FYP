import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { workspaceController } from "../controllers/workspace.controller.js";

// Mounted at /api, so authentication is per route: unknown /api paths must still 404.
const router = Router();

router.get("/activity", authenticate, workspaceController.activity);
router.get("/obligations", authenticate, workspaceController.obligations);
router.put("/obligations/:category", authenticate, workspaceController.updateObligation);
router.get("/materials", authenticate, workspaceController.materials);
router.post("/materials/trade-names", authenticate, workspaceController.addTradeName);
router.delete("/materials/trade-names/:id", authenticate, workspaceController.removeTradeName);

export default router;
