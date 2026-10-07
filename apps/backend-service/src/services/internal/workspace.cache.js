import { cache } from "../../config/redis.js";

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

  async invalidate(companyId) {
    if (companyId) await cache.incr(versionKey(companyId));
  },

  async forgetCompany(companyId) {
    await cache.del(companyCacheKey(companyId));
    await this.invalidate(companyId);
  },
};
