import { env } from "../config/env.js";
import { documentService } from "../services/internal/document.service.js";
import { AppError } from "../utils/errors.js";

export const assertQueueRoom = async (req, res, next) => {
  try {
    if (env.RATE_LIMIT_ENABLED) {
      const waiting = await documentService.countProcessing(req.user.id);
      if (waiting >= env.MAX_PENDING_DOCUMENTS) {
        throw new AppError(
          429,
          `${waiting} of your documents are still being processed. Wait for some to finish, then upload more.`,
          "QUEUE_FULL",
        );
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};
