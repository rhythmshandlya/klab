"use client";

import { type ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { ProgressSync } from "./progress-sync";
import { TopNav } from "./top-nav";

export function AppShell({
  children,
  authEnabled = false,
}: {
  children: ReactNode;
  authEnabled?: boolean;
}) {
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
      {authEnabled ? <ProgressSync /> : null}
      <div className="flex min-h-dvh flex-col">
        <TopNav authEnabled={authEnabled} />
        <main id="main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
