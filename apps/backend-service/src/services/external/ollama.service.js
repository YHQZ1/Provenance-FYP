import { env } from "../../config/env.js";
import { createLineParser } from "../../lib/ndjson.js";

export const ollamaService = {
  configured: () => Boolean(env.OLLAMA_HOST && env.OLLAMA_MODEL),

  async streamChat(messages, { signal, onToken }) {
    const response = await fetch(`${env.OLLAMA_HOST.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages,
        stream: true,
        options: {
          temperature: 0.1,
          num_ctx: env.TRACE_NUM_CTX,
          num_predict: env.TRACE_MAX_TOKENS,
        },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(env.TRACE_TIMEOUT_MS)]),
    });
    if (!response.ok) {
      throw new Error(`The language model returned ${response.status}`);
    }

    let answer = "";
    const parser = createLineParser((part) => {
      if (part.error) throw new Error(part.error);
      const piece = part.message?.content || "";
      if (piece) {
        answer += piece;
        onToken(piece);
      }
    });
    const decoder = new TextDecoder();
    for await (const chunk of response.body) parser.push(decoder.decode(chunk, { stream: true }));
    parser.end();
    return answer.trim();
  },
};
