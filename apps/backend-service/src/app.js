import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import documentRoutes from "./routes/document.routes.js";
import companyRoutes from "./routes/company.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import complianceRoutes from "./routes/compliance.routes.js";
import regulatoryRoutes from "./routes/regulatory.routes.js";
import systemRoutes from "./routes/system.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import traceRoutes from "./routes/trace.routes.js";
import { mountQueueDashboard } from "./routes/admin.routes.js";
import { limits } from "./middleware/rate-limit.middleware.js";

const app = express();
app.set("trust proxy", env.TRUST_PROXY);
const configuredOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || configuredOrigins.includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
    optionsSuccessStatus: 204,
  }),
);

app.use("/api", limits.ip);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/", (_, res) => res.json({ message: "Provenance API is running" }));
app.get("/health", (_, res) => res.json({ status: "OK", timestamp: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/regulatory", regulatoryRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/trace", traceRoutes);
app.use("/api", workspaceRoutes);
mountQueueDashboard(app);

app.use(notFound);
app.use(errorHandler);

export default app;
