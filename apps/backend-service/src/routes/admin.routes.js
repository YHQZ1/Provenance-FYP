import crypto from "crypto";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { env } from "../config/env.js";
import { documentQueue } from "../queues/document.queue.js";
import { rateLimitRejections } from "../lib/metrics.js";
import {
  adminFailureLimit,
  clientIp,
  rateLimiter,
  waitText,
} from "../middleware/rate-limit.middleware.js";

const BASE_PATH = "/admin/queues";

const sameSecret = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const basicAuth = async (req, res, next) => {
  const ip = clientIp(req);
  const lockout = await rateLimiter.peek({ ...adminFailureLimit, id: ip });
  if (lockout.exceeded) {
    rateLimitRejections.inc({ limit: adminFailureLimit.name });
    res.set("Retry-After", String(lockout.resetSeconds));
    return res
      .status(429)
      .send(`Too many failed attempts. Try again in ${waitText(lockout.resetSeconds)}.`);
  }
  const [scheme, encoded] = (req.headers.authorization || "").split(" ");
  const [user, ...rest] = Buffer.from(encoded || "", "base64")
    .toString()
    .split(":");
  if (
    scheme === "Basic" &&
    sameSecret(user, env.ADMIN_USER) &&
    sameSecret(rest.join(":"), env.ADMIN_PASSWORD)
  ) {
    return next();
  }
  await rateLimiter.hit({ ...adminFailureLimit, id: ip });
  res.set("WWW-Authenticate", 'Basic realm="Provenance queues"');
  return res.status(401).send("Authentication required");
};

export const mountQueueDashboard = (app) => {
  const queue = documentQueue();
  if (!queue || !env.ADMIN_USER || !env.ADMIN_PASSWORD) return false;
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BASE_PATH);
  createBullBoard({ queues: [new BullMQAdapter(queue)], serverAdapter });
  app.use(BASE_PATH, basicAuth, serverAdapter.getRouter());
  return true;
};
