"use client";

import { icons } from "@/components/icons";
import { Panel } from "@/components/ui/panel";
import type { Hint } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

import { useLevelStore } from "../level-store";

/** Resolve a hint's unlock rule ids to evidence ids and check they're all collected. */
function isUnlocked(
  hint: Hint,
  rules: { id: string; evidenceId: string }[],
  collected: readonly string[],
): boolean {
  if (!hint.unlockAfter || hint.unlockAfter.length === 0) return true;
  return hint.unlockAfter.every((ruleId) => {
    const rule = rules.find((r) => r.id === ruleId);
    return rule ? collected.includes(rule.evidenceId) : true;
  });
}

/**
 * Collapsed by default ("Need help?") so hints never crowd out investigation
 * surfaces. Hints beyond the first stay locked until the learner has collected the
 * gating evidence — investigate first, then get help.
 */
export function HintsCard({ onReveal }: { onReveal: (hint: Hint) => void }) {
  const level = useLevelStore((s) => s.level);
  const collected = useLevelStore((s) => s.collectedEvidence);
  const revealed = useLevelStore((s) => s.revealedHintIds);
  const open = useLevelStore((s) => s.hintsOpen);
  const setOpen = useLevelStore((s) => s.setHintsOpen);
  if (!level) return null;

  const Lock = icons.lock;
  const Xp = icons.xp;
  const revealedCount = level.hints.filter((h) => revealed.includes(h.id)).length;

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="hover:bg-panel-hover flex h-10 w-full items-center justify-between gap-2 rounded-t-lg px-3 transition-colors"
      >
        <span className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <icons.docsInteractive className="text-subtle size-4" aria-hidden />
          Hints
          <span className="tabnums text-subtle text-[11px] font-normal">
            {revealedCount}/{level.hints.length} used
          </span>
        </span>
        <span className="text-subtle flex items-center gap-1.5 text-xs">
          {open ? "Hide" : "Need help?"}
          <icons.chevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div className="space-y-2 p-3 pt-1">
          <p className="text-subtle text-xs">
            Hints cost XP, and deeper ones unlock as you collect evidence.
          </p>
          {level.hints.map((hint, index) => {
            const unlocked = isUnlocked(hint, level.evidenceRules, collected);
            const isRevealed = revealed.includes(hint.id);
            return (
              <div
                key={hint.id}
                className={cn(
                  "border-border bg-panel-elevated rounded-lg border p-3",
                  !unlocked && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground text-sm font-medium">
                    Hint {index + 1} — {hint.title}
                  </span>
                  <span className="text-amber flex items-center gap-1 text-xs">
                    <Xp className="size-3.5" aria-hidden />
                    <span className="tabnums">−{hint.xpPenalty}</span>
                  </span>
                </div>

                {isRevealed ? (
                  <p className="text-muted mt-2 text-sm leading-relaxed">{hint.body}</p>
                ) : unlocked ? (
                  <button
                    type="button"
                    onClick={() => onReveal(hint)}
                    className="text-blue focus-visible:ring-ring mt-2 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Reveal hint (costs {hint.xpPenalty} XP)
                  </button>
                ) : (
                  <p className="text-subtle mt-2 flex items-center gap-1.5 text-xs">
                    <Lock className="size-3.5" aria-hidden />
                    Investigate more to unlock this hint.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}
