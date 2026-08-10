import { z } from "zod";

/**
 * Server-only environment configuration. Values remain optional so contributors and
 * CI can run the browser-only guest build, but malformed values fail loudly instead of
 * silently disabling the production backend.
 */

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

const serverSchema = z.object({
  /** Pooled Neon connection string used by route handlers at runtime. */
  DATABASE_URL: optionalUrl,
  /** Direct (unpooled) connection string used only by drizzle-kit migrations. */
  DATABASE_URL_UNPOOLED: optionalUrl,
  /** Better Auth signing secret. At least 32 characters. */
  BETTER_AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  /** Canonical deployment origin (for example, https://klab.example.com). */
  BETTER_AUTH_URL: optionalUrl,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  /** Resend credentials enable verified email/password and magic-link login. */
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  /** Upstash Redis REST credentials enable distributed app API rate limiting. */
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  /** Vercel Marketplace names for the same Upstash REST connection. */
  KV_REST_API_URL: optionalUrl,
  KV_REST_API_TOKEN: optionalString,
  /** Enables the test-only login route used by the authed E2E project. Never set in prod. */
  E2E_TEST_LOGIN: z.preprocess(emptyToUndefined, z.enum(["1"]).optional()),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

function read(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid klab environment configuration: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as ServerEnv, {
  get: (_target, key: string) => read()[key as keyof ServerEnv],
});

/** True when a database is configured (progress/history/auth can persist server-side). */
export function hasDatabase(): boolean {
  return Boolean(read().DATABASE_URL);
}

export interface AuthCapabilities {
  github: boolean;
  email: boolean;
}

/** Login methods that have all of their credentials. Safe to serialize to the UI. */
export function getAuthCapabilities(): AuthCapabilities {
  const current = read();
  return {
    github: Boolean(current.GITHUB_CLIENT_ID && current.GITHUB_CLIENT_SECRET),
    email: Boolean(current.RESEND_API_KEY && current.EMAIL_FROM),
  };
}

/** Explicit URL is mandatory in production; local development has one safe default. */
export function getAuthBaseUrl(): string | undefined {
  return (
    read().BETTER_AUTH_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined)
  );
}

/**
 * Auth needs durable storage, a signing secret, a canonical origin, and at least one
 * fully configured login provider. Partial provider credentials never expose a UI or
 * endpoint that cannot complete successfully.
 */
export function isAuthConfigured(): boolean {
  const current = read();
  const capabilities = getAuthCapabilities();
  return Boolean(
    hasDatabase() &&
    current.BETTER_AUTH_SECRET &&
    getAuthBaseUrl() &&
    (capabilities.github || capabilities.email),
  );
}

/** True when transactional email can be sent. */
export function isEmailConfigured(): boolean {
  return getAuthCapabilities().email;
}

/** True when Upstash Redis is configured for distributed rate limiting. */
export function isRateLimitConfigured(): boolean {
  return getRateLimitConfig() !== null;
}

/** Accept both Upstash-native and Vercel Marketplace variable names. */
export function getRateLimitConfig(): { url: string; token: string } | null {
  const current = read();
  const url = current.UPSTASH_REDIS_REST_URL ?? current.KV_REST_API_URL;
  const token = current.UPSTASH_REDIS_REST_TOKEN ?? current.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}
