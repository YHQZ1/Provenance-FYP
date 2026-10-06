import { feedbackService } from "../services/internal/feedback.service.js";

const handle = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, ...(await fn(req)) });
  } catch (error) {
    next(error);
  }
};

export const feedbackController = {
  queue: handle(async (req) =>
    feedbackService.getReviewQueue(req.user.id, {
      documentId: req.query.document_id,
    }),
  ),
  getById: handle(async (req) => ({
    data: await feedbackService.getClassification(req.params.id, req.user.id),
  })),
  approve: handle(async (req) => ({
    data: await feedbackService.approve(req.params.id, req.user, req.body?.notes),
  })),
  correct: handle(async (req) => ({
    data: await feedbackService.correct(req.params.id, req.user, req.body || {}),
  })),
  exclude: handle(async (req) => ({
    data: await feedbackService.exclude(req.params.id, req.user, req.body?.reason),
  })),
  approveSuggested: handle(async (req) => ({
    data: await feedbackService.approveSuggested(req.user, req.body?.document_id),
  })),
};
