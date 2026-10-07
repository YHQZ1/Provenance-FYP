import { cache } from "../../config/redis.js";

// Cached views of a company's data (filing summary, obligations) are keyed by a per-company data
// version. Every write that can change them bumps the version, so a stale entry is never read
// again; it simply expires. If Redis is unavailable the version is unknown and nothing is cached.
const versionKey = (companyId) => cache.key("ver", companyId);

const currentVersion = async (companyId) => {
  const version = await cache.get(versionKey(companyId));
  if (version !== null) return version;
  return cache.incr(versionKey(companyId));
};

export const companyCacheKey = (companyId) => cache.key("company", "v1", companyId);

export const workspaceCache = {
  async wrap(companyId, parts, ttlSeconds, compute) {
    const version = await currentVersion(companyId);
    if (version === null) return compute();
    return cache.wrap(cache.key(...parts, companyId, `v${version}`), ttlSeconds, compute);
  },

  // Call after any write that changes documents, lines, filings, the profile or obligation inputs.
  async invalidate(companyId) {
    if (companyId) await cache.incr(versionKey(companyId));
  },

  // The company row cached by the auth middleware; clear it after creating or updating it.
  async forgetCompany(companyId) {
    await cache.del(companyCacheKey(companyId));
    await this.invalidate(companyId);
  },
};
