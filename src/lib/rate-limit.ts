import { isRateLimitConfigured } from "@/lib/env";

/**
 * Best-effort rate limiting via Upstash Redis (sliding window). No-op — always allows —
 * when Upstash isn't configured, so guests and unconfigured/local deploys are
 * unaffected and the build never depends on it. The Upstash SDK is imported dynamically
 * so it only loads when actually used.
 */

interface Limiter {
  limit: (id: string) => Promise<{ success: boolean }>;
}

const limiters = new Map<string, Promise<Limiter>>();

async function buildLimiter(limit: number, windowSec: number): Promise<Limiter> {
  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis"),
  ]);
  return new Ratelimit({
    redis: Redis.fromEnv(), // reads UPSTASH_REDIS_REST_URL / _TOKEN
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: "klab:rl",
    analytics: false,
  });
}

/**
 * Returns true when the request should proceed, false when the caller has exceeded the
 * window. `identifier` should be stable per actor (e.g. `progress:<userId>`).
 */
export async function allowRequest(
  identifier: string,
  opts: { limit?: number; windowSec?: number } = {},
): Promise<boolean> {
  if (!isRateLimitConfigured()) return true;
  const limit = opts.limit ?? 60;
  const windowSec = opts.windowSec ?? 60;
  const key = `${limit}:${windowSec}`;
  let limiterPromise = limiters.get(key);
  if (!limiterPromise) {
    limiterPromise = buildLimiter(limit, windowSec);
    limiters.set(key, limiterPromise);
  }
  try {
    const { success } = await (await limiterPromise).limit(identifier);
    return success;
  } catch {
    // If Redis is briefly unreachable, fail open rather than blocking legitimate writes.
    return true;
  }
}
