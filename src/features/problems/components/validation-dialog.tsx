"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useMemo } from "react";

import { icons } from "@/components/icons";
import { BRAND } from "@/config/brand";
import { getLevelBySlug } from "@/content/levels";
import { useProgress } from "@/features/progress/use-progress";
import type { ProblemLevel } from "@/lib/domain/types";
import type { ValidationReport } from "@/lib/kube/validators";
import { cn } from "@/lib/utils/cn";

export function ValidationDialog({
  open,
  onOpenChange,
  report,
  level,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ValidationReport | null;
  level: ProblemLevel;
}) {
  const Check = icons.success;
  const Cross = icons.error;
  const Trophy = icons.trophy;
  const passed = report?.passed ?? false;
  const isBuild = level.challengeMode === "build";
  const progress = useProgress();
  const recommendedNext = useMemo(() => {
    if (!passed) return [];
    const solved = new Set([...progress.solvedLevelSlugs, level.slug]);
    return level.postSolveExplanation.recommendedNextSlugs
      .map((slug) => getLevelBySlug(slug))
      .filter(
        (candidate): candidate is ProblemLevel =>
          candidate !== undefined &&
          !solved.has(candidate.slug) &&
          candidate.prerequisites.every((slug) => solved.has(slug)),
      );
  }, [level, passed, progress.solvedLevelSlugs]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="anim-content border-border-strong bg-panel-elevated fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-6 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.7)]">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-lg border",
                passed ? "border-green/30 bg-green/10" : "border-border bg-panel",
              )}
            >
              {passed ? (
                <Trophy className="text-green size-5" aria-hidden />
              ) : (
                <icons.validate className="text-muted size-5" aria-hidden />
              )}
            </span>
            <div>
              <Dialog.Title className="text-foreground text-lg font-semibold tracking-tight">
                {passed
                  ? isBuild
                    ? "Static review passed"
                    : "Incident resolved"
                  : isBuild
                    ? "Design needs revision"
                    : "Not passing yet"}
              </Dialog.Title>
              <Dialog.Description className="text-muted text-sm">
                {passed
                  ? isBuild
                    ? `Your submitted manifests satisfy ${BRAND.name}'s static checks for ${level.title.toLowerCase()}. This does not prove the design in a live cluster.`
                    : `You restored ${level.title.toLowerCase()}.`
                  : isBuild
                    ? "Some static architecture checks are not satisfied yet. Review the feedback and revise the design."
                    : "Some checks are still failing. Keep investigating."}
              </Dialog.Description>
            </div>
          </div>

          <ul className="mt-5 space-y-2">
            {(report?.results ?? []).map((result) => (
              <li
                key={result.id}
                className="border-border bg-panel flex items-start gap-2.5 rounded-md border p-3"
              >
                {result.passed ? (
                  <Check className="text-green mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <Cross className="text-red mt-0.5 size-4 shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-foreground flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] leading-none font-semibold uppercase",
                        result.passed
                          ? "border-green/30 bg-green/10 text-green"
                          : "border-red/30 bg-red/10 text-red",
                      )}
                    >
                      {result.passed ? "Passed" : "Failed"}
                    </span>
                    <span>{result.title}</span>
                  </p>
                  <p className="text-subtle text-xs">{result.detail}</p>
                  {/* The prescriptive breakdown is the reward for submitting: it is
                      deliberately absent from the always-visible checks panel. */}
                  {result.diagnostic ? (
                    <pre className="border-border text-muted mt-1.5 overflow-x-auto rounded border-l-2 pl-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                      {result.diagnostic}
                    </pre>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {passed ? (
            <div className="border-border bg-panel mt-5 space-y-3 rounded-lg border p-4">
              <Explain
                label={isBuild ? "Design intent" : "Root cause"}
                body={level.postSolveExplanation.rootCause}
              />
              <Explain
                label={isBuild ? "Failure model" : "Why it failed"}
                body={level.postSolveExplanation.whyItFailed}
              />
              <Explain
                label={isBuild ? "Reference approach" : "What fixed it"}
                body={level.postSolveExplanation.whatFixedIt}
              />
              <Explain
                label={isBuild ? "Tradeoffs and operations" : "Prevention"}
                body={level.postSolveExplanation.prevention}
              />
              {level.postSolveExplanation.relatedConcepts.length > 0 ? (
                <div>
                  <p className="text-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
                    Related concepts
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {level.postSolveExplanation.relatedConcepts.map((concept) => (
                      <span
                        key={concept}
                        className="border-border bg-panel-elevated text-muted rounded-md border px-2 py-0.5 text-xs"
                      >
                        {concept.replaceAll("-", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {level.postSolveExplanation.docsHref ? (
                <Link
                  href={level.postSolveExplanation.docsHref}
                  className="text-blue inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <icons.docs className="size-4" aria-hidden />
                  Open the related lesson
                </Link>
              ) : null}
              {recommendedNext.length > 0 ? (
                <div>
                  <p className="text-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
                    Continue with
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {recommendedNext.map((candidate) => (
                      <Link
                        key={candidate.slug}
                        href={`/problems/${candidate.slug}`}
                        className="border-border bg-panel-elevated text-foreground hover:border-border-strong inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                      >
                        {candidate.title}
                        <icons.arrowRight className="size-3.5" aria-hidden />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="border-border bg-panel text-foreground hover:bg-panel-hover focus-visible:ring-ring inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {passed ? "Done" : isBuild ? "Revise design" : "Keep investigating"}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Explain({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">{label}</p>
      <p className="text-muted mt-0.5 text-sm leading-relaxed">{body}</p>
    </div>
  );
}
