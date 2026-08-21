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

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-User-ID",
      "X-User-Email",
      "X-Gateway-Verified",
    ],
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (_, res) => res.json({ message: "Provenance API is running" }));
app.get("/health", (_, res) =>
  res.json({ status: "OK", timestamp: new Date().toISOString() }),
);

app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/compliance", complianceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
