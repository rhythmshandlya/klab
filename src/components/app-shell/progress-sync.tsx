"use client";

import { useEffect } from "react";

import { useLabsStore } from "@/features/playground/labs-store";
import { useSession } from "@/lib/auth/client";
import { bindSyncListeners, setIdentity } from "@/lib/storage/progress-store";

/**
 * Bridges the auth session to the progress store: tells the store who's signed in so
 * it reads/writes the right cache and syncs to the server. Rendered only when auth is
 * enabled (see AppShell), so guests never mount it and never call the session hook.
 * Renders nothing.
 */
export function ProgressSync() {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    bindSyncListeners();
  }, []);

  useEffect(() => {
    if (isPending) return;
    void Promise.all([setIdentity(userId), useLabsStore.getState().setIdentity(userId)]);
  }, [isPending, userId]);

  return null;
}

/** Initializes guest-only data stores when accounts are disabled for a deployment. */
export function GuestDataSync() {
  useEffect(() => {
    void useLabsStore.getState().setIdentity(null);
  }, []);
  return null;
}
