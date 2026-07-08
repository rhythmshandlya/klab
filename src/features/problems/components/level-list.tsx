import Link from "next/link";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { LEVEL_CATALOG, type LevelSummary } from "@/content/levels";
import type { Severity } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

const SEVERITY_TONE: Record<Severity, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

export function LevelList() {
  const Xp = icons.xp;
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-subtle text-[11px] font-semibold tracking-[0.12em] uppercase">
          Incident labs
        </p>
        <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">Problems</h1>
        <p className="text-muted mt-2 max-w-2xl text-[15px] leading-relaxed">
          Each level drops you into a broken cluster. Investigate with a real terminal, gather
          evidence, edit the manifest, and prove your fix against behavior-based validators.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {LEVEL_CATALOG.map((level) => (
          <li key={level.slug}>
            {level.status === "available" ? (
              <Link
                href={`/problems/${level.slug}`}
                className="group border-border bg-panel hover:border-border-strong hover:bg-panel-hover focus-visible:ring-ring focus-visible:ring-offset-app block h-full rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <LevelCardBody level={level} />
              </Link>
            ) : (
              <div
                aria-disabled
                className="border-border bg-panel/40 h-full rounded-xl border border-dashed p-5 opacity-70"
              >
                <LevelCardBody level={level} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="text-subtle mt-6 flex items-center gap-1.5 text-sm">
        <Xp className="text-purple size-3.5" aria-hidden />
        Solve levels to earn XP. More levels are on the way.
      </p>
    </div>
  );
}

function LevelCardBody({ level }: { level: LevelSummary }) {
  const Xp = icons.xp;
  const Arrow = icons.service;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={SEVERITY_TONE[level.severity]}>
            <span className="capitalize">{level.severity}</span>
          </Badge>
          <span className="text-subtle text-xs capitalize">{level.difficulty}</span>
        </div>
        {level.status === "coming-soon" ? (
          <Badge tone="neutral">Coming soon</Badge>
        ) : (
          <span className="text-purple flex items-center gap-1 text-xs font-medium">
            <Xp className="size-3.5" aria-hidden />
            <span className="tabnums">{level.xp}</span> XP
          </span>
        )}
      </div>

      <h2
        className={cn(
          "text-foreground mt-3 flex items-center gap-1.5 text-base font-semibold tracking-tight",
        )}
      >
        {level.title}
        {level.status === "available" ? (
          <Arrow
            className="text-subtle size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            aria-hidden
          />
        ) : null}
      </h2>
      <p className="text-muted mt-1.5 text-sm leading-relaxed">{level.blurb}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {level.concepts.slice(0, 4).map((concept) => (
          <span
            key={concept}
            className="border-border bg-panel-elevated text-subtle rounded border px-1.5 py-0.5 text-[11px]"
          >
            {concept}
          </span>
        ))}
      </div>
    </>
  );
}
