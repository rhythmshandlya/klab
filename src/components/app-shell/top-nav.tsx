"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthMenu } from "@/components/auth/auth-menu";
import { ClusterMark, icons } from "@/components/icons";
import { useProgress } from "@/features/progress/use-progress";
import { cn } from "@/lib/utils/cn";
import type { AuthCapabilities } from "@/lib/env";

import { isSectionActive, NAV_ITEMS } from "./nav-items";

export function TopNav({
  authEnabled = false,
  authCapabilities = { github: false, email: false },
}: {
  authEnabled?: boolean;
  authCapabilities?: AuthCapabilities;
}) {
  const pathname = usePathname() ?? "/";
  const progress = useProgress();

  return (
    <header className="border-border bg-app/80 sticky top-0 z-40 h-14 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-full items-center gap-6 px-4">
        <Brand />
        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isSectionActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center px-3 text-sm transition-colors",
                  active ? "text-foreground font-semibold" : "text-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <StatChip icon="streak" value={progress.streakDays} label="day streak" />
            <StatChip icon="xp" value={progress.xp} label="XP" />
          </div>
          {authEnabled ? <AuthMenu capabilities={authCapabilities} /> : <UserChip />}
        </div>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <Link
      href="/problems"
      className="text-foreground flex items-center gap-2 rounded-md pr-2 transition-opacity hover:opacity-80"
    >
      <ClusterMark className="text-blue size-6" />
      <span className="text-[15px] font-semibold tracking-tight">klab</span>
    </Link>
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
        G
      </span>
      <span className="text-foreground hidden text-sm font-medium lg:inline">Guest</span>
    </div>
  );
}
