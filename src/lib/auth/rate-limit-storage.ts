import { Redis } from "@upstash/redis";

import { getRateLimitConfig } from "@/lib/env";

/**
 * Better Auth's built-in limiter is memory-backed by default, which is not shared by
 * serverless instances. When Upstash is present, this atomic counter makes auth limits
 * deployment-wide. The non-atomic methods satisfy Better Auth's compatibility surface;
 * current Better Auth calls `consume` directly.
 */
export function createAuthRateLimitStorage() {
  const config = getRateLimitConfig();
  if (!config) return undefined;

  const redis = new Redis(config);
  const storageKey = (key: string) => `klab:auth:rl:${key}`;

  return {
    async get(key: string) {
      return redis.get<{ key: string; count: number; lastRequest: number }>(storageKey(key));
    },
    async set(key: string, value: { key: string; count: number; lastRequest: number }) {
      await redis.set(storageKey(key), value, { ex: 60 });
    },
    async consume(key: string, rule: { window: number; max: number }) {
      const result = (await redis.eval(
        `local current = redis.call("GET", KEYS[1])
         if not current then
           redis.call("SET", KEYS[1], 1, "EX", ARGV[1])
           return {1, ARGV[1]}
         end
         local count = tonumber(current)
         local ttl = redis.call("TTL", KEYS[1])
         if count >= tonumber(ARGV[2]) then return {0, ttl} end
         redis.call("INCR", KEYS[1])
         return {1, ttl}`,
        [storageKey(key)],
        [rule.window, rule.max],
      )) as [number, number];

      return {
        allowed: result[0] === 1,
        retryAfter: result[0] === 1 ? null : Math.max(1, result[1]),
      };
    },
  };
}
