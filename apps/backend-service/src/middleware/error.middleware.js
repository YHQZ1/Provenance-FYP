import { env } from "../config/env.js";

export const errorHandler = (err, req, res, next) => {
  const isDev = env.NODE_ENV === "development";

  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large. Maximum size is 10 MB."
          : `Upload error: ${err.message}`,
    });
  }

  const statusCode = err.status || err.statusCode || 500;

  if (statusCode >= 500) {
    console.error(`Error [${statusCode}]:`, err.message);
    if (isDev && err.stack) console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message: isDev || statusCode < 500 ? err.message : "Internal server error",
    ...(err.code && { code: err.code }),
    ...(err.details && { details: err.details }),
  });
};

export const notFound = (req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`);
  error.status = 404;
  next(error);
};
