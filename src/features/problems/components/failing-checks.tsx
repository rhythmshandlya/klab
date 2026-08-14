"use client";

import { icons } from "@/components/icons";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils/cn";

import { useLevelStore } from "../level-store";

/**
 * Live win-condition status ("Failing checks" from the UX spec): shows each hidden
 * validator's current pass/fail WITHOUT the learner having to formally Run
 * Validation. States are observational facts (e.g. "web-svc has zero ready
 * endpoints"): they say what's broken, never why. Refreshed quietly on boot and
 * after every Apply/Reset.
 */
export function FailingChecks({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const level = useLevelStore((s) => s.level);
  const checks = useLevelStore((s) => s.checks);
  if (!level) return null;

  const failing = checks ? checks.results.filter((r) => !r.passed).length : null;
  const total = checks?.results.length ?? level.validators.length + level.constraints.length;
  const isBuild = level.challengeMode === "build";

  return (
    <Panel>
      <PanelHeader
        title={
          isBuild
            ? checks && failing === 0
              ? "Static review passed"
              : "Static architecture review"
            : checks && failing === 0
              ? "Passing checks"
              : "Failing checks"
        }
        icon={
          checks && failing === 0 ? (
            <icons.success className="text-green" />
          ) : (
            <icons.error className="text-red" />
          )
        }
        actions={
          <span className="flex items-center gap-2">
            {checks || refreshing ? (
              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={cn(
                  "tabnums text-[11px] font-medium",
                  refreshing ? "text-subtle" : failing === 0 ? "text-green" : "text-red",
                )}
              >
                {refreshing ? "Refreshing checks…" : `${total - (failing ?? 0)}/${total} passing`}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing checks" : "Refresh checks"}
              aria-busy={refreshing}
              className="text-subtle hover:text-foreground rounded p-0.5 transition-colors disabled:opacity-50"
            >
              <icons.reset className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
            </button>
          </span>
        }
      />
      <PanelBody className="space-y-1" aria-busy={refreshing}>
        {checks ? (
          checks.results.map((result) => (
            <div key={result.id} className="flex items-start gap-2.5 px-1 py-1 text-sm">
              {result.passed ? (
                <icons.success className="text-green mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <icons.error className="text-red mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0">
                <span className={cn("block", result.passed ? "text-muted" : "text-foreground")}>
                  <span className="sr-only">{result.passed ? "Passed: " : "Failed: "}</span>
                  {result.label}
                </span>
                <span className="text-subtle text-xs">{result.detail}</span>
              </span>
            </div>
          ))
        ) : (
          <>
            {level.validators.map((validator) => (
              <div
                key={validator.id}
                className="text-subtle flex items-center gap-2.5 px-1 py-1 text-sm"
              >
                <span
                  className="border-border-strong size-4 shrink-0 rounded-full border"
                  aria-hidden
                />
                {validator.title}
              </div>
            ))}
            {level.constraints.map((constraint) => (
              <div
                key={`constraint:${constraint.id}`}
                className="text-subtle flex items-center gap-2.5 px-1 py-1 text-sm"
              >
                <span
                  className="border-border-strong size-4 shrink-0 rounded-full border"
                  aria-hidden
                />
                {constraint.label}
              </div>
            ))}
            <p className="text-subtle px-1 pt-1 text-xs">Checks run once the cluster is up.</p>
          </>
        )}
        <p className="text-subtle border-border border-t px-1 pt-2 text-xs">
          {isBuild ? "Revise the manifests, then " : "Fix the cluster, then "}
          <span className="text-foreground font-medium">
            {isBuild ? "Submit Static Review" : "Run Validation"}
          </span>{" "}
          (⌘/Ctrl+Enter) to submit.
        </p>
      </PanelBody>
    </Panel>
  );
}
