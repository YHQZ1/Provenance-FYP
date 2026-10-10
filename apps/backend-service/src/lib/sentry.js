import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";
import { currentContext } from "./context.js";

let active = false;

export const initSentry = () => {
  if (!env.SENTRY_DSN || active) return active;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    serverName: env.SERVICE_NAME,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  active = true;
  return true;
};

export const captureError = (error, extra = {}) => {
  if (!active) return;
  const { requestId, documentId, userId } = currentContext();
  Sentry.withScope((scope) => {
    scope.setTags({
      service: env.SERVICE_NAME,
      ...(requestId && { request_id: requestId }),
      ...((extra.documentId || documentId) && { document_id: extra.documentId || documentId }),
    });
    if (userId) scope.setUser({ id: userId });
    Sentry.captureException(error);
  });
};

export const flushSentry = (timeoutMs = 2000) => (active ? Sentry.flush(timeoutMs) : true);
