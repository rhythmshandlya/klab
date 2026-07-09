"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCommandPalette } from "@/components/command-palette/command-palette-provider";
import { ClusterMark, icons } from "@/components/icons";
import { Kbd } from "@/components/ui/kbd";
import { PLACEHOLDER_USER } from "@/lib/config/placeholders";
import { useProgress } from "@/features/progress/use-progress";
import { cn } from "@/lib/utils/cn";

import { isSectionActive, NAV_ITEMS } from "./nav-items";
import { useWorkspaceAction } from "./workspace-action";

export function TopNav() {
  const pathname = usePathname() ?? "/";
  const progress = useProgress();

  return (
    <header className="border-border bg-app/80 sticky top-0 z-40 h-14 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-full items-center gap-4 px-4">
        <Brand />
        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = icons[item.icon];
            const active = isSectionActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-panel-hover text-foreground"
                    : "text-muted hover:bg-panel-hover hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <PrimaryAction />
          <CommandButton />
          <div className="hidden items-center gap-2 sm:flex">
            <StatChip icon="streak" value={progress.streakDays} label="day streak" />
            <StatChip icon="xp" value={progress.xp} label="XP" />
          </div>
          <UserChip />
        </div>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <Link
      href="/"
      className="text-foreground flex items-center gap-2 rounded-md pr-2 transition-opacity hover:opacity-80"
    >
      <ClusterMark className="text-blue size-6" />
      <span className="text-[15px] font-semibold tracking-tight">klab</span>
    </Link>
  );
}

function PrimaryAction() {
  const action = useWorkspaceAction();
  if (!action) return null;
  const Icon = icons[action.icon];
  return (
    <button
      type="button"
      onClick={action.onRun}
      disabled={action.disabled || action.pending}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-app inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
    >
      <Icon className="size-4" aria-hidden />
      {action.label}
      {action.shortcut ? (
        <span className="ml-0.5 font-mono text-[11px] opacity-70">{action.shortcut}</span>
      ) : null}
    </button>
  );
}

function CommandButton() {
  const { toggle } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open command palette"
      className="border-border bg-panel text-subtle hover:border-border-strong hover:text-muted flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm transition-colors"
    >
      <span className="hidden lg:inline">Search…</span>
      <span className="flex items-center gap-0.5">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}

function StatChip({ icon, value, label }: { icon: "streak" | "xp"; value: number; label: string }) {
  const Icon = icons[icon];
  const tone = icon === "streak" ? "text-amber" : "text-purple";
  return (
    <div
      className="border-border bg-panel flex h-8 items-center gap-1.5 rounded-md border px-2.5"
      title={`${value} ${label}`}
    >
      <Icon className={cn("size-3.5", tone)} aria-hidden />
      <span className="tabnums text-foreground text-sm font-medium">{value}</span>
      <span className="text-subtle text-xs">{label}</span>
    </div>
  );
}

function UserChip() {
  return (
    <div className="border-border bg-panel flex h-8 items-center gap-2 rounded-md border pr-2.5 pl-1">
      <span
        className="bg-blue/15 text-blue flex size-6 items-center justify-center rounded text-[11px] font-semibold"
        aria-hidden
      >
        {PLACEHOLDER_USER.initials}
      </span>
      <span className="text-foreground hidden text-sm font-medium lg:inline">
        {PLACEHOLDER_USER.name}
      </span>
    </div>
  );
}
