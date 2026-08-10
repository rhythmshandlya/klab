"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Same-origin Better Auth client. Guest progress remains local and is merged after a
 * real account signs in; it never creates disposable anonymous database users.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const {
  useSession,
  signIn,
  signOut,
  signUp,
  updateUser,
  changePassword,
  deleteUser,
  requestPasswordReset,
  resetPassword,
} = authClient;
