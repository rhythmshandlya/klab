"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/auth/client";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalidToken = searchParams.get("error") === "INVALID_TOKEN" || !token;
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setPending(true);
    setError(null);
    const response = await resetPassword({ newPassword: password, token });
    setPending(false);
    if (response.error) {
      setError(response.error.message ?? "The reset link is invalid or expired.");
      return;
    }
    setComplete(true);
  };

  if (complete) {
    return (
      <div className="border-green/30 bg-green/10 rounded-md border p-4">
        <p className="text-green text-sm font-medium">Your password has been reset.</p>
        <Link
          href="/"
          className="text-foreground mt-3 inline-block text-sm underline underline-offset-4"
        >
          Return home and sign in
        </Link>
      </div>
    );
  }

  if (invalidToken) {
    return (
      <div className="border-red/30 bg-red/10 rounded-md border p-4">
        <p className="text-red text-sm">This reset link is invalid or has expired.</p>
        <Link
          href="/"
          className="text-foreground mt-3 inline-block text-sm underline underline-offset-4"
        >
          Return home to request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-subtle mb-1.5 block text-xs font-medium">New password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
          className="border-border bg-code text-foreground focus-visible:ring-ring h-9 w-full rounded-md border px-2.5 text-sm outline-none focus-visible:ring-2"
        />
      </label>
      {error ? <p className="text-red text-xs">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
