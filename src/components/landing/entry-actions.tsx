"use client";

import { useState } from "react";
import Link from "next/link";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { icons } from "@/components/icons";
import type { AuthCapabilities } from "@/lib/env";

export function EntryActions({
  authEnabled,
  authCapabilities,
  destination,
}: {
  authEnabled: boolean;
  authCapabilities: AuthCapabilities;
  destination: string;
}) {
  const [signInOpen, setSignInOpen] = useState(false);
  const [guestPending, setGuestPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Run = icons.run;

  const enterAsGuest = async () => {
    setGuestPending(true);
    setError(null);
    try {
      const response = await fetch("/api/entry/guest", { method: "POST" });
      if (!response.ok) throw new Error("Guest mode could not be started.");
      window.location.assign(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Guest mode could not be started.");
      setGuestPending(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {authEnabled ? (
          <button
            type="button"
            onClick={() => setSignInOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-app inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <icons.user className="size-4" aria-hidden />
            Sign in or create account
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void enterAsGuest()}
          disabled={guestPending}
          className="border-border bg-panel text-foreground hover:border-border-strong hover:bg-panel-hover focus-visible:ring-ring focus-visible:ring-offset-app inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
        >
          <Run className="size-4" aria-hidden />
          {guestPending ? "Entering KLab…" : "Continue as guest"}
        </button>
      </div>
      <p className="text-subtle mt-3 max-w-xl text-xs leading-relaxed">
        Guest work stays in this browser. Sign in to sync progress and Playgrounds across devices.
      </p>
      <Link
        href="/community"
        className="text-blue mt-3 inline-block text-xs font-semibold hover:underline"
      >
        Browse public Kubernetes discussions
      </Link>
      {error ? (
        <p role="alert" className="text-red mt-2 text-sm">
          {error}
        </p>
      ) : null}
      {authEnabled ? (
        <SignInDialog
          open={signInOpen}
          onOpenChange={setSignInOpen}
          capabilities={authCapabilities}
          callbackURL={destination}
        />
      ) : null}
    </div>
  );
}
