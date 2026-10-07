import { supabaseAdmin } from "../config/database.js";
import { cache } from "../config/redis.js";
import { hashToken, tokenCacheSeconds } from "../lib/tokens.js";
import { companyCacheKey } from "../services/internal/workspace.cache.js";

const COMPANY_CACHE_SECONDS = 300;

const readToken = (req) => {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
};

export const authCacheKey = (token) => cache.key("auth", "v1", hashToken(token));

// Verifying a token is a round trip to Supabase Auth on every request, so a verified identity is
// cached briefly (at most 60 s, never past the token's expiry). The trade-off: after "sign out of
// all devices", an already-issued token keeps working here for up to that long.
const verifiedUser = async (token) => {
  const key = authCacheKey(token);
  const cached = await cache.get(key);
  if (cached) return cached;

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const meta = user.user_metadata || {};
  const identity = {
    id: user.id,
    email: user.email,
    name: meta.full_name || meta.name || null,
  };
  const seconds = tokenCacheSeconds(token);
  if (seconds > 0) await cache.set(key, identity, seconds);
  return identity;
};

const loadCompany = (companyId) =>
  cache.wrap(companyCacheKey(companyId), COMPANY_CACHE_SECONDS, async () => {
    const { data } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    return data || null;
  }, { shouldCache: Boolean });

export const authenticate = async (req, res, next) => {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await verifiedUser(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    req.user = user;
    req.company = await loadCompany(user.id);
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export const requireCompany = (req, res, next) => {
  if (!req.company) {
    return res.status(403).json({
      success: false,
      message: "Company profile required",
    });
  }
  next();
};
