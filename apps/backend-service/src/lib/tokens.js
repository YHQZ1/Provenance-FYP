import crypto from "crypto";

// Cache keys never contain the token itself.
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// How long a verified token's identity may be cached: at most `max` seconds and never past the
// token's own expiry. Zero means don't cache. The payload is only read here, not trusted: the
// token was verified by Supabase before anything is cached.
export const tokenCacheSeconds = (token, nowSeconds = Date.now() / 1000, max = 60) => {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    const remaining = Math.floor(Number(payload.exp) - nowSeconds) - 5;
    return Number.isFinite(remaining) ? Math.max(0, Math.min(max, remaining)) : 0;
  } catch {
    return 0;
  }
};
