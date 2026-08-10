import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { createAuthRateLimitStorage } from "@/lib/auth/rate-limit-storage";
import { getDb } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";
import { sendAccountDeletionEmail, sendMagicLinkEmail, sendVerificationEmail } from "@/lib/email";
import { env, getAuthBaseUrl, getAuthCapabilities, isEmailConfigured } from "@/lib/env";

/**
 * Constructed lazily so guest builds never touch the database or require secrets.
 * Local guest progress is merged client-side after a real account signs in; Better
 * Auth's anonymous-user plugin is intentionally not enabled because it would create
 * disposable database users without adding anything to that merge flow.
 */
function createAuth() {
  const capabilities = getAuthCapabilities();
  const baseURL = getAuthBaseUrl();
  const rateLimitStorage = createAuthRateLimitStorage();
  if (!baseURL) throw new Error("getAuth() called without a canonical BETTER_AUTH_URL.");

  return betterAuth({
    appName: "klab",
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    account: {
      encryptOAuthTokens: true,
      updateAccountOnSignIn: true,
    },
    emailAndPassword: capabilities.email
      ? {
          enabled: true,
          requireEmailVerification: true,
          minPasswordLength: 10,
          maxPasswordLength: 128,
          revokeSessionsOnPasswordReset: true,
          sendResetPassword: async ({ user: currentUser, url }) => {
            await sendVerificationEmail(currentUser.email, url);
          },
        }
      : { enabled: false },
    emailVerification: capabilities.email
      ? {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: async ({ user: currentUser, url }) => {
            await sendVerificationEmail(currentUser.email, url);
          },
        }
      : undefined,
    socialProviders: capabilities.github
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID!,
            clientSecret: env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {},
    user: {
      additionalFields: {
        publicProfile: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: isEmailConfigured()
          ? async ({ user: currentUser, url }) => {
              await sendAccountDeletionEmail(currentUser.email, url);
            }
          : undefined,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 10,
    },
    verification: {
      storeIdentifier: "hashed",
    },
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
      window: 60,
      max: 100,
      customStorage: rateLimitStorage,
    },
    plugins: [
      ...(capabilities.email
        ? [
            magicLink({
              expiresIn: 60 * 15,
              sendMagicLink: async ({ email, url }) => {
                await sendMagicLinkEmail(email, url);
              },
            }),
          ]
        : []),
      // Must remain last so server actions can attach Set-Cookie headers.
      nextCookies(),
    ],
  });
}

let cached: ReturnType<typeof createAuth> | null = null;

export function getAuth(): ReturnType<typeof createAuth> {
  cached ??= createAuth();
  return cached;
}
