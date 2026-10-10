import client from "prom-client";
import { documentQueue, queueCounts } from "../queues/document.queue.js";
import { registry } from "./metrics.js";

const STATES = ["waiting", "active", "delayed", "failed"];

export const registerQueueMetrics = () => {
  if (!documentQueue()) return false;

  new client.Gauge({
    name: "document_queue_jobs",
    help: "Documents in the processing queue by state",
    labelNames: ["state"],
    registers: [registry],
    async collect() {
      const counts = await queueCounts().catch(() => null);
      if (!counts) return;
      for (const state of STATES) this.set({ state }, counts[state] || 0);
    },
  });

  new client.Gauge({
    name: "document_queue_oldest_waiting_seconds",
    help: "Age of the document that has waited longest, 0 when nothing waits",
    registers: [registry],
    async collect() {
      const [oldest] = await documentQueue()
        .getWaiting(0, 0)
        .catch(() => []);
      this.set(oldest ? Math.max((Date.now() - oldest.timestamp) / 1000, 0) : 0);
    },
  });

  return true;
};
