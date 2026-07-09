"use client";

import Link from "next/link";

import { icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { LEVEL_CATALOG } from "@/content/levels";
import { cn } from "@/lib/utils/cn";

import { useProgress } from "../use-progress";

export function ProgressDashboard() {
  const progress = useProgress();
  const solved = new Set(progress.solvedLevelSlugs);
  const solvedCount = LEVEL_CATALOG.filter((l) => solved.has(l.slug)).length;

  const Xp = icons.xp;
  const Streak = icons.streak;
  const Trophy = icons.trophy;
  const Check = icons.success;

  const stats = [
    { label: "Total XP", value: progress.xp, icon: Xp, tone: "text-purple" },
    { label: "Day streak", value: progress.streakDays, icon: Streak, tone: "text-amber" },
    { label: "Levels solved", value: solvedCount, icon: Trophy, tone: "text-green" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-subtle text-[11px] font-semibold tracking-[0.12em] uppercase">
        Your journey
      </p>
      <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">Progress</h1>
      <p className="text-muted mt-2 max-w-2xl text-[15px] leading-relaxed">
        Tracked locally in your browser — no account required. Solve incidents to earn XP.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="border-border bg-panel rounded-xl border p-5">
            <s.icon className={cn("size-5", s.tone)} aria-hidden />
            <p className="tabnums text-foreground mt-3 text-3xl font-semibold">{s.value}</p>
            <p className="text-muted mt-0.5 text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="text-subtle mt-10 text-sm font-semibold tracking-[0.08em] uppercase">
        Incident labs
      </h2>
      <ul className="mt-3 space-y-2">
        {LEVEL_CATALOG.map((level) => {
          const isSolved = solved.has(level.slug);
          return (
            <li key={level.slug}>
              <Link
                href={`/problems/${level.slug}`}
                className="border-border bg-panel hover:border-border-strong hover:bg-panel-hover flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  {isSolved ? (
                    <Check className="text-green size-4" aria-hidden />
                  ) : (
                    <span className="border-border-strong size-4 rounded-full border" aria-hidden />
                  )}
                  <span className={cn("text-sm", isSolved ? "text-foreground" : "text-muted")}>
                    {level.title}
                  </span>
                  <span className="text-subtle text-xs capitalize">{level.difficulty}</span>
                </span>
                <span className="flex items-center gap-2">
                  {isSolved ? (
                    <Badge tone="success">Solved</Badge>
                  ) : (
                    <span className="text-purple flex items-center gap-1 text-xs">
                      <Xp className="size-3.5" aria-hidden />
                      {level.xp} XP
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-subtle mt-6 text-xs">
        Achievement badges and per-concept mastery are on the roadmap. Progress persists in this
        browser via <code className="font-mono">localStorage</code>.
      </p>
    </div>
  );
}
