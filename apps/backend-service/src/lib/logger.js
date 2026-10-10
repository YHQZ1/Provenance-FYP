import { env } from "../config/env.js";
import { currentContext } from "./context.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const contextFields = (context) => ({
  ...(context.requestId && { request_id: context.requestId }),
  ...(context.documentId && { document_id: context.documentId }),
  ...(context.userId && { user_id: context.userId }),
});

const expand = (fields) => {
  const { error, ...rest } = fields;
  if (!error) return rest;
  if (error instanceof Error) {
    return { ...rest, error: error.message, ...(error.stack && { stack: error.stack }) };
  }
  return { ...rest, error: String(error) };
};

const pretty = (entry) => {
  const { time, level, service, msg, request_id: requestId, ...rest } = entry;
  const fields = Object.entries(rest)
    .filter(([key]) => key !== "stack")
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ");
  const tag = requestId ? ` [${requestId.slice(0, 8)}]` : "";
  return `${time.slice(11, 19)} ${level.toUpperCase().padEnd(5)}${tag} ${msg}${fields ? ` ${fields}` : ""}`;
};

export const createLogger = ({
  service = env.SERVICE_NAME,
  level = env.LOG_LEVEL,
  format = env.LOG_FORMAT,
  write = (line) => process.stdout.write(`${line}\n`),
  context = currentContext,
} = {}) => {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const emit = (name, msg, fields = {}) => {
    if (LEVELS[name] < threshold) return;
    const entry = {
      time: new Date().toISOString(),
      level: name,
      service,
      msg,
      ...contextFields(context()),
      ...expand(fields),
    };
    write(format === "json" ? JSON.stringify(entry) : pretty(entry));
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
  };
};

export const logger = createLogger();
