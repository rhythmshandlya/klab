#!/usr/bin/env node
// AI-assisted problem generation. Drafts a candidate level with Claude, writes it to
// scripts/candidates/ for HUMAN REVIEW. It never lands in src/ unreviewed, and the
// solvability harness (pnpm test:levels) is the gate before it ships.
//
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-problems.mjs "a level about a Service targeting the wrong port"
//
// Output is code, reviewed like any PR contribution (see CONTRIBUTING.md).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const spec = process.argv.slice(2).join(" ").trim();

if (!spec) {
  console.error('Usage: node scripts/generate-problems.mjs "<what the level should teach>"');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY (see .env.example / the claude-api docs).");
  process.exit(1);
}

// The contract the model must satisfy. Kept terse; the schema + harness enforce the rest.
const SYSTEM = `You author production-grade problems for klab, a browser Kubernetes debugging game.

Produce ONE level as a TypeScript module plus its canonical solution. Hard rules:
- Use engine { kind: "webernetes" } only for Deployment, ReplicaSet, Pod, Service, Namespace, and Node scenarios. For other Kubernetes APIs use { kind: "scripted", scenarioId: "manifest-assessment" } and declare machine-checkable manifest constraints.
- Available images (by ref): klab/web-app:1.0.0 (/healthz 200, /readyz 404, / 200), klab/web-app:2.0.0 (500 everywhere), klab/web-app:0.9.0 (/healthz 200 but / 500), klab/api:1.0.0 (proxies UPSTREAM_URL), klab/worker:1.0.0 (exits unless DATABASE_URL set), klab/debug-tools:1.0.0.
- A workload that must sit BROKEN/not-Ready should be a bare Pod, not a Deployment (a Deployment whose pods never go Ready churns forever).
- Validator kinds: deployment-ready, service-has-ready-endpoints, http-get-through-service, http-sample-through-service, no-recent-readiness-failures, pod-ready-by-selector, pod-restarts-below, no-pods-matching. Each also needs id/title/successLabel/failureLabel.
- The level MUST be solvable by editing ONLY the editable file(s); the broken state must fail the validators and the canonical fix must pass them.
- Never reveal the fix in story/objective. Evidence labels state facts, hints escalate (with xpPenalty and unlockAfter), total hint penalty <= xp.
- Shape must match the current ProblemLevel type in src/lib/domain/types.ts. Include contentVersion, publicationStatus, challengeMode, learningObjectives, prerequisites, learningPaths, capabilities, kubernetesVersion, engine, machine-enforced constraints, files with access/applyAtBoot, structured quickCommands, at least four incident-specific referenceCommands, probeTargets, validators, at least three hints, at least four evidenceRules, and the complete postSolveExplanation including prevention and recommendedNextSlugs.
- Every incidentSource must be HTTPS, attribution "inspired-by", and include an adaptationNote of at least 80 characters saying the scenario is fictional and not an exact reproduction.
- Use no em dash characters. Never include TODO or placeholder copy.

Return EXACTLY two fenced blocks and nothing else:
1) a \`\`\`ts block: the full module. Import ProblemLevel from the domain types, then export one named level that satisfies ProblemLevel.
2) a \`\`\`json block: the solution, shaped { "fix": "<one-line>", "files": { "<path>": "<full fixed file contents>" } }, matching the editable file paths.`;

console.error(`Generating a level for: ${spec}\n(using claude-opus-4-8; this can take a minute)…`);

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const stream = client.messages.stream({
  model: "claude-opus-4-8",
  max_tokens: 64000,
  thinking: { type: "adaptive" },
  system: SYSTEM,
  messages: [{ role: "user", content: `Author a klab level: ${spec}` }],
});
const message = await stream.finalMessage();
const text = message.content
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("");

const ts = /```ts\n([\s\S]*?)```/.exec(text)?.[1]?.trim();
const jsonBlock = /```json\n([\s\S]*?)```/.exec(text)?.[1]?.trim();
if (!ts || !jsonBlock) {
  console.error("Model did not return the expected two fenced blocks. Raw output:\n");
  console.error(text);
  process.exit(1);
}

const slug = /slug:\s*["']([a-z][a-z0-9-]*)["']/.exec(ts)?.[1] ?? "generated-level";
const outDir = join(root, "scripts", "candidates");
mkdirSync(outDir, { recursive: true });
const levelPath = join(outDir, `${slug}.ts`);
const solutionPath = join(outDir, `${slug}.solution.json`);
writeFileSync(levelPath, ts + "\n", "utf8");
writeFileSync(solutionPath, jsonBlock + "\n", "utf8");

console.error(`\n✓ Wrote candidate:\n  ${levelPath}\n  ${solutionPath}\n`);
console.error("Review it, then to ship:");
console.error(`  1. Move ${slug}.ts into src/content/levels/ and register it in index.ts.`);
console.error(
  `  2. Add the solution's files under key "${slug}" in src/content/levels/solutions.ts.`,
);
console.error("  3. pnpm lint && pnpm test:levels  (content audit + broken→fails + fix→passes).");
console.error("  4. Open a PR. CI re-runs the harness on every contribution.");
