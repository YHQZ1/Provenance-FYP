import { currentContext } from "./context.js";
import { downstreamDuration } from "./metrics.js";

export const outboundHeaders = (headers = {}) => {
  const { requestId, documentId } = currentContext();
  return {
    ...headers,
    ...(requestId && { "X-Request-ID": requestId }),
    ...(documentId && { "X-Document-ID": documentId }),
  };
};

export const outboundFetch = async (service, url, options = {}) => {
  const stop = downstreamDuration.startTimer({ service });
  try {
    const response = await fetch(url, {
      ...options,
      headers: outboundHeaders(options.headers),
    });
    stop({ outcome: response.ok ? "ok" : "error" });
    return response;
  } catch (error) {
    stop({ outcome: "error" });
    throw error;
  }
};
