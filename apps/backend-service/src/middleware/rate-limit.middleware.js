import { env } from "../config/env.js";
import { cache } from "../config/redis.js";
import { createRateLimiter } from "../lib/rate-limit.js";
import { rateLimitRejections } from "../lib/metrics.js";
import { AppError } from "../utils/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MINUTE = 60;
const FIVE_MINUTES = 300;
const TEN_MINUTES = 600;
const HOUR = 3600;

export const clientIp = (req) => req.ip || req.socket?.remoteAddress || "unknown";

export const waitText = (seconds) => {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

export const createRateLimit =
  ({ limiter }) =>
  ({ name, max, windowSeconds, message, by = "user", skip }) =>
  async (req, res, next) => {
    if (skip?.(req)) return next();
    const id = by === "ip" ? clientIp(req) : (req.user?.id ?? clientIp(req));
    const result = await limiter.hit({ name, id, max, windowSeconds });
    if (result.allowed) return next();
    rateLimitRejections.inc({ limit: name });
    res.set({
      "Retry-After": String(result.resetSeconds),
      "RateLimit-Limit": String(result.limit),
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": String(result.resetSeconds),
    });
    return next(
      new AppError(
        429,
        `${message} Try again in ${waitText(result.resetSeconds)}.`,
        "RATE_LIMITED",
        { retry_after_seconds: result.resetSeconds },
      ),
    );
  };

export const rateLimiter = createRateLimiter({ cache, enabled: env.RATE_LIMIT_ENABLED });
const rateLimit = createRateLimit({ limiter: rateLimiter });

export const limits = {
  ip: rateLimit({
    name: "ip",
    by: "ip",
    max: env.RATE_LIMIT_IP,
    windowSeconds: MINUTE,
    message: "Too many requests from your network.",
  }),
  authSync: rateLimit({
    name: "auth-sync",
    by: "ip",
    max: env.RATE_LIMIT_AUTH_SYNC,
    windowSeconds: TEN_MINUTES,
    message: "Too many sign-in attempts.",
  }),
  user: rateLimit({
    name: "user",
    max: env.RATE_LIMIT_USER,
    windowSeconds: MINUTE,
    message: "You're making requests too quickly.",
  }),
  writes: rateLimit({
    name: "writes",
    max: env.RATE_LIMIT_WRITES,
    windowSeconds: MINUTE,
    message: "You're making changes too quickly.",
    skip: (req) => SAFE_METHODS.has(req.method),
  }),
  upload: rateLimit({
    name: "upload",
    max: env.RATE_LIMIT_UPLOAD,
    windowSeconds: HOUR,
    message: "You've uploaded a lot of documents this hour.",
  }),
  uploadBurst: rateLimit({
    name: "upload-burst",
    max: env.RATE_LIMIT_UPLOAD_BURST,
    windowSeconds: MINUTE,
    message: "You're uploading too quickly.",
  }),
  retry: rateLimit({
    name: "retry",
    max: env.RATE_LIMIT_RETRY,
    windowSeconds: TEN_MINUTES,
    message: "You've retried a lot of documents.",
  }),
  bulkApprove: rateLimit({
    name: "bulk-approve",
    max: env.RATE_LIMIT_BULK_APPROVE,
    windowSeconds: TEN_MINUTES,
    message: "You've approved suggestions in bulk a lot.",
  }),
  filing: rateLimit({
    name: "filing",
    max: env.RATE_LIMIT_FILING,
    windowSeconds: TEN_MINUTES,
    message: "You've finalized or reopened filings a lot.",
  }),
  regulatory: rateLimit({
    name: "regulatory",
    max: env.RATE_LIMIT_REGULATORY,
    windowSeconds: FIVE_MINUTES,
    message: "You've asked a lot of regulatory questions.",
  }),
  regulatoryReview: rateLimit({
    name: "regulatory-review",
    max: env.RATE_LIMIT_REGULATORY_REVIEW,
    windowSeconds: TEN_MINUTES,
    message: "You've requested a lot of regulatory reviews.",
  }),
  status: rateLimit({
    name: "status",
    max: env.RATE_LIMIT_STATUS,
    windowSeconds: MINUTE,
    message: "You're checking system status too often.",
  }),
  trace: rateLimit({
    name: "trace",
    max: env.TRACE_RATE_LIMIT,
    windowSeconds: FIVE_MINUTES,
    message: "You've asked Trace a lot in the last few minutes.",
  }),
};

export const accountLimits = [limits.user, limits.writes];

export const adminFailureLimit = {
  name: "admin-auth",
  max: env.RATE_LIMIT_ADMIN_FAILURES,
  windowSeconds: FIVE_MINUTES,
};
