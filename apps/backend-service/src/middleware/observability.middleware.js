import { randomUUID } from "node:crypto";
import { runWithContext } from "../lib/context.js";
import { logger } from "../lib/logger.js";
import { httpDuration } from "../lib/metrics.js";

const SILENT_PATHS = new Set(["/health", "/metrics"]);
const VALID_REQUEST_ID = /^[\w.-]{8,64}$/;

const routeOf = (req) => (req.route ? `${req.baseUrl}${req.route.path}` : "unmatched");

export const observeRequests = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const requestId = VALID_REQUEST_ID.test(incoming || "") ? incoming : randomUUID();
  res.setHeader("X-Request-ID", requestId);
  const started = process.hrtime.bigint();

  runWithContext({ requestId }, () => {
    res.on("finish", () => {
      if (SILENT_PATHS.has(req.path)) return;
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      const route = routeOf(req);
      httpDuration.observe({ method: req.method, route, status: res.statusCode }, seconds);
      const log = res.statusCode >= 500 ? logger.error : logger.info;
      log("request", {
        method: req.method,
        route,
        status: res.statusCode,
        duration_ms: Math.round(seconds * 1000),
      });
    });
    next();
  });
};
