"use client";

import { useState } from "react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { icons } from "@/components/icons";
import { BRAND } from "@/config/brand";
import type { AuthCapabilities } from "@/lib/env";

export function HeaderEntryAction({
  authEnabled,
  authCapabilities,
  destination,
}: {
  authEnabled: boolean;
  authCapabilities: AuthCapabilities;
  destination: string;
}) {
  const [signInOpen, setSignInOpen] = useState(false);

  if (!authEnabled) {
    return (
      <a
        href="#start"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-semibold"
      >
        Try as guest
        <icons.arrowRight className="size-3.5" aria-hidden />
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSignInOpen(true)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-app inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <icons.user className="size-3.5" aria-hidden />
        Log in
      </button>
      <SignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
        capabilities={authCapabilities}
        callbackURL={destination}
      />
    </>
  );
}

export function EntryActions({
  authEnabled,
  authCapabilities,
  destination,
  variant = "hero",
}: {
  authEnabled: boolean;
  authCapabilities: AuthCapabilities;
  destination: string;
  variant?: "hero" | "cta";
}) {
  const [signInOpen, setSignInOpen] = useState(false);
  const [guestPending, setGuestPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Run = icons.run;
  const signInLabel = variant === "cta" ? `Log in to ${BRAND.name}` : "Log in to save progress";
  const guestLabel = variant === "cta" ? "Continue as guest" : "Try as guest";

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
            {signInLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void enterAsGuest()}
          disabled={guestPending}
          className="border-border bg-panel text-foreground hover:border-border-strong hover:bg-panel-hover focus-visible:ring-ring focus-visible:ring-offset-app inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
        >
          <Run className="size-4" aria-hidden />
          {guestPending ? `Entering ${BRAND.name}...` : guestLabel}
        </button>
      </div>
      <p className="text-subtle mt-3 text-xs">
        {variant === "cta"
          ? "No installation. Guest work stays in this browser."
          : "Guest work stays here. Sign in to sync across devices."}
      </p>
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
