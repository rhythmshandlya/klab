"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { icons } from "@/components/icons";
import { ADVANCED_UNLOCK_SOLVES, isLevelLocked, LEVEL_CATALOG } from "@/content/levels";
import type { ProblemLevel } from "@/lib/domain/types";
import { useProgress } from "@/features/progress/use-progress";

import { LevelWorkspace } from "./level-workspace";

/**
 * Client gate in front of a level workspace: advanced levels stay locked until the
 * player has enough solves (progress lives in localStorage, so the check is
 * client-side by necessity). Unlocked levels render the workspace untouched.
 */
const emptySubscribe = () => () => {};

export function LevelGate({ level }: { level: ProblemLevel }) {
  const progress = useProgress();
  // Progress hydrates after mount; render nothing gate-related until we're on the
  // client, so a returning player with enough solves never sees a lock flash.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const solvedCount = LEVEL_CATALOG.filter((l) =>
    progress.solvedLevelSlugs.includes(l.slug),
  ).length;

  if (!hydrated) return null;
  if (!isLevelLocked(level.difficulty, solvedCount)) {
    return <LevelWorkspace level={level} />;
  }

  const remaining = ADVANCED_UNLOCK_SOLVES - solvedCount;
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="border-border bg-panel max-w-md rounded-xl border p-8 text-center">
        <span className="border-border bg-panel-elevated mx-auto flex size-12 items-center justify-center rounded-lg border">
          <icons.lock className="text-subtle size-5" aria-hidden />
        </span>
        <h1 className="text-foreground mt-4 text-lg font-semibold tracking-tight">
          {level.title} is locked
        </h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Advanced incidents unlock once you&apos;ve proven yourself on the fundamentals. Solve{" "}
          <span className="text-foreground font-medium">
            {remaining} more problem{remaining === 1 ? "" : "s"}
          </span>{" "}
          to open this one.
        </p>
        <Link
          href="/problems"
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
        >
          <icons.problems className="size-4" aria-hidden />
          Browse unlocked problems
        </Link>
      </div>
    </div>
  );
}
