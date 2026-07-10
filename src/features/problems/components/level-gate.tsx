"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { icons } from "@/components/icons";
import { getLevelBySlug, isLevelLocked, missingPrerequisites } from "@/content/levels";
import type { ProblemLevel } from "@/lib/domain/types";
import { useProgress } from "@/features/progress/use-progress";

import { LevelWorkspace } from "./level-workspace";

/**
 * Client gate in front of a level workspace. Prerequisites live in the authored
 * curriculum graph; progress is local-first, so the check is client-side.
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

  const solved = new Set(progress.solvedLevelSlugs);

  if (!hydrated) return null;
  if (!isLevelLocked(level, solved)) {
    return <LevelWorkspace level={level} />;
  }

  const missing = missingPrerequisites(level, solved);
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
          Complete the prerequisite incident{missing.length === 1 ? "" : "s"} to unlock this
          workspace.
        </p>
        <ul className="mt-4 space-y-2 text-left">
          {missing.map((slug) => {
            const prerequisite = getLevelBySlug(slug);
            return (
              <li key={slug}>
                <Link
                  href={`/problems/${slug}`}
                  className="border-border bg-panel-elevated text-foreground hover:border-border-strong flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors"
                >
                  <span>{prerequisite?.title ?? slug}</span>
                  <icons.arrowRight className="text-subtle size-4" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
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
