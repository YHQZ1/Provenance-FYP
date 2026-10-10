import { readEnv } from "./env";

let sentry = null;

export const initMonitoring = async () => {
  const dsn = readEnv("VITE_SENTRY_DSN");
  if (!dsn || sentry) return false;
  sentry = await import("@sentry/react");
  sentry.init({
    dsn,
    environment: readEnv("VITE_SENTRY_ENVIRONMENT") || import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  return true;
};

export const reportError = (error, context = {}) => {
  if (!sentry) return;
  sentry.withScope((scope) => {
    scope.setContext("details", context);
    sentry.captureException(error);
  });
};
