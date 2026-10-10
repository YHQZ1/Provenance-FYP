import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Run the suite with: make e2e`);
  }
  return value;
};

const supabaseUrl = required("E2E_SUPABASE_URL");
const anonKey = required("E2E_SUPABASE_ANON_KEY");
const serviceRoleKey = required("E2E_SUPABASE_SERVICE_ROLE_KEY");

const apiPort = process.env.E2E_API_PORT || "3100";
const webPort = process.env.E2E_WEB_PORT || "5174";
const apiUrl = `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;
const backendDir = path.resolve(import.meta.dirname, "../backend-service");

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: webUrl,
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node src/server.js",
      cwd: backendDir,
      url: `${apiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: "test",
        PORT: apiPort,
        SUPABASE_URL: supabaseUrl,
        SUPABASE_ANON_KEY: anonKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        CORS_ORIGIN: webUrl,
        USE_MOCK_SERVICES: "true",
        REDIS_URL: "",
        UPLOAD_TEMP_DIR: path.join(os.tmpdir(), "provenance-e2e-uploads"),
        LOG_LEVEL: "warn",
      },
    },
    {
      command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${webPort} --strictPort`,
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_API_URL: apiUrl,
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_ANON_KEY: anonKey,
        VITE_SITE_URL: webUrl,
      },
    },
  ],
});
