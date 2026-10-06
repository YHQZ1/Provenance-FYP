import { regulatoryService } from "../services/external/regulatory.service.js";

export const regulatoryController = {
  async sources(req, res, next) {
    try {
      res.json({ success: true, data: await regulatoryService.sources() });
    } catch (error) {
      next(error);
    }
  },

  async query(req, res, next) {
    try {
      const data = await regulatoryService.query(req.body?.query);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};
