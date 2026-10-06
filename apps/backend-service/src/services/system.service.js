import { env } from "../config/env.js";
import { schema } from "../config/schema.js";

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

// Lets the UI explain why processing or research is unavailable instead of failing silently.
export const systemService = {
  async status() {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

    const [ocr, classifier, regulatory, capabilities] = await Promise.all([
      ping("ocr", env.OCR_SERVICE_URL, fromStatus),
      ping("classifier", env.RAG_SERVICE_URL, fromStatus),
      ping("regulatory", env.REGULATORY_RAG_URL, fromStatus),
      schema(),
    ]);

    const value = {
      mock_services: env.USE_MOCK_SERVICES,
      services: env.USE_MOCK_SERVICES
        ? [ocr, classifier, regulatory].map((s) => ({ ...s, status: "mocked" }))
        : [ocr, classifier, regulatory],
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
    return value;
  },
};
