export class AppError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, message, "BAD_REQUEST", details);
export const notFound = (message = "Not found") => new AppError(404, message, "NOT_FOUND");
export const conflict = (message, details) => new AppError(409, message, "CONFLICT", details);
export const unprocessable = (message, details) =>
  new AppError(422, message, "UNPROCESSABLE", details);
export const unavailable = (message) => new AppError(503, message, "SERVICE_UNAVAILABLE");
