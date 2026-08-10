import { loadAll } from "js-yaml";

export interface PublishSafetyIssue {
  path: string;
  message: string;
}

const SENSITIVE_FILE = /(^|\/)(\.env(?:\.|$)|id_rsa(?:\.|$)|kubeconfig(?:\.|$))/i;
const SENSITIVE_KEY =
  /^(password|passwd|token|api[_-]?key|client[_-]?secret|private[_-]?key|access[_-]?key|secret[_-]?access[_-]?key|authorization)$/i;
const SENSITIVE_ENV_NAME =
  /(password|passwd|token|api[_-]?key|client[_-]?secret|private[_-]?key|secret[_-]?access[_-]?key)/i;
const PLACEHOLDER = /^(|changeme|replace[_-]?me|example|dummy|<[^>]+>|\$\{[^}]+\}|\{\{[^}]+\}\})$/i;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function containsMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return !PLACEHOLDER.test(value.trim());
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(containsMeaningfulValue);
  const object = record(value);
  return object ? Object.values(object).some(containsMeaningfulValue) : false;
}

function scanNode(
  value: unknown,
  filePath: string,
  trail: string,
  issues: PublishSafetyIssue[],
): void {
  if (issues.length >= 10) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanNode(item, filePath, `${trail}[${index}]`, issues));
    return;
  }
  const object = record(value);
  if (!object) return;

  if (typeof object.kind === "string" && object.kind.toLowerCase() === "secret") {
    issues.push({
      path: filePath,
      message: "Kubernetes Secret resources cannot be published. Replace them with placeholders.",
    });
    return;
  }

  if (
    typeof object.name === "string" &&
    SENSITIVE_ENV_NAME.test(object.name) &&
    "value" in object &&
    containsMeaningfulValue(object.value)
  ) {
    issues.push({
      path: filePath,
      message: `Possible credential in ${trail}.value (${object.name}). Use a placeholder before publishing.`,
    });
  }

  for (const [key, child] of Object.entries(object)) {
    if (SENSITIVE_KEY.test(key) && containsMeaningfulValue(child)) {
      issues.push({
        path: filePath,
        message: `Possible credential in ${trail}.${key}. Use a placeholder before publishing.`,
      });
    }
    scanNode(child, filePath, `${trail}.${key}`, issues);
  }
}

/** Conservative server-side guard before a manifest snapshot becomes public. */
export function checkPlaygroundPublishSafety(
  files: Readonly<Record<string, string>>,
): PublishSafetyIssue[] {
  const issues: PublishSafetyIssue[] = [];
  for (const [filePath, contents] of Object.entries(files)) {
    if (SENSITIVE_FILE.test(filePath)) {
      issues.push({
        path: filePath,
        message: "This filename commonly contains credentials and cannot be published.",
      });
      continue;
    }
    try {
      for (const document of loadAll(contents)) scanNode(document, filePath, "$", issues);
    } catch {
      // Malformed YAML cannot be inspected structurally. Blocking it closes an easy
      // scanner bypass and asks the author to make the public artifact reproducible.
      issues.push({
        path: filePath,
        message: "Fix this file's YAML syntax before publishing so it can be checked safely.",
      });
    }
  }

  return issues.filter(
    (issue, index, all) =>
      all.findIndex(
        (candidate) => candidate.path === issue.path && candidate.message === issue.message,
      ) === index,
  );
}
