import { z } from "zod";

/**
 * Environment configuration — intentionally ALL-OPTIONAL.
 *
 * klab runs as a zero-config static app for guests: with no env set, there is no
 * database, no auth, and no email — the app falls back to localStorage-only behavior
 * and the production build still succeeds (this is what keeps `pnpm build` and the
 * guest E2E green in CI, which provisions no secrets). Backend features light up
 * progressively as the matching variables are provided.
 *
 * Never throws on import. Parsing happens once, lazily, against `process.env`.
 */

const serverSchema = z.object({
  /** Pooled Neon connection string used by route handlers at runtime. */
  DATABASE_URL: z.string().url().optional(),
  /** Direct (unpooled) connection string used only by drizzle-kit migrations. */
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  /** Better Auth signing secret. Required in production once auth is enabled. */
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  /** Absolute base URL of the deployment (e.g. https://klab.dev). */
  BETTER_AUTH_URL: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  /** Resend API key for magic-link + email verification mail. */
  RESEND_API_KEY: z.string().min(1).optional(),
  /** From-address for transactional email (e.g. "klab <no-reply@klab.dev>"). */
  EMAIL_FROM: z.string().min(1).optional(),
  /** Enables the test-only login route used by the authed E2E project. Never set in prod. */
  E2E_TEST_LOGIN: z.enum(["1"]).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

function read(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  // All fields optional → parse only fails on a malformed URL/enum; fall back to {}.
  cached = parsed.success ? parsed.data : {};
  return cached;
}

export const env = new Proxy({} as ServerEnv, {
  get: (_t, key: string) => read()[key as keyof ServerEnv],
});

/** True when a database is configured (progress/history/auth can persist server-side). */
export function hasDatabase(): boolean {
  return Boolean(read().DATABASE_URL);
}

/**
 * True when auth can run: needs a database, a signing secret, and at least one login
 * method (GitHub OAuth, or email via Resend for password-reset/magic-link).
 */
export function isAuthConfigured(): boolean {
  const e = read();
  const hasSecret = Boolean(e.BETTER_AUTH_SECRET);
  const hasGithub = Boolean(e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET);
  const hasEmail = Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
  return hasDatabase() && hasSecret && (hasGithub || hasEmail);
}

/** True when transactional email can be sent (magic link, verification). */
export function isEmailConfigured(): boolean {
  const e = read();
  return Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
}
