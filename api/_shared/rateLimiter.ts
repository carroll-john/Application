// Per-instance sliding-window rate limiter.
//
// NOTE: on serverless this is per-warm-instance, not global — concurrent
// instances each keep their own window, so the effective limit is higher than
// `max` under load. For a hard cross-instance limit, back this with a shared
// store (e.g. Upstash/Redis or a Supabase table). It self-prunes, so memory
// is bounded by the number of currently-active keys rather than growing
// without bound.

export interface RateLimiter {
  isLimited: (key: string) => boolean;
}

export function createRateLimiter(options: {
  max: number;
  windowMs: number;
}): RateLimiter {
  const { max, windowMs } = options;
  const hits = new Map<string, number[]>();
  let lastSweepAt = 0;

  function sweep(now: number) {
    if (now - lastSweepAt < windowMs) {
      return;
    }

    lastSweepAt = now;
    const windowStart = now - windowMs;

    for (const [key, timestamps] of hits) {
      const recent = timestamps.filter((timestamp) => timestamp > windowStart);

      if (recent.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, recent);
      }
    }
  }

  return {
    isLimited(key: string) {
      const now = Date.now();
      sweep(now);

      const windowStart = now - windowMs;
      const recent = (hits.get(key) ?? []).filter(
        (timestamp) => timestamp > windowStart,
      );

      if (recent.length >= max) {
        hits.set(key, recent);
        return true;
      }

      recent.push(now);
      hits.set(key, recent);
      return false;
    },
  };
}
