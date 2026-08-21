import { regulatoryService } from "../services/external/regulatory.service.js";

export const regulatoryController = {
  async query(req, res, next) {
    try {
      const data = await regulatoryService.query(req.body?.query);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
