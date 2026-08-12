import type { EvidenceRule, EvidenceTrigger } from "@/lib/domain/types";
import { assertNever } from "@/lib/utils/exhaustive";

/**
 * Evidence is collected by matching declarative `EvidenceRule`s against
 * `InvestigationSignal`s the learner produces while investigating (terminal output,
 * network probes, viewed events). This module is pure and unit-tested: given rules
 * and signals, it reports which rules newly fired. The UX rule: never spoon-feed the
 * fix: lives in the level content (evidence labels state facts, not solutions).
 */

export type InvestigationSignal =
  | { type: "command"; command: string; output: string }
  | {
      type: "probe";
      method: "GET";
      url: string;
      host: string;
      port: number | null;
      path: string;
      status: number;
      body: string;
    }
  | { type: "event-reason"; reason: string; message: string; namespace: string }
  | { type: "log"; namespace: string; pod: string; message: string }
  | { type: "object-view"; kind: string; name: string; namespace: string }
  | { type: "topology-view"; kind: string; name: string; namespace: string }
  | { type: "validator"; validatorId: string; passed: boolean; detail: string };

export function createProbeSignal(
  url: string,
  result: { status: number; body: string },
): Extract<InvestigationSignal, { type: "probe" }> {
  try {
    const parsed = new URL(url);
    return {
      type: "probe",
      method: "GET",
      url,
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
      path: `${parsed.pathname}${parsed.search}`,
      status: result.status,
      body: result.body,
    };
  } catch {
    return {
      type: "probe",
      method: "GET",
      url,
      host: "",
      port: null,
      path: url,
      status: result.status,
      body: result.body,
    };
  }
}

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
      const hostRe = safeRegex(trigger.hostMatches);
      const pathRe = safeRegex(trigger.pathMatches);
      const bodyRe = trigger.bodyMatches ? safeRegex(trigger.bodyMatches) : null;
      return (
        hostRe !== null &&
        hostRe.test(signal.host) &&
        pathRe !== null &&
        pathRe.test(signal.path) &&
        trigger.status === signal.status &&
        (trigger.bodyMatches === undefined || (bodyRe !== null && bodyRe.test(signal.body)))
      );
    }
    case "event-reason": {
      if (signal.type !== "event-reason") return false;
      const messageRe = trigger.messageMatches ? safeRegex(trigger.messageMatches) : null;
      return (
        trigger.reason.toLowerCase() === signal.reason.toLowerCase() &&
        (trigger.messageMatches === undefined ||
          (messageRe !== null && messageRe.test(signal.message)))
      );
    }
    case "log": {
      if (signal.type !== "log") return false;
      const messageRe = safeRegex(trigger.messageMatches);
      const podRe = trigger.podMatches ? safeRegex(trigger.podMatches) : null;
      return (
        messageRe !== null &&
        messageRe.test(signal.message) &&
        (trigger.namespace === undefined || trigger.namespace === signal.namespace) &&
        (trigger.podMatches === undefined || (podRe !== null && podRe.test(signal.pod)))
      );
    }
    case "object-view":
    case "topology-view": {
      if (signal.type !== trigger.type) return false;
      const nameRe = safeRegex(trigger.nameMatches);
      return (
        trigger.kind.toLowerCase() === signal.kind.toLowerCase() &&
        nameRe !== null &&
        nameRe.test(signal.name) &&
        (trigger.namespace === undefined || trigger.namespace === signal.namespace)
      );
    }
    case "validator": {
      return (
        signal.type === "validator" &&
        trigger.validatorId === signal.validatorId &&
        trigger.passed === signal.passed
      );
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
