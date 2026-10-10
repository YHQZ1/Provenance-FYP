import { traceService } from "../services/internal/trace/trace.service.js";
import { unavailable } from "../utils/errors.js";
import { logger } from "../lib/logger.js";
import { captureError } from "../lib/sentry.js";
import { parseTraceRequest } from "../services/internal/trace/request.js";

export const traceController = {
  async chat(req, res, next) {
    let request;
    try {
      if (!traceService.available()) throw unavailable("Trace isn't configured on this server.");
      request = parseTraceRequest(req.body);
    } catch (error) {
      return next(error);
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      const result = await traceService.respond({
        userId: req.user.id,
        ...request,
        signal: controller.signal,
        onToken: (text) => send("token", { text }),
      });
      send("done", { links: result.links, sources: result.sources });
    } catch (error) {
      if (!controller.signal.aborted) {
        logger.error("trace failed", { error });
        captureError(error);
        send("error", {
          message:
            error.name === "TimeoutError"
              ? "Trace took too long to answer. Try a shorter question."
              : "Trace couldn't answer right now. Check that the language model is running.",
        });
      }
    }
    res.end();
  },
};
