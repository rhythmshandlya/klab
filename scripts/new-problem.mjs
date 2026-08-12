#!/usr/bin/env node
// Scaffold a schema-valid klab problem candidate.
//
//   pnpm new:problem <slug> "Human Title"
//
// The generated file uses the deterministic manifest-assessment runtime. Authors
// can keep it for policy/API scenarios or replace it with a richer scripted or
// Webernetes runtime. Registration and the canonical solution remain explicit
// review steps.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
const title = process.argv[3];

if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
  console.error('Usage: pnpm new:problem <slug> "Human Title"');
  console.error('  <slug> must be kebab-case, for example "wrong-container-port"');
  process.exit(1);
}

const camel = slug.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase());
const humanTitle =
  title ?? slug.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
const levelPath = join(root, "src/content/levels", `${slug}.ts`);

if (existsSync(levelPath)) {
  console.error(`Refusing to overwrite existing ${levelPath}`);
  process.exit(1);
}

const level = `import type { ProblemLevel } from "@/lib/domain/types";

import { PUBLISHED_PROBLEM_V1 } from "./metadata";

const INITIAL_YAML = \`apiVersion: v1
kind: Service
metadata:
  name: sample-service
  namespace: default
spec:
  selector:
    app: wrong-label
  ports:
    - name: http
      port: 80
      targetPort: 8080
\`;

export const ${camel} = {
  ...PUBLISHED_PROBLEM_V1,
  id: "${slug}",
  slug: "${slug}",
  title: "${humanTitle}",
  difficulty: "intermediate",
  severity: "high",
  xp: 150,
  estimatedMinutes: 20,
  successRate: 55,
  concepts: ["services", "labels-selectors", "debugging"],
  blurb: "Diagnose a production contract failure and repair it safely.",
  story: "A release passed admission, but its traffic contract is failing. Operators need a minimal repair that preserves the public interface.",
  objective: "Restore the declared service contract without weakening the surrounding safeguards.",
  learningObjectives: [
    "Correlate runtime evidence with the relevant manifest contract",
    "Make and verify the smallest safe declarative repair",
  ],
  prerequisites: ["service-selector-mismatch"],
  learningPaths: ["application-debugging", "sre-on-call"],
  capabilities: ["pods", "events", "logs", "http-probes"],
  engine: { kind: "scripted", scenarioId: "manifest-assessment" },
  constraints: [
    { kind: "editable-files", id: "edit-workload", label: "Edit only service.yaml", paths: ["service.yaml"] },
    {
      kind: "manifest",
      id: "service-contract",
      label: "The Service must select the production workload",
      file: "service.yaml",
      resource: { kind: "Service", name: "sample-service", namespace: "default" },
      exclusive: true,
      assertions: [{ path: "spec.selector.app", operator: "equals", value: "sample-app" }],
    },
  ],
  files: [
    { path: "service.yaml", language: "yaml", initialValue: INITIAL_YAML, access: "editable", applyAtBoot: false },
  ],
  quickCommands: [
    { id: "pods", command: "kubectl get pods" },
    { id: "events", command: "kubectl get events" },
    {
      id: "logs",
      command: "kubectl logs <pod>",
      target: { kind: "pod", namespace: "default", selector: { app: "manifest-assessment" }, prefer: "not-ready" },
    },
  ],
  referenceCommands: [
    "kubectl get service sample-service -o yaml",
    "kubectl get endpointslice -l kubernetes.io/service-name=sample-service",
    "kubectl get pods -l app=sample-app --show-labels",
    "kubectl describe service sample-service",
  ],
  probeTargets: ["http://assessment-svc/"],
  validators: [
    {
      id: "assessment-ready",
      title: "Production requirements pass",
      successLabel: "The configuration passes assessment",
      failureLabel: "The configuration still violates a production requirement",
      kind: "pod-ready-by-selector",
      namespace: "default",
      selector: { app: "manifest-assessment" },
      minReady: 1,
    },
  ],
  hints: [
    { id: "scope", title: "Find the contract", body: "Compare the objective with the fields owned by the editable resource.", xpPenalty: 10 },
    { id: "evidence", title: "Read the rejection", body: "Inspect the assessment event and policy-engine log before changing YAML.", xpPenalty: 20, unlockAfter: ["event"] },
    { id: "verify", title: "Verify the exact field", body: "Check the selector contract, apply, and evaluate the full design again.", xpPenalty: 30, unlockAfter: ["log"] },
  ],
  evidenceRules: [
    { id: "pods", evidenceId: "assessment-pod", label: "The assessment pod is not Ready", hiddenLabel: "Assessment status inspected", source: "terminal", trigger: { type: "command", commandMatches: "kubectl get pods" } },
    { id: "event", evidenceId: "rejection-event", label: "ConfigRejected reports unmet production requirements", hiddenLabel: "Admission evidence inspected", source: "events", trigger: { type: "event-reason", reason: "ConfigRejected" } },
    { id: "log", evidenceId: "policy-log", label: "The policy engine rejected the configuration", hiddenLabel: "Policy log inspected", source: "logs", trigger: { type: "log", messageMatches: "configuration rejected", podMatches: "manifest-assessment" } },
    { id: "validator", evidenceId: "failed-review", label: "The architecture check is failing", hiddenLabel: "Formal review run", source: "validator", trigger: { type: "validator", validatorId: "assessment-ready", passed: false } },
  ],
  postSolveExplanation: {
    rootCause: "The authored resource violated the workload contract used by the production system.",
    whyItFailed: "Kubernetes accepted structurally valid YAML, but the declared relationship could not produce the required behavior.",
    whatFixedIt: "The repair aligned the manifest with the required contract and passed the deterministic policy assessment.",
    prevention: "Encode the contract in CI policy, exercise the failure path before release, and review runtime evidence alongside YAML diffs.",
    relatedConcepts: ["services", "labels-selectors", "debugging"],
    recommendedNextSlugs: [],
  },
} satisfies ProblemLevel;
`;

mkdirSync(dirname(levelPath), { recursive: true });
writeFileSync(levelPath, level, "utf8");

console.log(`Created src/content/levels/${slug}.ts`);
console.log("Next steps:");
console.log(`1. Register ${camel} in src/content/levels/index.ts.`);
console.log(`2. Add a canonical solution for "${slug}" to src/content/levels/solutions.ts.`);
console.log("3. Replace the scaffold prose and assertions with the reviewed scenario design.");
console.log("4. Run pnpm audit:problems and pnpm test:levels before review.");
