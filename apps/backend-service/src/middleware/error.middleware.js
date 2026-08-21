import { env } from "../config/env.js";

export const errorHandler = (err, req, res, next) => {
  const isDev = env.NODE_ENV === "development";

  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
      details: err.errors,
    });
  }

  const statusCode = err.status || err.statusCode || 500;

  console.error(`Error [${statusCode}]:`, err.message);
  if (isDev && err.stack) console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    message: isDev || statusCode < 500 ? err.message : "Internal server error",
    ...(isDev && { stack: err.stack }),
  });
};

export const notFound = (req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`);
  error.status = 404;
  next(error);
};
