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
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,

  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID,
  MICROSOFT_SECRET_VALUE: process.env.MICROSOFT_SECRET_VALUE,
  MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI,

  CORS_ORIGIN: process.env.CORS_ORIGIN,
  FRONTEND_URL: process.env.FRONTEND_URL,

  OCR_SERVICE_URL: process.env.OCR_SERVICE_URL,
  RAG_SERVICE_URL: process.env.RAG_SERVICE_URL,
  BACKEND_WEBHOOK_URL: process.env.BACKEND_WEBHOOK_URL,

  UPLOAD_TEMP_DIR: process.env.UPLOAD_TEMP_DIR || "./uploads",
  USE_MOCK_SERVICES: process.env.USE_MOCK_SERVICES === "true",
};