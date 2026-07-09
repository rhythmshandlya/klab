"use client";

import { anonymousClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth React client. `baseURL` defaults to the current origin, so it talks to
 * our own `/api/auth/*` route handler. Plugins mirror the server (anonymous guest +
 * magic link). Guests never call this — it's only used once a user opts into signing in.
 */
export const authClient = createAuthClient({
  plugins: [anonymousClient(), magicLinkClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;
