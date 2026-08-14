import type { LevelConstraint, ManifestAssertion, ProblemLevel } from "@/lib/domain/types";

import { evaluateGoal } from "./goal-checks";
import { parseKubernetesManifests } from "./manifest-parser";
import type { ValidatorResult } from "./validators";

/**
 * Constraint results carry two levels of feedback. `detail` is observational and is
 * shown for free while the learner works: it reports how much of the requirement is
 * unmet, never which field to set or what to set it to. `diagnostic` is the
 * prescriptive expected-vs-found breakdown, revealed only once the learner formally
 * submits. Keeping the answer out of the always-visible panel is what makes the hint
 * economy (and the recorded success rate) mean anything.
 */
interface ConstraintOutcome {
  passed: boolean;
  detail: string;
  diagnostic?: string;
}

export function evaluateLevelConstraints(
  level: ProblemLevel,
  currentFiles: Readonly<Record<string, string>>,
): ValidatorResult[] {
  return level.constraints.map((constraint) => evaluateConstraint(level, constraint, currentFiles));
}

function evaluateConstraint(
  level: ProblemLevel,
  constraint: LevelConstraint,
  currentFiles: Readonly<Record<string, string>>,
): ValidatorResult {
  const outcome =
    constraint.kind === "editable-files"
      ? evaluateEditableFiles(level, constraint.paths, currentFiles)
      : evaluateManifestConstraint(level, constraint, currentFiles);

  return {
    id: `constraint:${constraint.id}`,
    title: `Constraint: ${constraint.label}`,
    passed: outcome.passed,
    detail: outcome.detail,
    diagnostic: outcome.diagnostic,
    // The requirement itself is the headline: it states the goal without stating the fix.
    label: constraint.label,
  };
}

function evaluateEditableFiles(
  level: ProblemLevel,
  allowedPaths: readonly string[],
  currentFiles: Readonly<Record<string, string>>,
): ConstraintOutcome {
  const allowed = new Set(allowedPaths);
  const configuredEditable = level.files.filter((file) => file.access === "editable");
  const misconfigured = configuredEditable
    .map((file) => file.path)
    .filter((path) => !allowed.has(path));
  const changedOutsideAllowed = level.files
    .filter((file) => (currentFiles[file.path] ?? file.initialValue) !== file.initialValue)
    .map((file) => file.path)
    .filter((path) => !allowed.has(path));
  const missingEditable = allowedPaths.filter(
    (path) => !configuredEditable.some((file) => file.path === path),
  );
  const violations = [...new Set([...misconfigured, ...changedOutsideAllowed, ...missingEditable])];

  return violations.length === 0
    ? { passed: true, detail: `Edits are limited to ${allowedPaths.join(", ")}` }
    : { passed: false, detail: `Unexpected editable or changed file(s): ${violations.join(", ")}` };
}

