import { env } from "../config/env.js";
import { cache } from "../config/redis.js";
import { traceService } from "../services/internal/trace/trace.service.js";
import { AppError, unavailable } from "../utils/errors.js";
import { parseTraceRequest } from "../services/internal/trace/request.js";

const RATE_WINDOW_SECONDS = 300;
const assertWithinLimit = async (userId) => {
  const windowStart = Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS);
  const used = await cache.count(
    cache.key("trace", "rate", userId, windowStart),
    RATE_WINDOW_SECONDS,
  );
  if (used !== null && used > env.TRACE_RATE_LIMIT) {
    throw new AppError(
      429,
      "You've asked Trace a lot in the last few minutes. Try again shortly.",
      "RATE_LIMITED",
    );
  }
};

export const traceController = {
  async chat(req, res, next) {
    let request;
    try {
      if (!traceService.available()) throw unavailable("Trace isn't configured on this server.");
      request = parseTraceRequest(req.body);
      await assertWithinLimit(req.user.id);
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
        console.error("[Trace]", error.message);
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
