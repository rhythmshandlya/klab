import type { LevelConstraint, ManifestAssertion, ProblemLevel } from "@/lib/domain/types";

import { parseManifests } from "./manifest-parser";
import type { ValidatorResult } from "./validators";

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
    label: outcome.passed ? "Constraint respected" : "Constraint violated",
  };
}

function evaluateEditableFiles(
  level: ProblemLevel,
  allowedPaths: readonly string[],
  currentFiles: Readonly<Record<string, string>>,
): { passed: boolean; detail: string } {
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
): { passed: boolean; detail: string } {
  const authoredFile = level.files.find((file) => file.path === constraint.file);
  if (!authoredFile) {
    return { passed: false, detail: `Authored file ${constraint.file} is missing` };
  }

  const parsed = parseManifests(currentFiles[constraint.file] ?? authoredFile.initialValue);
  if (!parsed.ok) {
    return { passed: false, detail: `${constraint.file}: ${parsed.error.message}` };
  }
  if (constraint.exclusive && parsed.value.length !== 1) {
    return {
      passed: false,
      detail: `${constraint.file} must contain exactly one Kubernetes resource; found ${parsed.value.length}`,
    };
  }

  const resource = parsed.value.find(
    (manifest) =>
      manifest.kind === constraint.resource.kind &&
      manifest.name === constraint.resource.name &&
      manifest.namespace === (constraint.resource.namespace ?? "default"),
  );
  if (!resource) {
    const namespace = constraint.resource.namespace ?? "default";
    return {
      passed: false,
      detail: `${constraint.resource.kind} ${namespace}/${constraint.resource.name} is missing from ${constraint.file}`,
    };
  }

  for (const assertion of constraint.assertions) {
    const actual = valueAtPath(resource.raw, assertion.path);
    if (!assertionPasses(assertion, actual)) {
      return {
        passed: false,
        detail: `${assertion.path} ${formatExpectation(assertion)}; found ${formatValue(actual)}`,
      };
    }
  }

  return {
    passed: true,
    detail: `${constraint.assertions.length} manifest assertion${constraint.assertions.length === 1 ? "" : "s"} satisfied`,
  };
}

function valueAtPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (Array.isArray(value) && /^\d+$/.test(segment)) return value[Number(segment)];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return (value as Record<string, unknown>)[segment];
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
  }
}

function formatExpectation(assertion: ManifestAssertion): string {
  switch (assertion.operator) {
    case "present":
      return "must be present";
    case "absent":
      return "must be absent";
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
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  return typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);
}
