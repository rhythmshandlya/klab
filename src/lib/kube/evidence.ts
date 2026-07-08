import type { EvidenceRule, EvidenceTrigger } from "@/lib/domain/types";
import { assertNever } from "@/lib/utils/exhaustive";

/**
 * Evidence is collected by matching declarative `EvidenceRule`s against
 * `InvestigationSignal`s the learner produces while investigating (terminal output,
 * network probes, viewed events). This module is pure and unit-tested: given rules
 * and signals, it reports which rules newly fired. The UX rule — never spoon-feed the
 * fix — lives in the level content (evidence labels state facts, not solutions).
 */

export type InvestigationSignal =
  | { type: "command"; command: string; output: string }
  | { type: "probe"; path: string; status: number }
  | { type: "event-reason"; reason: string };

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

function triggerMatchesSignal(trigger: EvidenceTrigger, signal: InvestigationSignal): boolean {
  switch (trigger.type) {
    case "command": {
      if (signal.type !== "command") return false;
      const commandRe = safeRegex(trigger.commandMatches);
      if (!commandRe || !commandRe.test(signal.command)) return false;
      if (trigger.outputMatches === undefined) return true;
      const outputRe = safeRegex(trigger.outputMatches);
      return outputRe !== null && outputRe.test(signal.output);
    }
    case "probe": {
      if (signal.type !== "probe") return false;
      const pathRe = safeRegex(trigger.pathMatches);
      return pathRe !== null && pathRe.test(signal.path) && trigger.status === signal.status;
    }
    case "event-reason": {
      if (signal.type !== "event-reason") return false;
      return trigger.reason.toLowerCase() === signal.reason.toLowerCase();
    }
    default:
      return assertNever(trigger);
  }
}

/** Returns the evidenceIds of rules that match any of the given signals. */
export function matchEvidence(
  rules: readonly EvidenceRule[],
  signals: readonly InvestigationSignal[],
): string[] {
  const matched = new Set<string>();
  for (const rule of rules) {
    if (signals.some((signal) => triggerMatchesSignal(rule.trigger, signal))) {
      matched.add(rule.evidenceId);
    }
  }
  return [...matched];
}

/**
 * Fold newly-matched evidence into an existing collected set, returning the updated
 * set and which ids are newly collected (for UI toasts/animations).
 */
export function collectEvidence(
  rules: readonly EvidenceRule[],
  signals: readonly InvestigationSignal[],
  alreadyCollected: ReadonlySet<string>,
): { collected: Set<string>; newlyCollected: string[] } {
  const collected = new Set(alreadyCollected);
  const newlyCollected: string[] = [];
  for (const evidenceId of matchEvidence(rules, signals)) {
    if (!collected.has(evidenceId)) {
      collected.add(evidenceId);
      newlyCollected.push(evidenceId);
    }
  }
  return { collected, newlyCollected };
}
