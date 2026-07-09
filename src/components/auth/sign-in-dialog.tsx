"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { icons } from "@/components/icons";
import { signIn, signUp } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";

/**
 * Sign-in / create-account dialog. Three ways in: GitHub OAuth (primary for a dev
 * tool), email + password, or a passwordless magic link. On success the session
 * updates via Better Auth's store and the dialog closes; existing localStorage guest
 * progress is merged into the account separately (Phase 3).
 *
 * Live sign-in requires the backend to be configured (DATABASE_URL + secret + a
 * provider); this component only renders when the nav decides auth is enabled.
 */

type Mode = "signin" | "signup" | "magic";

export function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const github = async () => {
    reset();
    setPending(true);
    const callbackURL = typeof window === "undefined" ? "/problems" : window.location.pathname;
    const res = await signIn.social({ provider: "github", callbackURL });
    // On success the browser is redirected to GitHub; only errors return here.
    if (res?.error) {
      setError(res.error.message ?? "GitHub sign-in failed.");
      setPending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    setPending(true);
    try {
      if (mode === "magic") {
        const callbackURL =
          typeof window === "undefined" ? "/problems" : window.location.pathname;
        const res = await signIn.magicLink({ email, callbackURL });
        if (res?.error) setError(res.error.message ?? "Could not send the link.");
        else setNotice("Check your email for a sign-in link.");
      } else if (mode === "signup") {
        const res = await signUp.email({ email, password, name: name || email.split("@")[0]! });
        if (res?.error) setError(res.error.message ?? "Could not create the account.");
        else onOpenChange(false);
      } else {
        const res = await signIn.email({ email, password });
        if (res?.error) setError(res.error.message ?? "Incorrect email or password.");
        else onOpenChange(false);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="anim-content border-border-strong bg-panel-elevated fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.7)]">
          <Dialog.Title className="text-foreground text-lg font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Sign in to klab"}
          </Dialog.Title>
          <Dialog.Description className="text-muted mt-1 text-sm">
            Sync your progress and history across devices. Your guest progress carries over.
          </Dialog.Description>

          <button
            type="button"
            onClick={() => void github()}
            disabled={pending}
            className="border-border bg-panel text-foreground hover:bg-panel-hover focus-visible:ring-ring mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <icons.endpointSlice className="size-4" aria-hidden />
            Continue with GitHub
          </button>

          <div className="my-4 flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-subtle text-xs">or</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <form onSubmit={submit} className="space-y-2.5">
            {mode === "signup" ? (
              <Field
                label="Name"
                name="name"
                value={name}
                onChange={setName}
                type="text"
                autoComplete="name"
              />
            ) : null}
            <Field
              label="Email"
              name="email"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
              required
            />
            {mode !== "magic" ? (
              <Field
                label="Password"
                name="password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
              />
            ) : null}

            {error ? <p className="text-red text-xs">{error}</p> : null}
            {notice ? <p className="text-green text-xs">{notice}</p> : null}

            <button
              type="submit"
              disabled={pending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              {pending
                ? "…"
                : mode === "magic"
                  ? "Send magic link"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
            </button>
          </form>

          <div className="text-subtle mt-4 flex flex-wrap justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                reset();
                setMode(mode === "signup" ? "signin" : "signup");
              }}
              className="hover:text-foreground transition-colors"
            >
              {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setMode(mode === "magic" ? "signin" : "magic");
              }}
              className="hover:text-foreground transition-colors"
            >
              {mode === "magic" ? "Use a password" : "Email me a magic link"}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="text-subtle hover:text-foreground absolute top-4 right-4 transition-colors"
            >
              <icons.error className="size-4" aria-hidden />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-subtle mb-1 block text-xs">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className={cn(
          "border-border bg-code text-foreground focus-visible:ring-ring h-9 w-full rounded-md border px-2.5 text-sm outline-none focus-visible:ring-2",
        )}
      />
    </label>
  );
}
