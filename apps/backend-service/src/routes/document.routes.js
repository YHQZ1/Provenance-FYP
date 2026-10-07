import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { uploadMiddleware, handleUploadError } from "../middleware/upload.middleware.js";
import { documentController } from "../controllers/document.controller.js";

const router = Router();

router.use(authenticate);

router.post(
  "/upload",
  uploadMiddleware.single("file"),
  handleUploadError,
  documentController.upload,
);
router.get("/", documentController.list);
router.get("/:id", documentController.getById);
router.patch("/:id", documentController.update);
router.post("/:id/retry", documentController.retry);
router.delete("/:id", documentController.deleteDocument);

export default router;
