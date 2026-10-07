const required = (name, value) => {
  if (!value)
    throw new Error(
      `Missing ${name}. Copy apps/web-app/.env.example to .env.development and fill it in.`,
    );
  return value;
};

export const API_URL = required("VITE_API_URL", import.meta.env.VITE_API_URL);
export const EPR_PORTAL_URL = import.meta.env.VITE_EPR_PORTAL_URL || "";