function evaluateManifestConstraint(
  level: ProblemLevel,
  constraint: Extract<LevelConstraint, { kind: "manifest" }>,
  currentFiles: Readonly<Record<string, string>>,
): ConstraintOutcome {
  const authoredFile = level.files.find((file) => file.path === constraint.file);
  if (!authoredFile) {
    return { passed: false, detail: `Authored file ${constraint.file} is missing` };
  }

  // Structural feedback (unparseable YAML, wrong document count, missing resource) is
  // not an answer: the learner cannot make progress without it, and the required
  // resource identity is already stated in the constraint label.
  const parsed = parseKubernetesManifests(
    currentFiles[constraint.file] ?? authoredFile.initialValue,
  );
  if (!parsed.ok) {
    return { passed: false, detail: `${constraint.file}: ${parsed.error.message}` };
  }
  if (constraint.exclusive && parsed.value.length !== 1) {
    return {
      passed: false,
      detail: `${constraint.file} must contain exactly one Kubernetes resource; found ${parsed.value.length}`,
    };
  }

  const namespace = constraint.resource.namespace ?? "default";
  const resource = parsed.value.find(
    (manifest) =>
      manifest.kind === constraint.resource.kind &&
      manifest.name === constraint.resource.name &&
      manifest.namespace === namespace,
  );
  if (!resource) {
    return {
      passed: false,
      detail: `${constraint.resource.kind} ${namespace}/${constraint.resource.name} is missing from ${constraint.file}`,
    };
  }

  const failedAssertions = constraint.assertions.filter(
    (assertion) => !assertionPasses(assertion, valueAtPath(resource.raw, assertion.path)),
  );
  // Goals are graded first in the report because they describe the outcome the
  // incident is about; assertions only pin details that are genuinely exact.
  const goals = (constraint.goals ?? []).map((goal) => ({
    goal,
    result: evaluateGoal(goal, resource.raw),
  }));
  const failedGoals = goals.filter((entry) => !entry.result.passed);

  const total = constraint.assertions.length + goals.length;
  const failed = failedAssertions.length + failedGoals.length;

  if (failed === 0) {
    return {
      passed: true,
      detail: `${total} manifest requirement${total === 1 ? "" : "s"} satisfied`,
    };
  }

  const subject = `${constraint.resource.kind}/${constraint.resource.name}`;
  return {
    passed: false,
    // A goal's own summary is written to be safe before submission, so surfacing it
    // here tells the learner what the design fails to achieve without naming a field.
    detail:
      failedGoals.length > 0
        ? `${subject} ${failedGoals[0]!.result.summary}`
        : `${constraint.file} does not yet satisfy ${failed} of ${total} requirement${
            total === 1 ? "" : "s"
          } for ${subject}`,
    diagnostic: [
      ...failedGoals.map((entry) => entry.result.diagnostic),
      ...failedAssertions.map(
        (assertion) =>
          `${assertion.path} ${formatExpectation(assertion)}; found ${formatValue(
            valueAtPath(resource.raw, assertion.path),
          )}`,
      ),
    ].join("\n"),
  };
}

/**
 * Path grammar. Dotted keys and JSON-pointer form address objects; `[field=value]`
 * addresses a list entry by identity instead of position.
 *
 *   spec.template.spec.containers[name=api].readinessProbe.httpGet.port
 *
 * Kubernetes treats most of its lists as keyed maps (containers by name, env by name,
 * ports by name), so position carries no meaning. Pinning `containers.0` rejected a
 * correct manifest the moment a learner added a sidecar above the app container.
 * Positional addressing is still available, and still correct, for genuinely ordered
 * lists such as `command` and RBAC `rules`.
 */
export type PathStep =
  | { kind: "key"; key: string }
  | { kind: "index"; index: number }
  | { kind: "match"; field: string; value: string };

const MATCH_SEGMENT = /^([^[\]]+)\[([^=\]]+)=([^\]]*)\]$/;

