import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const histogram = (config) => new client.Histogram({ ...config, registers: [registry] });
const counter = (config) => new client.Counter({ ...config, registers: [registry] });

const REQUEST_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 180];
const JOB_BUCKETS = [1, 5, 10, 20, 30, 60, 120, 300, 600, 1200];

export const httpDuration = histogram({
  name: "http_request_duration_seconds",
  help: "API request duration by route and status",
  labelNames: ["method", "route", "status"],
  buckets: REQUEST_BUCKETS,
});

export const rateLimitRejections = counter({
  name: "rate_limit_rejections_total",
  help: "Requests refused with 429, by limit",
  labelNames: ["limit"],
});

export const cacheRequests = counter({
  name: "cache_requests_total",
  help: "Cache lookups by result",
  labelNames: ["result"],
});

export const downstreamDuration = histogram({
  name: "downstream_request_duration_seconds",
  help: "Calls to OCR, the classifier, regulatory research and the language model",
  labelNames: ["service", "outcome"],
  buckets: REQUEST_BUCKETS,
});

export const documentsProcessed = counter({
  name: "documents_processed_total",
  help: "Document processing attempts by outcome",
  labelNames: ["outcome"],
});

export const documentProcessingDuration = histogram({
  name: "document_processing_duration_seconds",
  help: "Time to read and classify one document",
  labelNames: ["outcome"],
  buckets: JOB_BUCKETS,
});

export const timeDownstream = async (service, fn) => {
  const stop = downstreamDuration.startTimer({ service });
  try {
    const result = await fn();
    stop({ outcome: "ok" });
    return result;
  } catch (error) {
    stop({ outcome: "error" });
    throw error;
  }
};
