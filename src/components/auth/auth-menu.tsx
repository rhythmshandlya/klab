"use client";

import { useState } from "react";

import { signOut, useSession } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";

import { SignInDialog } from "./sign-in-dialog";

/**
 * Session-aware nav chip (rendered only when auth is enabled). Guest → a "Sign in"
 * button that opens the dialog. Signed in → an avatar + name with a small menu to sign
 * out. Mirrors the read-then-hydrate pattern of the rest of the app: on first paint the
 * session is pending, so we render a neutral placeholder to avoid a flash.
 */
export function AuthMenu() {
  const { data: session, isPending } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (isPending) {
    return <div className="bg-panel border-border h-8 w-8 rounded-md border" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Sign in
        </button>
        <SignInDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  const user = session.user;
  const label = user.name || user.email || "Account";
  const initials = toInitials(label);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="border-border bg-panel hover:bg-panel-hover flex h-8 items-center gap-2 rounded-md border pr-2.5 pl-1 transition-colors"
      >
        <Avatar image={user.image ?? null} initials={initials} />
        <span className="text-foreground hidden max-w-32 truncate text-sm font-medium lg:inline">
          {label}
        </span>
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            className="border-border bg-panel-elevated absolute right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-md border py-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)]"
          >
            <div className="border-border border-b px-3 py-2">
              <p className="text-foreground truncate text-sm font-medium">{label}</p>
              {user.email ? <p className="text-subtle truncate text-xs">{user.email}</p> : null}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
              className="text-muted hover:bg-panel-hover hover:text-foreground w-full px-3 py-2 text-left text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Avatar({ image, initials }: { image: string | null; initials: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar is a remote OAuth URL, not a local asset
    return <img src={image} alt="" className="size-6 rounded" />;
  }
  return (
    <span
      className={cn(
        "bg-blue/15 text-blue flex size-6 items-center justify-center rounded text-[11px] font-semibold",
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function toInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}
