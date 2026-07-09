import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous, magicLink } from "better-auth/plugins";

import { getDb } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";
import { sendMagicLinkEmail, sendVerificationEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Better Auth server instance — constructed lazily via `getAuth()` so importing this
 * module never touches the database or requires env. Callers (the auth route handler,
 * server-side session reads) must gate on `isAuthConfigured()` first.
 *
 * Providers: GitHub OAuth + email/password + magic link (email via Resend). The
 * anonymous plugin enables guest→account linking; its `onLinkAccount` merges any
 * server-side anonymous data (Phase 3 wires the full localStorage merge via /api/merge).
 * `nextCookies()` MUST stay last so it can attach Set-Cookie to responses.
 */

/**
 * Kept as its own function so `cached` captures Better Auth's *precise* inferred
 * instance type (annotating it as the generic `Auth<BetterAuthOptions>` triggers a
 * variance mismatch on optional options like `appName`/`secret`).
 */
function createAuth() {
  const hasGithub = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);

  return betterAuth({
    appName: "klab",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user: u, url }) => {
        await sendVerificationEmail(u.email, url);
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user: u, url }) => {
        await sendVerificationEmail(u.email, url);
      },
    },
    socialProviders: hasGithub
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID!,
            clientSecret: env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {},
    plugins: [
      anonymous({
        onLinkAccount: async () => {
          // Server-side anonymous users carry no klab data yet. The localStorage
          // guest merge is client-driven via POST /api/merge (Phase 3), because
          // this callback runs on the server and cannot read the browser's storage.
        },
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(email, url);
        },
      }),
      nextCookies(),
    ],
  });
}

let cached: ReturnType<typeof createAuth> | null = null;

export function getAuth(): ReturnType<typeof createAuth> {
  cached ??= createAuth();
  return cached;
}
