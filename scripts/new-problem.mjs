#!/usr/bin/env node
// Scaffold a new klab problem level from a template.
//
//   pnpm new:problem <slug> "Human Title"
//
// Writes src/content/levels/<slug>.ts (a working selector-mismatch level that already
// passes the solvability harness) and prints the two snippets to register it. Content
// stays 100% in code; every PR is gated by the red→green harness (see CONTRIBUTING.md).

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const slug = process.argv[2];
const title = process.argv[3];

if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
  console.error('Usage: pnpm new:problem <slug> "Human Title"');
  console.error('  <slug> must be kebab-case, e.g. "wrong-container-port"');
  process.exit(1);
}
const camel = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const humanTitle = title ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const levelPath = join(root, "src/content/levels", `${slug}.ts`);
if (existsSync(levelPath)) {
  console.error(`Refusing to overwrite existing ${levelPath}`);
  process.exit(1);
}

const level = `import type { ProblemLevel } from "@/lib/domain/types";

/**
 * Level: ${humanTitle}.
 *
 * TODO(author): describe the bug and the intended fix (never state the fix in the
 * story/objective — the learner connects the evidence). This template ships a working
 * selector-mismatch puzzle so it passes the harness out of the box; edit freely.
 */

const SERVICE_YAML = \`apiVersion: v1
kind: Service
metadata:
  name: web-svc
  namespace: default
spec:
  selector:
    app: web
  ports:
    - name: http
      port: 80
      targetPort: 8080
\`;

const DEPLOYMENT_YAML = \`apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: klab/web-app:1.0.0
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 1
            periodSeconds: 2
            timeoutSeconds: 2
\`;

export const ${camel} = {
  id: "${slug}",
  slug: "${slug}",
  title: "${humanTitle}",
  difficulty: "beginner",
  severity: "medium",
  xp: 100,
  estimatedMinutes: 15,
  successRate: 70,
  concepts: ["services", "labels-selectors", "debugging"],
  blurb: "TODO: one-line teaser for the catalog.",
  story: "TODO: the incident, in the operator's voice. Do not reveal the fix.",
  objective: "Make web-svc serve HTTP 200 again.",
  constraints: [{ id: "edit-svc-only", label: "Only edit service.yaml" }],
  files: [{ path: "service.yaml", language: "yaml", initialValue: SERVICE_YAML }],
  readonlyFiles: [{ path: "deployment.yaml", language: "yaml", value: DEPLOYMENT_YAML }],
  initialManifests: [DEPLOYMENT_YAML],
  registeredImages: [
    { ref: "klab/web-app:1.0.0", description: "Web server — /healthz 200, / 200." },
  ],
  allowedCommands: [
    "kubectl get pods",
    "kubectl get endpoints web-svc",
    "kubectl describe svc web-svc",
    "curl <url>",
  ],
  quickCommands: ["kubectl get pods", "kubectl get endpoints web-svc", "kubectl describe svc web-svc"],
  probeTargets: ["http://web-svc/", "http://web-svc/healthz"],
  validators: [
    {
      id: "http-200",
      title: "Service returns 200",
      successLabel: "GET / through web-svc returns 200",
      failureLabel: "GET / through web-svc does not return 200",
      kind: "http-get-through-service",
      namespace: "default",
      service: "web-svc",
      port: 80,
      path: "/",
      expectStatus: 200,
    },
    {
      id: "endpoints",
      title: "Service has ready endpoints",
      successLabel: "web-svc has ready endpoints",
      failureLabel: "web-svc has zero ready endpoints",
      kind: "service-has-ready-endpoints",
      namespace: "default",
      name: "web-svc",
      minReadyEndpoints: 2,
    },
  ],
  hints: [
    { id: "hint-1", title: "Start with the wiring", body: "TODO", xpPenalty: 15 },
    { id: "hint-2", title: "Compare selector and labels", body: "TODO", xpPenalty: 25, unlockAfter: ["r-selector"] },
    { id: "hint-3", title: "Fix the selector", body: "TODO", xpPenalty: 35 },
  ],
  evidenceRules: [
    {
      id: "r-selector",
      evidenceId: "svc-selector",
      label: "web-svc selects app=web",
      hiddenLabel: "Service selector inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "describe (svc|service)", outputMatches: "Selector:\\\\s+app=web\\\\s" },
    },
    {
      id: "r-no-endpoints",
      evidenceId: "svc-no-endpoints",
      label: "web-svc has no endpoints",
      hiddenLabel: "Service endpoints inspected",
      source: "terminal",
      trigger: { type: "command", commandMatches: "get endpoints", outputMatches: "<none>" },
    },
  ],
  postSolveExplanation: {
    rootCause: "TODO",
    whyItFailed: "TODO",
    whatFixedIt: "TODO",
    relatedConcepts: ["services", "labels-selectors"],
  },
} satisfies ProblemLevel;
`;

mkdirSync(dirname(levelPath), { recursive: true });
writeFileSync(levelPath, level, "utf8");

console.log(`\n✓ Created src/content/levels/${slug}.ts\n`);
console.log("Next steps:\n");
console.log(`1. Register it in src/content/levels/index.ts:`);
console.log(`     import { ${camel} } from "./${slug}";`);
console.log(`   …and add \`${camel},\` to the LEVELS array.\n`);
console.log(`2. Add the canonical solution to src/content/levels/solutions.ts under key "${slug}"`);
console.log(`   (the edited files that make the validators pass — for this template, service.yaml`);
console.log(`    with selector app: web-app).\n`);
console.log(`3. Prove it: \`pnpm test:levels\` (content audit + broken→fails + fix→passes).\n`);
console.log(
  `4. Fill in the TODOs (story, hints, evidence, postSolveExplanation) and \`pnpm lint\`.\n`,
);
