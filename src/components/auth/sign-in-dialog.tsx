"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { icons } from "@/components/icons";
import { requestPasswordReset, signIn, signUp } from "@/lib/auth/client";
import type { AuthCapabilities } from "@/lib/env";
import { cn } from "@/lib/utils/cn";

type Mode = "signin" | "signup" | "magic" | "forgot";

export function SignInDialog({
  open,
  onOpenChange,
  capabilities = { github: true, email: true },
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capabilities?: AuthCapabilities;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetFeedback = () => {
    setError(null);
    setNotice(null);
  };

  const switchMode = (next: Mode) => {
    resetFeedback();
    setMode(next);
  };

  const github = async () => {
    resetFeedback();
    setPending(true);
    const callbackURL = typeof window === "undefined" ? "/problems" : window.location.pathname;
    const response = await signIn.social({ provider: "github", callbackURL });
    // Successful OAuth navigates away; only an error normally returns here.
    if (response?.error) {
      setError(response.error.message ?? "GitHub sign-in failed.");
      setPending(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setPending(true);
    try {
      if (mode === "magic") {
        const callbackURL = typeof window === "undefined" ? "/problems" : window.location.pathname;
        const response = await signIn.magicLink({ email, callbackURL });
        if (response?.error) setError(response.error.message ?? "Could not send the link.");
        else setNotice("Check your email for a sign-in link.");
        return;
      }

      if (mode === "forgot") {
        const response = await requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
        if (response?.error) {
          setError(response.error.message ?? "Could not send the reset link.");
        } else {
          // Keep this deliberately non-enumerating.
          setNotice("If that address has an account, a password reset link is on its way.");
        }
        return;
      }

      if (mode === "signup") {
        const response = await signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0]!,
        });
        if (response?.error) {
          setError(response.error.message ?? "Could not create the account.");
        } else {
          setPassword("");
          setMode("signin");
          setNotice("Account created. Check your email to verify it, then sign in.");
        }
        return;
      }

      const response = await signIn.email({ email, password });
      if (response?.error) setError(response.error.message ?? "Incorrect email or password.");
      else onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  const title =
    mode === "signup"
      ? "Create your account"
      : mode === "forgot"
        ? "Reset your password"
        : "Sign in to klab";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="anim-content border-border-strong bg-panel-elevated fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.7)]">
          <Dialog.Title className="text-foreground text-lg font-semibold tracking-tight">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-muted mt-1 text-sm">
            {mode === "forgot"
              ? "We will email a one-time link to choose a new password."
              : "Sync progress and history across devices. Your guest progress carries over."}
          </Dialog.Description>

          {capabilities.github && mode === "signin" ? (
            <button
              type="button"
              onClick={() => void github()}
              disabled={pending}
              className="border-border bg-panel text-foreground hover:bg-panel-hover focus-visible:ring-ring mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              <icons.endpointSlice className="size-4" aria-hidden />
              Continue with GitHub
            </button>
          ) : null}

          {capabilities.github && capabilities.email && mode === "signin" ? (
            <div className="my-4 flex items-center gap-3">
              <span className="bg-border h-px flex-1" />
              <span className="text-subtle text-xs">or</span>
              <span className="bg-border h-px flex-1" />
            </div>
          ) : null}

          {capabilities.email ? (
            <form
              onSubmit={submit}
              className={cn("space-y-2.5", capabilities.github && mode === "signin" ? "" : "mt-5")}
            >
              {mode === "signup" ? (
                <Field
                  label="Name"
                  name="name"
                  value={name}
                  onChange={setName}
                  type="text"
                  autoComplete="name"
                  maxLength={80}
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
              {mode === "signin" || mode === "signup" ? (
                <Field
                  label="Password"
                  name="password"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "signup" ? 10 : undefined}
                  maxLength={128}
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
                  ? "Working…"
                  : mode === "magic"
                    ? "Send magic link"
                    : mode === "forgot"
                      ? "Send reset link"
                      : mode === "signup"
                        ? "Create account"
                        : "Sign in"}
              </button>
            </form>
          ) : null}

          {capabilities.email ? (
            <div className="text-subtle mt-4 flex flex-wrap justify-between gap-2 text-xs">
              {mode === "signin" ? (
                <>
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="hover:text-foreground transition-colors"
                  >
                    Create an account
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("magic")}
                    className="hover:text-foreground w-full text-left transition-colors"
                  >
                    Email me a magic link
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="hover:text-foreground transition-colors"
                >
                  Back to sign in
                </button>
              )}
            </div>
          ) : null}

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
  minLength,
  maxLength,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-subtle mb-1 block text-xs">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="border-border bg-code text-foreground focus-visible:ring-ring h-9 w-full rounded-md border px-2.5 text-sm outline-none focus-visible:ring-2"
      />
    </label>
  );
}
