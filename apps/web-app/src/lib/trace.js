import { API_URL } from "./config";
import { createEventParser } from "./sse";
import { supabase } from "./supabase";

export const askTrace = async ({ message, history, context, signal, onToken }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`${API_URL}/api/trace/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ message, history, context }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Trace couldn't answer right now.");
  }

  let result = { links: [], sources: [] };
  let failure = null;
  const parser = createEventParser((event, payload) => {
    if (event === "token") onToken(payload.text);
    else if (event === "done") result = payload;
    else if (event === "error") failure = payload.message;
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.end();
  if (failure) throw new Error(failure);
  return result;
};
