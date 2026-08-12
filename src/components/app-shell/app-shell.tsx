"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { AuthCapabilities } from "@/lib/env";

import { GuestDataSync, ProgressSync } from "./progress-sync";
import { TopNav } from "./top-nav";

export function AppShell({
  children,
  authEnabled = false,
  authCapabilities = { github: false, email: false },
}: {
  children: ReactNode;
  authEnabled?: boolean;
  authCapabilities?: AuthCapabilities;
}) {
  const pathname = usePathname() ?? "/";
  const isEntryPage = pathname === "/";

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={0}>
      <a
        href="#main"
        className="focus:bg-panel-elevated focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:outline-none"
      >
        Skip to content
      </a>
      {/* Syncs session → progress store; only when auth is on, so guests never
          mount the session hook. */}
      {!isEntryPage ? authEnabled ? <ProgressSync /> : <GuestDataSync /> : null}
      <div className="flex min-h-dvh flex-col">
        {!isEntryPage ? (
          <TopNav authEnabled={authEnabled} authCapabilities={authCapabilities} />
        ) : null}
        <main id="main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
