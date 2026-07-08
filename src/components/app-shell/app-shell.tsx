"use client";

import { type ReactNode } from "react";

import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import { TopNav } from "./top-nav";
import { WorkspaceActionProvider } from "./workspace-action";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceActionProvider>
      <CommandPaletteProvider>
        <TooltipProvider delayDuration={250} skipDelayDuration={0}>
          <a
            href="#main"
            className="focus:bg-panel-elevated focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:outline-none"
          >
            Skip to content
          </a>
          <div className="flex min-h-dvh flex-col">
            <TopNav />
            <main id="main" className="flex min-h-0 flex-1 flex-col">
              {children}
            </main>
          </div>
        </TooltipProvider>
      </CommandPaletteProvider>
    </WorkspaceActionProvider>
  );
}
