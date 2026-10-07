import axios from "axios";
import { env } from "../../config/env.js";
import { cache } from "../../config/redis.js";
import { digest, questionCacheText } from "../../lib/cache-keys.js";
import { regulatoryTag } from "./answer-tags.js";

const ANSWER_CACHE_SECONDS = 7 * 24 * 3600;

const baseUrl = () => {
  if (!env.REGULATORY_RAG_URL) {
    const error = new Error("Regulatory research isn't configured");
    error.status = 503;
    throw error;
  }
  return env.REGULATORY_RAG_URL.replace(/\/$/, "");
};

export const regulatoryService = {
  async sources() {
    try {
      const response = await axios.get(`${baseUrl()}/sources`, { timeout: 10000 });
      return response.data.sources || [];
    } catch (error) {
      if (error.status) throw error;
      const serviceError = new Error("The regulatory library is unavailable");
      serviceError.status = 502;
      throw serviceError;
    }
  },

  async search(query, topK) {
    const response = await axios.post(
      `${baseUrl()}/search`,
      { query, top_k: topK },
      { timeout: 30000 },
    );
    return response.data;
  },

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

    const ask = async () => {
      const response = await axios.post(
        env.REGULATORY_RAG_URL.replace(/\/$/, "") + "/query",
        { query: normalizedQuery },
        { timeout: env.REGULATORY_RAG_TIMEOUT_MS },
      );
      return response.data;
    };

    try {
      const tag = await regulatoryTag();
      if (!tag) return await ask();
      const key = cache.key("answer", tag, digest(questionCacheText(normalizedQuery), 32));
      const cached = await cache.get(key);
      if (cached) return { ...cached, cached: true };
      const answer = await ask();
      if (answer?.answer && answer?.sources?.length)
        await cache.set(key, answer, ANSWER_CACHE_SECONDS);
      return answer;
    } catch (error) {
      const detail = error.response?.data?.detail || error.response?.data?.message || error.message;
      const serviceError = new Error("Regulatory RAG request failed: " + detail);
      serviceError.status = error.code === "ECONNABORTED" ? 504 : 502;
      throw serviceError;
    }
  },
};
