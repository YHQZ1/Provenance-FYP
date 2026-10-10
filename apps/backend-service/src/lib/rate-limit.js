export const createRateLimiter = ({ cache, now = Date.now, enabled = true }) => {
  const seconds = () => Math.floor(now() / 1000);

  const slot = (windowSeconds) => {
    const index = Math.floor(seconds() / windowSeconds);
    return { index, resetSeconds: (index + 1) * windowSeconds - seconds() };
  };

  const verdict = (used, max, resetSeconds) => ({
    allowed: used === null || used <= max,
    used,
    limit: max,
    remaining: used === null ? max : Math.max(max - used, 0),
    resetSeconds,
  });

  return {
    async hit({ name, id, max, windowSeconds }) {
      const { index, resetSeconds } = slot(windowSeconds);
      if (!enabled) return verdict(null, max, resetSeconds);
      const used = await cache.count(cache.key("rate", name, id, index), windowSeconds);
      return verdict(used, max, resetSeconds);
    },

    async peek({ name, id, max, windowSeconds }) {
      const { index, resetSeconds } = slot(windowSeconds);
      const used = enabled ? await cache.get(cache.key("rate", name, id, index)) : null;
      return { exceeded: typeof used === "number" && used >= max, resetSeconds };
    },
  };
};
