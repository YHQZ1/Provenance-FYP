import { Router } from "express";
import { companyController } from "../controllers/company.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { accountLimits } from "../middleware/rate-limit.middleware.js";

const router = Router();

router.use(authenticate, accountLimits);

router.post("/", companyController.createCompany);
router.patch("/", companyController.updateCompany);
router.get("/me", companyController.getMyCompany);
router.get("/:id", companyController.getCompanyById);

export default router;
