import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || "development";
const envPath = path.resolve(__dirname, "../../", `.env.${NODE_ENV}`);

dotenv.config({ path: envPath, quiet: true });

const requiredEnvVars = [
  "PORT",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CORS_ORIGIN",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const limitFromEnv = (name, fallback) => Math.max(parseInt(process.env[name], 10) || fallback, 1);

export const env = {
  PORT: parseInt(process.env.PORT, 10),
  NODE_ENV,
  TRUST_PROXY: Math.max(parseInt(process.env.TRUST_PROXY, 10) || 0, 0),

  SERVICE_NAME: process.env.SERVICE_NAME || "backend",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  LOG_FORMAT: process.env.LOG_FORMAT || (NODE_ENV === "production" ? "json" : "pretty"),
  METRICS_PORT: parseInt(process.env.METRICS_PORT, 10) || 9464,
  SENTRY_DSN: process.env.SENTRY_DSN || "",
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || NODE_ENV,

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  CORS_ORIGIN: process.env.CORS_ORIGIN,

  OCR_SERVICE_URL: process.env.OCR_SERVICE_URL,
  OCR_TIMEOUT_MS: parseInt(process.env.OCR_TIMEOUT_MS, 10) || 300000,
  RAG_SERVICE_URL: process.env.RAG_SERVICE_URL,
  RAG_TIMEOUT_MS: parseInt(process.env.RAG_TIMEOUT_MS, 10) || 180000,
  RAG_CONCURRENCY: Math.max(parseInt(process.env.RAG_CONCURRENCY, 10) || 2, 1),
  REGULATORY_RAG_URL: process.env.REGULATORY_RAG_URL,
  REGULATORY_RAG_TIMEOUT_MS: parseInt(process.env.REGULATORY_RAG_TIMEOUT_MS, 10) || 180000,

  UPLOAD_TEMP_DIR: process.env.UPLOAD_TEMP_DIR || "./uploads",
  USE_MOCK_SERVICES: process.env.USE_MOCK_SERVICES === "true",

  REDIS_URL: process.env.REDIS_URL || "",
  PROCESSING_CONCURRENCY: Math.max(parseInt(process.env.PROCESSING_CONCURRENCY, 10) || 2, 1),
  PROCESSING_ATTEMPTS: Math.max(parseInt(process.env.PROCESSING_ATTEMPTS, 10) || 3, 1),
  RUN_WORKER: process.env.RUN_WORKER !== "false",
  OLLAMA_HOST: process.env.OLLAMA_HOST || "",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || "",
  TRACE_TIMEOUT_MS: parseInt(process.env.TRACE_TIMEOUT_MS, 10) || 180000,
  TRACE_NUM_CTX: parseInt(process.env.TRACE_NUM_CTX, 10) || 4096,
  TRACE_MAX_TOKENS: parseInt(process.env.TRACE_MAX_TOKENS, 10) || 400,
  TRACE_RATE_LIMIT: limitFromEnv("TRACE_RATE_LIMIT", 20),

  RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED !== "false",
  RATE_LIMIT_IP: limitFromEnv("RATE_LIMIT_IP", 600),
  RATE_LIMIT_USER: limitFromEnv("RATE_LIMIT_USER", 300),
  RATE_LIMIT_WRITES: limitFromEnv("RATE_LIMIT_WRITES", 120),
  RATE_LIMIT_AUTH_SYNC: limitFromEnv("RATE_LIMIT_AUTH_SYNC", 20),
  RATE_LIMIT_UPLOAD: limitFromEnv("RATE_LIMIT_UPLOAD", 30),
  RATE_LIMIT_UPLOAD_BURST: limitFromEnv("RATE_LIMIT_UPLOAD_BURST", 10),
  MAX_PENDING_DOCUMENTS: limitFromEnv("MAX_PENDING_DOCUMENTS", 25),
  RATE_LIMIT_RETRY: limitFromEnv("RATE_LIMIT_RETRY", 20),
  RATE_LIMIT_BULK_APPROVE: limitFromEnv("RATE_LIMIT_BULK_APPROVE", 20),
  RATE_LIMIT_FILING: limitFromEnv("RATE_LIMIT_FILING", 10),
  RATE_LIMIT_REGULATORY: limitFromEnv("RATE_LIMIT_REGULATORY", 20),
  RATE_LIMIT_REGULATORY_REVIEW: limitFromEnv("RATE_LIMIT_REGULATORY_REVIEW", 10),
  RATE_LIMIT_STATUS: limitFromEnv("RATE_LIMIT_STATUS", 30),
  RATE_LIMIT_ADMIN_FAILURES: limitFromEnv("RATE_LIMIT_ADMIN_FAILURES", 10),

  EPR_PORTAL_URL: process.env.EPR_PORTAL_URL || "",
  EPR_GUIDANCE_MANUAL_URL: process.env.EPR_GUIDANCE_MANUAL_URL || "",
  ADMIN_USER: process.env.ADMIN_USER || "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",
};
