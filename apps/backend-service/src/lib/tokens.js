import crypto from "crypto";

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const tokenCacheSeconds = (token, nowSeconds = Date.now() / 1000, max = 60) => {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    const remaining = Math.floor(Number(payload.exp) - nowSeconds) - 5;
    return Number.isFinite(remaining) ? Math.max(0, Math.min(max, remaining)) : 0;
  } catch {
    return 0;
  }
};
