"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLabsStore } from "@/features/playground/labs-store";
import { authClient, changePassword, deleteUser, updateUser } from "@/lib/auth/client";
import {
  clearGuestProgressStorage,
  clearUserProgressStorage,
  flushProgressForAccountExit,
} from "@/lib/storage/progress-store";

export function AccountSettings({
  userId,
  initialName,
  email,
  initialPublicProfile,
}: {
  userId: string;
  initialName: string;
  email: string;
  initialPublicProfile: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [publicProfile, setPublicProfile] = useState(initialPublicProfile);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    void authClient.listAccounts().then((response) => {
      setHasPassword(response.data?.some((entry) => entry.providerId === "credential") ?? false);
    });
  }, []);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending("profile");
    setFeedback(null);
    const response = await updateUser({ name: trimmed });
    setPending(null);
    setFeedback(
      response.error
        ? { tone: "error", message: response.error.message ?? "Could not update profile." }
        : { tone: "success", message: "Profile updated." },
    );
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("password");
    setFeedback(null);
    const response = await changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(null);
    if (response.error) {
      setFeedback({
        tone: "error",
        message: response.error.message ?? "Could not change password.",
      });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setFeedback({ tone: "success", message: "Password changed. Other sessions were signed out." });
  };

  const savePrivacy = async () => {
    setPending("privacy");
    setFeedback(null);
    const response = await fetch("/api/account/privacy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicProfile }),
    });
    setPending(null);
    setFeedback(
      response.ok
        ? { tone: "success", message: "Community privacy updated." }
        : { tone: "error", message: "Could not update community privacy." },
    );
  };

  const removeAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (deleteConfirmation !== "DELETE") return;
    setPending("delete");
    setFeedback(null);
    if (!(await flushProgressForAccountExit(userId))) {
      setPending(null);
      setFeedback({
        tone: "error",
        message: "Progress is still syncing. Reconnect before deleting your account.",
      });
      return;
    }
    const response = await deleteUser({
      callbackURL: "/",
      password: hasPassword ? deletePassword : undefined,
    });
    setPending(null);
    if (response.error) {
      setFeedback({
        tone: "error",
        message: response.error.message ?? "Could not delete the account. Sign in again and retry.",
      });
      return;
    }
    clearGuestProgressStorage();
    clearUserProgressStorage(userId);
    useLabsStore.getState().resetForAccountExit();
    if (response.data?.message === "Verification email sent") {
      setFeedback({
        tone: "success",
        message: "Check your email to confirm permanent account deletion.",
      });
      return;
    }
    window.location.assign("/");
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-10 sm:px-6">
      <div>
        <p className="text-blue text-xs font-semibold tracking-[0.16em] uppercase">Account</p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-muted mt-1 text-sm">Manage your identity, security, and synced data.</p>
      </div>

      {feedback ? (
        <div
          role="status"
          className={
            feedback.tone === "success"
              ? "border-green/30 bg-green/10 text-green rounded-md border px-3 py-2 text-sm"
              : "border-red/30 bg-red/10 text-red rounded-md border px-3 py-2 text-sm"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your name is shown in the navigation and community views.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <AccountField
              label="Display name"
              value={name}
              onChange={setName}
              autoComplete="name"
              minLength={1}
              maxLength={80}
              required
            />
            <AccountField label="Email" value={email} type="email" disabled />
            <Button type="submit" variant="primary" disabled={pending === "profile"}>
              {pending === "profile" ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Community privacy</CardTitle>
          <CardDescription>
            Choose whether your name, avatar, solves, XP, and browser-measured records may appear in
            public community views.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="text-foreground flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={publicProfile}
              onChange={(event) => setPublicProfile(event.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>Show my learning activity in the community.</span>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={pending === "privacy"}
            onClick={() => void savePrivacy()}
          >
            {pending === "privacy" ? "Saving…" : "Save privacy"}
          </Button>
        </CardContent>
      </Card>

      {hasPassword ? (
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Changing it signs out every other active session.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="space-y-4">
              <AccountField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                type="password"
                autoComplete="current-password"
                required
              />
              <AccountField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
              />
              <Button type="submit" variant="primary" disabled={pending === "password"}>
                {pending === "password" ? "Updating…" : "Change password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-red/30">
        <CardHeader>
          <CardTitle className="text-red">Delete account</CardTitle>
          <CardDescription>
            This permanently deletes your account, sessions, progress, submissions, and playgrounds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={removeAccount} className="space-y-4">
            {hasPassword ? (
              <AccountField
                label="Current password"
                value={deletePassword}
                onChange={setDeletePassword}
                type="password"
                autoComplete="current-password"
                required
              />
            ) : null}
            <AccountField
              label='Type "DELETE" to confirm'
              value={deleteConfirmation}
              onChange={setDeleteConfirmation}
              autoComplete="off"
              required
            />
            <Button
              type="submit"
              variant="destructive"
              disabled={deleteConfirmation !== "DELETE" || pending === "delete"}
            >
              {pending === "delete" ? "Deleting…" : "Delete account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  disabled,
  required,
  minLength,
  maxLength,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <label className="block max-w-md">
      <span className="text-subtle mb-1.5 block text-xs font-medium">{label}</span>
      <input
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="border-border bg-code text-foreground focus-visible:ring-ring disabled:text-subtle h-9 w-full rounded-md border px-2.5 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
      />
    </label>
  );
}
