import { readEnv } from "./env";

const required = (name) => {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing ${name}. Set it in apps/web-app/.env.development or the deployment.`);
  }
  return value;
};

export const API_URL = required("VITE_API_URL");
export const EPR_PORTAL_URL = readEnv("VITE_EPR_PORTAL_URL");
