import crypto from "crypto";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { env } from "../config/env.js";
import { documentQueue } from "../queues/document.queue.js";

const BASE_PATH = "/admin/queues";

const sameSecret = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const basicAuth = (req, res, next) => {
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
