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
  callbackURL,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capabilities?: AuthCapabilities;
  callbackURL?: string;
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
    setPassword("");
    setMode(next);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setMode("signin");
      setPassword("");
      resetFeedback();
    }
  };

  const github = async () => {
    resetFeedback();
    setPending(true);
    try {
      const destination =
        callbackURL ??
        (typeof window === "undefined"
          ? "/problems"
          : `${window.location.pathname}${window.location.search}`);
      const response = await signIn.social({ provider: "github", callbackURL: destination });
      if (response?.error) setError(response.error.message ?? "GitHub sign-in failed.");
    } catch {
      setError("GitHub sign-in could not be started. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetFeedback();
    setPending(true);
    try {
      if (mode === "magic") {
        const destination =
          callbackURL ??
          (typeof window === "undefined"
            ? "/problems"
            : `${window.location.pathname}${window.location.search}`);
        const response = await signIn.magicLink({ email, callbackURL: destination });
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
      else {
        handleOpenChange(false);
        if (callbackURL && typeof window !== "undefined") window.location.assign(callbackURL);
      }
    } catch {
      setError("We could not complete that request. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const copy: Record<Mode, { title: string; description: string }> = {
    signin: {
      title: "Welcome back",
      description: "Sign in to sync your progress and Playgrounds across devices.",
    },
    signup: {
      title: "Create your KLab account",
      description: "Keep your progress, Playgrounds, and community activity in one place.",
    },
    magic: {
      title: "Email me a sign-in link",
      description: "We will send a secure, one-time link. No password needed.",
    },
    forgot: {
      title: "Reset your password",
      description: "We will email a one-time link to choose a new password.",
    },
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="anim-content border-border-strong bg-panel-elevated fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-6 shadow-[0_24px_80px_-20px_rgb(0_0_0/0.85)] sm:p-7">
          <div className="flex items-start gap-3 pr-8">
            <span className="bg-blue/10 text-blue flex size-10 shrink-0 items-center justify-center rounded-lg">
              <icons.user className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-blue text-[11px] font-semibold tracking-[0.12em] uppercase">
                KLab account
              </p>
              <Dialog.Title className="text-foreground mt-0.5 text-xl font-semibold tracking-tight">
                {copy[mode].title}
              </Dialog.Title>
              <Dialog.Description className="text-muted mt-1.5 text-sm leading-relaxed">
                {copy[mode].description}
              </Dialog.Description>
            </div>
          </div>

          {capabilities.github && mode === "signin" ? (
            <button
              type="button"
              onClick={() => void github()}
              disabled={pending}
              className="border-border-strong bg-panel text-foreground hover:bg-panel-hover focus-visible:ring-ring mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
            >
              <icons.github className="size-[18px]" aria-hidden />
              {pending ? "Opening GitHub…" : "Continue with GitHub"}
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
                  disabled={pending}
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
                disabled={pending}
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
                  disabled={pending}
                  revealable
                />
              ) : null}

              {mode === "signup" ? (
                <p className="text-subtle text-[11px]">Use at least 10 characters.</p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring mt-3 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
              >
                {pending
                  ? mode === "magic" || mode === "forgot"
                    ? "Sending…"
                    : mode === "signup"
                      ? "Creating account…"
                      : "Signing in…"
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

          {error ? (
            <p
              role="alert"
              className="border-red/25 bg-red/10 text-red mt-4 rounded-md border px-3 py-2 text-xs leading-relaxed"
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="border-green/25 bg-green/10 text-green mt-4 rounded-md border px-3 py-2 text-xs leading-relaxed"
            >
              {notice}
            </p>
          ) : null}

          {capabilities.email ? (
            <div className="text-subtle mt-5 text-xs">
              {mode === "signin" ? (
                <div className="space-y-3 text-center">
                  <p>
                    New to KLab?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      disabled={pending}
                      className="text-blue hover:underline disabled:opacity-50"
                    >
                      Create an account
                    </button>
                  </p>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                    <button
                      type="button"
                      onClick={() => switchMode("magic")}
                      disabled={pending}
                      className="hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Use a magic link
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      disabled={pending}
                      className="hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    disabled={pending}
                    className="hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    ← Back to sign in
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {mode === "signin" ? (
            <p className="border-border text-subtle mt-5 border-t pt-4 text-center text-[11px] leading-relaxed">
              Guest progress is merged into your account when you sign in.
            </p>
          ) : null}

          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="text-subtle hover:bg-panel-hover hover:text-foreground focus-visible:ring-ring absolute top-4 right-4 flex size-9 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <icons.close className="size-4" aria-hidden />
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
  disabled,
  revealable,
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
  disabled?: boolean;
  revealable?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const resolvedType = revealable && revealed ? "text" : type;

  return (
    <label className="block">
      <span className="text-muted mb-1.5 block text-xs font-medium">{label}</span>
      <span className="relative block">
        <input
          name={name}
          type={resolvedType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          disabled={disabled}
          className={cn(
            "border-border bg-code text-foreground focus-visible:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60",
            revealable && "pr-12",
          )}
        />
        {revealable ? (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            disabled={disabled}
            className="text-subtle hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[11px] font-medium transition-colors disabled:opacity-50"
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            {revealed ? "Hide" : "Show"}
          </button>
        ) : null}
      </span>
    </label>
  );
}
