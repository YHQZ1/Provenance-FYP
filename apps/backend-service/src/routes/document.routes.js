import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { uploadMiddleware, handleUploadError } from "../middleware/upload.middleware.js";
import { accountLimits, limits } from "../middleware/rate-limit.middleware.js";
import { assertQueueRoom } from "../middleware/queue-limit.middleware.js";
import { documentController } from "../controllers/document.controller.js";

const router = Router();

router.use(authenticate, accountLimits);

router.post(
  "/upload",
  limits.uploadBurst,
  limits.upload,
  assertQueueRoom,
  uploadMiddleware.single("file"),
  handleUploadError,
  documentController.upload,
);
router.get("/", documentController.list);
router.get("/:id", documentController.getById);
router.patch("/:id", documentController.update);
router.post("/:id/retry", limits.retry, assertQueueRoom, documentController.retry);
router.delete("/:id", documentController.deleteDocument);

export default router;
