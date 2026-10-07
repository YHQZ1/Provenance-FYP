import { env } from "../config/env.js";
import { schema } from "../config/schema.js";
import { redisStatus } from "../config/redis.js";
import { queueCounts } from "../queues/document.queue.js";
import { cache } from "../config/redis.js";

const CACHE_MS = 15000;
let cached = null;

const ping = async (name, baseUrl, interpret) => {
  if (!baseUrl) return { name, status: "not_configured" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { name, status: "down", detail: `HTTP ${response.status}` };
    return { name, ...interpret(body) };
  } catch (error) {
    return {
      name,
      status: "down",
      detail: error.name === "AbortError" ? "No response within 4s" : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const fromStatus = (body) => {
  const status = body.status === "healthy" || body.status === "ok" ? "up" : "degraded";
  const problems = (body.services || [])
    .filter((service) => service.status !== "healthy")
    .map((service) => `${service.service}: ${service.error || service.status}`);
  return { status, ...(problems.length && { detail: problems.join("; ") }) };
};

// Redis carries the processing queue; without it documents are processed in the API process.
const queueService = async () => {
  const redis = await redisStatus();
  if (redis.status === "not_configured") {
    return { name: "queue", status: "degraded", detail: "No Redis: documents process in the API and stop if it restarts" };
  }
  if (redis.status !== "up") return { name: "queue", ...redis };
  try {
    const counts = await queueCounts();
    const waiting = counts.waiting + counts.delayed;
    return {
      name: "queue",
      status: "up",
      detail: `${counts.active} processing, ${waiting} waiting${counts.failed ? `, ${counts.failed} failed in the last week` : ""}`,
    };
  } catch (error) {
    return { name: "queue", status: "down", detail: error.message };
  }
};

// Lets the UI explain why processing or research is unavailable instead of failing silently.
export const systemService = {
  async status() {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
    // Shared through Redis so several API processes don't each ping every service.
    const shared = await cache.get(cache.key("system", "status"));
    if (shared) {
      cached = { at: Date.now(), value: shared };
      return shared;
    }

    const [ocr, classifier, regulatory, queue, capabilities] = await Promise.all([
      ping("ocr", env.OCR_SERVICE_URL, fromStatus),
      ping("classifier", env.RAG_SERVICE_URL, fromStatus),
      ping("regulatory", env.REGULATORY_RAG_URL, fromStatus),
      queueService(),
      schema(),
    ]);

    const value = {
      mock_services: env.USE_MOCK_SERVICES,
      services: env.USE_MOCK_SERVICES
        ? [ocr, classifier, regulatory].map((s) => ({ ...s, status: "mocked" })).concat(queue)
        : [ocr, classifier, regulatory, queue],
      features: {
        finalization: capabilities.fyFilings,
        category_tracking: capabilities.classificationCategory,
        activity_log: capabilities.activityLog,
        obligations: capabilities.obligations,
        trade_names: capabilities.tradeNames,
      },
      checked_at: new Date().toISOString(),
    };
    cached = { at: Date.now(), value };
    await cache.set(cache.key("system", "status"), value, CACHE_MS / 1000);
    return value;
  },
};
