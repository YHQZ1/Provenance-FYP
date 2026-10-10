import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { accountLimits } from "../middleware/rate-limit.middleware.js";
import { workspaceController } from "../controllers/workspace.controller.js";

const router = Router();
const guard = [authenticate, ...accountLimits];

router.get("/activity", ...guard, workspaceController.activity);
router.get("/obligations", ...guard, workspaceController.obligations);
router.put("/obligations/:category", ...guard, workspaceController.updateObligation);
router.get("/materials", ...guard, workspaceController.materials);
router.post("/materials/trade-names", ...guard, workspaceController.addTradeName);
router.delete("/materials/trade-names/:id", ...guard, workspaceController.removeTradeName);

export default router;
