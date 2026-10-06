import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || "development";
const envPath = path.resolve(__dirname, "../../", `.env.${NODE_ENV}`);

dotenv.config({ path: envPath });

const requiredEnvVars = [
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

export const env = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV,

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
};