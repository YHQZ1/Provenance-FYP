import axios from "axios";
import { env } from "../../config/env.js";

export const regulatoryService = {
  async query(query) {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (normalizedQuery.length < 3) {
      const error = new Error("Query must be at least 3 characters");
      error.status = 400;
      throw error;
    }

    if (!env.REGULATORY_RAG_URL) {
      const error = new Error("Regulatory RAG URL is not configured");
      error.status = 503;
      throw error;
    }

    try {
      const response = await axios.post(
        env.REGULATORY_RAG_URL.replace(/\/$/, "") + "/query",
        { query: normalizedQuery },
        { timeout: env.REGULATORY_RAG_TIMEOUT_MS },
      );

      return response.data;
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message;
      const serviceError = new Error("Regulatory RAG request failed: " + detail);
      serviceError.status = error.code === "ECONNABORTED" ? 504 : 502;
      throw serviceError;
    }
  },
};