/** Split on dots that are not inside a `[field=value]` selector. */
function splitDotPath(path: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of path) {
    if (char === "[") depth += 1;
    else if (char === "]") depth -= 1;
    else if (char === "." && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

/** Exported so tests can walk (and mutate) a manifest by the same grammar. */
export function parseManifestPath(path: string): PathStep[] {
  if (path.startsWith("/")) {
    return path
      .slice(1)
      .split("/")
      .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
      .map((key) =>
        /^\d+$/.test(key)
          ? { kind: "index" as const, index: Number(key) }
          : { kind: "key" as const, key },
      );
  }

  return splitDotPath(path).flatMap((segment): PathStep[] => {
    const selector = MATCH_SEGMENT.exec(segment);
    if (selector) {
      return [
        { kind: "key", key: selector[1]! },
        { kind: "match", field: selector[2]!, value: selector[3]! },
      ];
    }
    return [
      /^\d+$/.test(segment)
        ? { kind: "index", index: Number(segment) }
        : { kind: "key", key: segment },
    ];
  });
}

function valueAtPath(root: unknown, path: string): unknown {
  return parseManifestPath(path).reduce<unknown>((value, step) => {
    if (step.kind === "index") {
      if (Array.isArray(value)) return value[step.index];
      // A numeric segment can still be a genuine object key (a numeric port map).
      return typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[String(step.index)]
        : undefined;
    }
    if (step.kind === "match") {
      if (!Array.isArray(value)) return undefined;
      return value.find(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          String((entry as Record<string, unknown>)[step.field]) === step.value,
      );
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return (value as Record<string, unknown>)[step.key];
    }
    return undefined;
  }, root);
}

function assertionPasses(assertion: ManifestAssertion, actual: unknown): boolean {
  switch (assertion.operator) {
    case "present":
      return actual !== undefined && actual !== null;
    case "absent":
      return actual === undefined || actual === null;
    case "empty-object":
      return (
        typeof actual === "object" &&
        actual !== null &&
        !Array.isArray(actual) &&
        Object.keys(actual).length === 0
      );
    case "base64":
      // Padding is optional in practice (and `kubectl create secret` omits it for
      // some encoders), so accept any length except the one that cannot be base64.
      return (
        typeof actual === "string" &&
        actual.length > 0 &&
        actual.length % 4 !== 1 &&
        /^[A-Za-z0-9+/]+={0,2}$/.test(actual) &&
        (actual.length % 4 === 0 || !actual.endsWith("="))
      );
    case "length-equals":
      return Array.isArray(actual) || typeof actual === "string"
        ? actual.length === assertion.value
        : typeof actual === "object" && actual !== null
          ? Object.keys(actual).length === assertion.value
          : false;
    case "equals":
      return actual === assertion.value;
    case "not-equals":
      return actual !== assertion.value;
    case "gte":
      return typeof actual === "number" && actual >= Number(assertion.value);
    case "lte":
      return typeof actual === "number" && actual <= Number(assertion.value);
    case "matches":
      try {
        return new RegExp(String(assertion.value)).test(String(actual ?? ""));
      } catch {
        return false;
      }
    case "not-matches":
      // An absent field cannot match a forbidden pattern. Requiring the field to
      // exist here would reject the safest possible manifest; pair this operator
      // with `present` when the field is also mandatory.
      if (actual === undefined || actual === null) return true;
      try {
        return !new RegExp(String(assertion.value)).test(String(actual));
      } catch {
        return false;
      }
    case "array-contains":
      return Array.isArray(actual) && actual.includes(assertion.value);
    case "array-not-contains":
      // Same reasoning as `not-matches`: an absent list contains nothing.
      if (actual === undefined || actual === null) return true;
      return Array.isArray(actual) && !actual.includes(assertion.value);
  }
}

function formatExpectation(assertion: ManifestAssertion): string {
  switch (assertion.operator) {
    case "present":
      return "must be present";
    case "absent":
      return "must be absent";
    case "empty-object":
      return "must be an empty object";
    case "base64":
      return "must be valid base64 data";
    case "length-equals":
      return `must contain exactly ${assertion.value} item${assertion.value === 1 ? "" : "s"}`;
    case "equals":
      return `must equal ${formatValue(assertion.value)}`;
    case "not-equals":
      return `must not equal ${formatValue(assertion.value)}`;
    case "gte":
      return `must be at least ${formatValue(assertion.value)}`;
    case "lte":
      return `must be at most ${formatValue(assertion.value)}`;
    case "matches":
      return `must match ${formatValue(assertion.value)}`;
    case "not-matches":
      return `must not match ${formatValue(assertion.value)}`;
    case "array-contains":
      return `must contain ${formatValue(assertion.value)}`;
    case "array-not-contains":
      return `must not contain ${formatValue(assertion.value)}`;
  }
}

/** Nested objects can be enormous; the diagnostic is a hint, not a dump. */
const MAX_VALUE_CHARS = 120;

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  const rendered = JSON.stringify(value) ?? String(value);
  return rendered.length > MAX_VALUE_CHARS
    ? `${rendered.slice(0, MAX_VALUE_CHARS - 1)}…`
    : rendered;
}
