# Mission-Based `/docs` Learning Experience — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/docs` from a passive read-then-maybe-do textbook into a doing-first, mission-based experience — single-screen gated steps, a persistent cluster that grows across each section, and immersive React-Flow diagrams — proving the loop on Foundations before batching the rest.

**Architecture:** A new `Mission`/`MissionStep` content type (Zod-validated) lives beside the existing `DocsLesson`. A `SectionPlayer` client component owns ONE `KubeSimulator` for a whole section and swaps missions client-side (so the cluster persists), rendering one gated step at a time via per-kind step renderers. Diagrams standardize on React Flow (`@xyflow/react`), reusing the lab's live `ServiceTopology` and adding step-synced concept graphs. The catch-all docs route renders the player for migrated sections and falls back to the legacy `DocsPage` for not-yet-migrated slugs (a temporary scaffold, deleted when all sections are migrated).

**Tech Stack:** Next.js (App Router, RSC + client components), TypeScript, Zod, React Flow (`@xyflow/react`), Vitest, the existing `KubeSimulator` + `runCommandLine` + `useSimulator`, Tailwind.

## Global Constraints

- All 37 lessons ultimately migrate; **this plan (Plan 1) delivers the engine + all 6 Foundations missions** as the validation gate. The remaining 31 are a follow-up plan.
- Reuse existing infra — **no new simulator**: `useSimulator`, `runCommandLine`, `YamlEditor`, `XtermTerminal`, `ServiceTopology`, sim predicates (`isPodReady`, `readyEndpointCount`, `deploymentReadyReplicas`, `podPhase`).
- Progress is grow-only and cloud-synced via `mutateProgress({ kind: "completedLesson", slug })`; only **mission completion** writes to it. Per-step position is local.
- No gamification (XP/streaks/leagues/mascot) and no spaced-repetition in this plan.
- Content stays code (typed objects + Zod), not MDX — mirror the existing `src/content/docs/index.ts` pattern.
- Every mission step must have a required action (no scroll-past). A `do` step may only require concepts taught by an earlier step/mission. First `do` in Foundations mission 1 is a *tiny* action (set `replicas`, apply), never spot-the-bug.
- Follow existing conventions: `@/`-alias imports, `cn()` for classes, `palette` tokens, Vitest colocated under `src/tests/`.

---

## File Structure

**New:**
- `src/lib/domain/mission-types.ts` — `Mission`, `MissionStep` (discriminated union), `DiagramSpec`, `DoCheck` types.
- `src/lib/domain/mission-schema.ts` — Zod `missionSchema`, `parseMission`, invariant checks.
- `src/content/missions/index.ts` — registry: `MISSIONS`, `getMissionBySlug`, `getMissionsBySection`, `MISSION_SECTIONS`, `isMissionSection`.
- `src/content/missions/foundations/*.ts` — the 6 authored Foundations missions (one file each).
- `src/lib/kube/mission-check.ts` — pure `evaluateDoCheck(snapshot, check)` → `{ passed, detail }` using existing predicates.
- `src/features/docs/mission/section-player.tsx` — owns the section's simulator, swaps missions, syncs URL.
- `src/features/docs/mission/mission-runner.tsx` — runs one mission's steps: rail, cold open, gating, completion.
- `src/features/docs/mission/steps/{teach,predict,check,do,debrief}-step.tsx` — one renderer per step kind.
- `src/features/docs/mission/mission-diagram.tsx` — React-Flow diagram (live | concept | static).
- `src/features/docs/mission/journey-home.tsx` — path/journey view for migrated sections.

**Modified:**
- `src/app/docs/[...slug]/page.tsx` — route to `SectionPlayer` for mission slugs, legacy `DocsPage` otherwise.
- `src/features/docs/components/docs-home.tsx` — render `JourneyHome` for migrated sections.
- `src/tests/unit/content.test.ts` — extend with mission-content invariants.

**Deleted (final task, after all Foundations migrated + loop validated):** none in Plan 1 (legacy path stays as scaffold until every section is migrated in Plan 2). The static diagram components in `docs-content.tsx` are retired in Plan 2.

---

## Task 1: Mission content types

**Files:**
- Create: `src/lib/domain/mission-types.ts`
- Test: (types only — exercised via schema in Task 2)

**Interfaces:**
- Produces: `Mission`, `MissionStep`, `DiagramSpec`, `DoCheck`, `PredictSpec`, `QuizSpec` (all `export type`/`interface`).

- [ ] **Step 1: Write the types**

```ts
// src/lib/domain/mission-types.ts
import type { EditableFile } from "./types";

/** A React-Flow-backed teaching diagram. */
export type DiagramSpec =
  | { mode: "live" } // renders the section's current cluster via ServiceTopology
  | { mode: "concept"; variant: ConceptDiagramVariant; buildToStep: number }
  | { mode: "static"; variant: ConceptDiagramVariant };

export type ConceptDiagramVariant =
  | "control-loop"
  | "cluster-architecture"
  | "api-object"
  | "workload-hierarchy"
  | "service-routing";

export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
  explain: string;
}

export interface QuizSpec {
  question: string;
  options: QuizOption[];
}

export interface PredictSpec {
  question: string;
  options: QuizOption[];
  reveal: string;
}

/** A check evaluated against the live cluster snapshot after the learner applies. */
export type DoCheck =
  | { kind: "pods-ready"; selector: Record<string, string>; minReady: number }
  | { kind: "deployment-available"; name: string; minAvailable: number }
  | { kind: "service-has-endpoints"; name: string; minEndpoints: number };

export type MissionStep =
  | { kind: "teach"; id: string; idea: string; visual?: DiagramSpec; ack?: string }
  | { kind: "predict"; id: string; predict: PredictSpec; visual?: DiagramSpec }
  | { kind: "check"; id: string; quiz: QuizSpec }
  | {
      kind: "do";
      id: string;
      goal: string;
      files: EditableFile[];
      check: DoCheck;
      hint?: string;
      debrief: string;
    }
  | { kind: "debrief"; id: string; summary: string; commands?: string[]; takeaways: string[] };

export interface Mission {
  slug: string[]; // e.g. ["foundations", "what-is-kubernetes"]
  section: string; // "Foundations"
  order: number;
  title: string;
  coldOpen: { goal: string; clusterNote: string };
  steps: MissionStep[];
  /** false for the first mission of a section; true means inherit the prior mission's cluster. */
  inheritsCluster: boolean;
  /** Manifests applied when the mission does NOT inherit (fresh section start). */
  seedManifests?: string[];
  concepts: string[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no references yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/domain/mission-types.ts
git commit -m "feat(docs): mission content types"
```

> **Note on `EditableFile`:** confirm its export in `src/lib/domain/types.ts` (used by `InteractiveLab.files`). If it is named `EditableFile` with `{ path: string; initialValue: string; language: EditableFileLanguage }`, import it; if the name differs, use the actual exported name.

---

## Task 2: Mission Zod schema + invariants

**Files:**
- Create: `src/lib/domain/mission-schema.ts`
- Test: `src/tests/unit/mission-schema.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces: `missionSchema` (Zod), `parseMission(input: unknown): Mission`, `assertMissionInvariants(m: Mission): void`.

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/unit/mission-schema.test.ts
import { describe, expect, it } from "vitest";
import { parseMission, assertMissionInvariants } from "@/lib/domain/mission-schema";
import type { Mission } from "@/lib/domain/mission-types";

const valid: Mission = {
  slug: ["foundations", "what-is-kubernetes"],
  section: "Foundations",
  order: 1,
  title: "What is Kubernetes?",
  coldOpen: { goal: "Get one Pod running.", clusterNote: "Empty cluster." },
  inheritsCluster: false,
  seedManifests: [],
  concepts: ["pods"],
  steps: [
    { kind: "teach", id: "t1", idea: "A cluster runs your desired state." },
    { kind: "check", id: "c1", quiz: { question: "Q?", options: [
      { id: "a", text: "yes", correct: true, explain: "right" },
      { id: "b", text: "no", correct: false, explain: "nope" },
    ] } },
    { kind: "do", id: "d1", goal: "Apply a Pod.", files: [
      { path: "pod.yaml", initialValue: "apiVersion: v1", language: "yaml" },
    ], check: { kind: "pods-ready", selector: { app: "web" }, minReady: 1 }, debrief: "Done." },
  ],
};

describe("parseMission", () => {
  it("accepts a valid mission", () => {
    expect(parseMission(valid).slug).toEqual(["foundations", "what-is-kubernetes"]);
  });
  it("rejects a mission with no steps", () => {
    expect(() => parseMission({ ...valid, steps: [] })).toThrow();
  });
  it("rejects an unknown step kind", () => {
    expect(() => parseMission({ ...valid, steps: [{ kind: "nope", id: "x" }] })).toThrow();
  });
});

describe("assertMissionInvariants", () => {
  it("passes when a quiz has exactly one correct option", () => {
    expect(() => assertMissionInvariants(valid)).not.toThrow();
  });
  it("throws when a quiz has no correct option", () => {
    const bad = structuredClone(valid);
    (bad.steps[1] as { quiz: QuizSpecLike }).quiz.options.forEach((o) => (o.correct = false));
    expect(() => assertMissionInvariants(bad)).toThrow(/exactly one correct/);
  });
  it("throws when step ids are not unique", () => {
    const bad = structuredClone(valid);
    bad.steps[1].id = "t1";
    expect(() => assertMissionInvariants(bad)).toThrow(/unique/);
  });
});

type QuizSpecLike = { options: { correct: boolean }[] };
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/unit/mission-schema.test.ts`
Expected: FAIL ("Cannot find module '@/lib/domain/mission-schema'").

- [ ] **Step 3: Implement schema + invariants**

```ts
// src/lib/domain/mission-schema.ts
import { z } from "zod";
import type { Mission } from "./mission-types";

const quizOption = z.object({
  id: z.string(),
  text: z.string().min(1),
  correct: z.boolean(),
  explain: z.string().min(1),
});
const quiz = z.object({ question: z.string().min(1), options: z.array(quizOption).min(2) });
const editableFile = z.object({
  path: z.string(),
  initialValue: z.string(),
  language: z.enum(["yaml", "json", "typescript", "markdown"]),
});
const conceptDiagramVariant = z.enum(["control-loop", "cluster-architecture", "api-object", "workload-hierarchy", "service-routing"]);
const diagramSpec = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("live") }),
  z.object({ mode: z.literal("concept"), variant: conceptDiagramVariant, buildToStep: z.number().int() }),
  z.object({ mode: z.literal("static"), variant: conceptDiagramVariant }),
]);
const doCheck = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pods-ready"), selector: z.record(z.string(), z.string()), minReady: z.number().int().positive() }),
  z.object({ kind: z.literal("deployment-available"), name: z.string(), minAvailable: z.number().int().positive() }),
  z.object({ kind: z.literal("service-has-endpoints"), name: z.string(), minEndpoints: z.number().int().positive() }),
]);
const step = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("teach"), id: z.string(), idea: z.string().min(1), visual: diagramSpec.optional(), ack: z.string().optional() }),
  z.object({ kind: z.literal("predict"), id: z.string(), predict: z.object({ question: z.string().min(1), options: z.array(quizOption).min(2), reveal: z.string().min(1) }), visual: diagramSpec.optional() }),
  z.object({ kind: z.literal("check"), id: z.string(), quiz }),
  z.object({ kind: z.literal("do"), id: z.string(), goal: z.string().min(1), files: z.array(editableFile).min(1), check: doCheck, hint: z.string().optional(), debrief: z.string().min(1) }),
  z.object({ kind: z.literal("debrief"), id: z.string(), summary: z.string().min(1), commands: z.array(z.string()).optional(), takeaways: z.array(z.string()).min(1) }),
]);

export const missionSchema = z.object({
  slug: z.array(z.string()).min(1),
  section: z.string().min(1),
  order: z.number().int(),
  title: z.string().min(1),
  coldOpen: z.object({ goal: z.string().min(1), clusterNote: z.string().min(1) }),
  steps: z.array(step).min(1),
  inheritsCluster: z.boolean(),
  seedManifests: z.array(z.string()).optional(),
  concepts: z.array(z.string()),
});

export function parseMission(input: unknown): Mission {
  return missionSchema.parse(input) as Mission;
}

export function assertMissionInvariants(m: Mission): void {
  const ids = new Set<string>();
  for (const s of m.steps) {
    if (ids.has(s.id)) throw new Error(`Mission ${m.slug.join("/")}: step ids must be unique (${s.id})`);
    ids.add(s.id);
    if (s.kind === "check") {
      const correct = s.quiz.options.filter((o) => o.correct).length;
      if (correct !== 1) throw new Error(`Mission ${m.slug.join("/")} step ${s.id}: quiz must have exactly one correct option`);
    }
    if (s.kind === "predict") {
      const correct = s.predict.options.filter((o) => o.correct).length;
      if (correct !== 1) throw new Error(`Mission ${m.slug.join("/")} step ${s.id}: predict must have exactly one correct option`);
    }
  }
  if (!m.inheritsCluster && !m.seedManifests) {
    throw new Error(`Mission ${m.slug.join("/")}: a non-inheriting mission must define seedManifests`);
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/tests/unit/mission-schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/mission-schema.ts src/tests/unit/mission-schema.test.ts
git commit -m "feat(docs): mission zod schema + invariants"
```

---

## Task 3: `evaluateDoCheck` — pure cluster-state validation

**Files:**
- Create: `src/lib/kube/mission-check.ts`
- Test: `src/tests/unit/mission-check.test.ts`

**Interfaces:**
- Consumes: `DoCheck` (Task 1); `ClusterSnapshot` from `@/lib/kube/simulator`; predicates `isPodReady`, `readyEndpointCount`, `deploymentReadyReplicas` from `@/lib/kube/kubectl/format`.
- Produces: `evaluateDoCheck(snapshot: ClusterSnapshot, check: DoCheck, namespace?: string): { passed: boolean; detail: string }`.

- [ ] **Step 1: Write failing test** (build snapshots with the existing test helpers if present; otherwise minimal literals matching `ClusterSnapshot`).

```ts
// src/tests/unit/mission-check.test.ts
import { describe, expect, it } from "vitest";
import { evaluateDoCheck } from "@/lib/kube/mission-check";
import type { ClusterSnapshot } from "@/lib/kube/simulator";

const empty: ClusterSnapshot = { pods: [], services: [], deployments: [], replicaSets: [], endpointSlices: [], namespaces: [], nodes: [], events: [] };

describe("evaluateDoCheck pods-ready", () => {
  it("fails on empty cluster", () => {
    const r = evaluateDoCheck(empty, { kind: "pods-ready", selector: { app: "web" }, minReady: 1 });
    expect(r.passed).toBe(false);
  });
  it("passes when enough matching pods are ready", () => {
    const snap: ClusterSnapshot = { ...empty, pods: [
      { metadata: { name: "web-1", namespace: "default", labels: { app: "web" } },
        status: { phase: "Running", conditions: [{ type: "Ready", status: "True" }], containerStatuses: [{ ready: true, restartCount: 0 }] } },
    ] as ClusterSnapshot["pods"] };
    const r = evaluateDoCheck(snap, { kind: "pods-ready", selector: { app: "web" }, minReady: 1 });
    expect(r.passed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/unit/mission-check.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/kube/mission-check.ts
import type { DoCheck } from "@/lib/domain/mission-types";
import { isPodReady, readyEndpointCount, deploymentReadyReplicas } from "./kubectl/format";
import type { ClusterSnapshot } from "./simulator";

const ns = (o: { metadata?: { namespace?: string } }) => o.metadata?.namespace ?? "default";
const matches = (labels: Record<string, string> | undefined, sel: Record<string, string>) =>
  !!labels && Object.entries(sel).every(([k, v]) => labels[k] === v);

export function evaluateDoCheck(
  snapshot: ClusterSnapshot,
  check: DoCheck,
  namespace = "default",
): { passed: boolean; detail: string } {
  switch (check.kind) {
    case "pods-ready": {
      const ready = snapshot.pods.filter(
        (p) => ns(p) === namespace && matches(p.metadata?.labels, check.selector) && isPodReady(p),
      ).length;
      return { passed: ready >= check.minReady, detail: `${ready}/${check.minReady} matching pods ready` };
    }
    case "deployment-available": {
      const dep = snapshot.deployments.find((d) => ns(d) === namespace && d.metadata?.name === check.name);
      const avail = dep ? deploymentReadyReplicas(dep) : 0;
      return { passed: avail >= check.minAvailable, detail: `${avail}/${check.minAvailable} available` };
    }
    case "service-has-endpoints": {
      const svc = snapshot.services.find((s) => ns(s) === namespace && s.metadata?.name === check.name);
      const eps = svc ? readyEndpointCount(svc, snapshot.endpointSlices) : 0;
      return { passed: eps >= check.minEndpoints, detail: `${eps}/${check.minEndpoints} ready endpoints` };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/tests/unit/mission-check.test.ts`
Expected: PASS.

> If the `ClusterSnapshot` pod literal shape in the test doesn't satisfy `isPodReady`, open `src/lib/kube/kubectl/format.ts`, read `isPodReady`, and mirror the exact fields it inspects. Adjust the test literal — not the production predicate.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kube/mission-check.ts src/tests/unit/mission-check.test.ts
git commit -m "feat(docs): pure do-step cluster check"
```

---

## Task 4: Mission registry + first authored mission

**Files:**
- Create: `src/content/missions/index.ts`, `src/content/missions/foundations/what-is-kubernetes.ts`
- Test: `src/tests/unit/mission-content.test.ts`

**Interfaces:**
- Consumes: `parseMission`, `assertMissionInvariants` (Task 2).
- Produces: `MISSIONS: Mission[]`, `getMissionBySlug(slug: string[]): Mission | undefined`, `getMissionsBySection(section: string): Mission[]`, `MISSION_SECTIONS: string[]`, `isMissionSection(section: string): boolean`, `missionHref(m: Mission): string`.

- [ ] **Step 1: Write the first mission** (exemplar — the re-sequencing of the existing "What is Kubernetes?" lesson into gated steps; first `do` is tiny). Author the real content:

```ts
// src/content/missions/foundations/what-is-kubernetes.ts
import type { Mission } from "@/lib/domain/mission-types";

export const whatIsKubernetes: Mission = {
  slug: ["foundations", "what-is-kubernetes"],
  section: "Foundations",
  order: 1,
  title: "What is Kubernetes?",
  coldOpen: {
    goal: "Boot your very first workload: get one Pod running in an empty cluster.",
    clusterNote: "You start with an empty cluster. By the end of Foundations it will run a real service.",
  },
  inheritsCluster: false,
  seedManifests: [],
  concepts: ["pods", "declarative-config", "reconciliation"],
  steps: [
    { kind: "teach", id: "intro", idea: "Kubernetes keeps your apps running by constantly comparing what you asked for against what is actually running — and fixing the gap.", visual: { mode: "concept", variant: "control-loop", buildToStep: 0 }, ack: "Show me" },
    { kind: "teach", id: "declare", idea: "You describe desired state in YAML. You never start containers by hand; you declare what should exist.", visual: { mode: "concept", variant: "control-loop", buildToStep: 1 } },
    { kind: "predict", id: "predict-reconcile", visual: { mode: "concept", variant: "control-loop", buildToStep: 2 }, predict: {
      question: "You ask for 3 replicas and one Pod crashes. What does Kubernetes do?",
      options: [
        { id: "a", text: "Nothing — you must restart it", correct: false, explain: "That would be imperative. Kubernetes is declarative." },
        { id: "b", text: "Starts a replacement to get back to 3", correct: true, explain: "Exactly — the control loop reconciles actual back to desired." },
      ],
      reveal: "The controller notices actual (2) ≠ desired (3) and creates a replacement. That is reconciliation.",
    } },
    { kind: "check", id: "check-object", quiz: {
      question: "In an object's YAML, which part do YOU own?",
      options: [
        { id: "a", text: "status", correct: false, explain: "status is written by controllers, not you." },
        { id: "b", text: "spec", correct: true, explain: "spec is your desired state; status is the observed state." },
        { id: "c", text: "both equally", correct: false, explain: "You own spec; the system owns status." },
      ],
    } },
    { kind: "do", id: "do-first-pod", goal: "Apply this Pod and watch it become Ready. This is your cluster's first workload.", files: [
      { path: "pod.yaml", initialValue: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n    - name: web\n      image: klab/web-app:1.0.0\n      ports:\n        - containerPort: 8080\n", language: "yaml" },
    ], check: { kind: "pods-ready", selector: { app: "web" }, minReady: 1 }, hint: "Click Apply, then watch the Ready Pods metric. No edits needed for your first one.", debrief: "You declared a Pod and the cluster made it real. You did not start a container — you described one, and the control loop did the rest." },
    { kind: "debrief", id: "wrap", summary: "You now have a running Pod in a cluster you will grow across Foundations.", commands: ["kubectl get pods", "kubectl describe pod web"], takeaways: [
      "Kubernetes is declarative: you own spec, controllers own status.",
      "Reconciliation continuously drives actual state toward desired state.",
      "A Pod is the smallest deployable unit — one or more containers sharing a network identity.",
    ] },
  ],
};
```

- [ ] **Step 2: Write the registry**

```ts
// src/content/missions/index.ts
import type { Mission } from "@/lib/domain/mission-types";
import { assertMissionInvariants, parseMission } from "@/lib/domain/mission-schema";
import { whatIsKubernetes } from "./foundations/what-is-kubernetes";

const RAW: Mission[] = [whatIsKubernetes];

export const MISSIONS: Mission[] = RAW.map((m) => {
  const parsed = parseMission(m);
  assertMissionInvariants(parsed);
  return parsed;
});

export const MISSION_SECTIONS = ["Foundations"]; // grows as sections are migrated

export function isMissionSection(section: string): boolean {
  return MISSION_SECTIONS.includes(section);
}
export function getMissionsBySection(section: string): Mission[] {
  return MISSIONS.filter((m) => m.section === section).sort((a, b) => a.order - b.order);
}
export function getMissionBySlug(slug: string[]): Mission | undefined {
  const key = slug.join("/");
  return MISSIONS.find((m) => m.slug.join("/") === key);
}
export function missionHref(m: Mission): string {
  return `/docs/${m.slug.join("/")}`;
}
```

- [ ] **Step 3: Write failing test**

```ts
// src/tests/unit/mission-content.test.ts
import { describe, expect, it } from "vitest";
import { MISSIONS, getMissionBySlug, getMissionsBySection } from "@/content/missions";

describe("mission content", () => {
  it("registers Foundations missions in order", () => {
    const f = getMissionsBySection("Foundations");
    expect(f.length).toBeGreaterThanOrEqual(1);
    expect(f.map((m) => m.order)).toEqual([...f.map((m) => m.order)].sort((a, b) => a - b));
  });
  it("resolves a mission by slug", () => {
    expect(getMissionBySlug(["foundations", "what-is-kubernetes"])?.title).toBe("What is Kubernetes?");
  });
  it("every mission's first section mission does not inherit and has seedManifests", () => {
    for (const section of ["Foundations"]) {
      const first = getMissionsBySection(section)[0];
      expect(first.inheritsCluster).toBe(false);
      expect(first.seedManifests).toBeDefined();
    }
  });
  it("every step has an action-bearing kind", () => {
    const kinds = new Set(["teach", "predict", "check", "do", "debrief"]);
    for (const m of MISSIONS) for (const s of m.steps) expect(kinds.has(s.kind)).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/tests/unit/mission-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/missions src/tests/unit/mission-content.test.ts
git commit -m "feat(docs): mission registry + first Foundations mission"
```

---

## Task 5: `MissionDiagram` — React-Flow teaching diagram

**Files:**
- Create: `src/features/docs/mission/mission-diagram.tsx`
- Test: `src/tests/unit/mission-diagram.test.tsx` (render smoke test with `@testing-library/react` if present; otherwise assert the node/edge builder pure function).

**Interfaces:**
- Consumes: `DiagramSpec` (Task 1); `ServiceTopology` from `@/components/topology/service-topology`; `ClusterSnapshot`.
- Produces: `MissionDiagram({ spec, snapshot, namespace }: { spec: DiagramSpec; snapshot: ClusterSnapshot; namespace: string })`; and a pure `conceptGraph(variant, buildToStep): { nodes: Node[]; edges: Edge[] }` (exported for test).

- [ ] **Step 1: Write failing test for the pure builder**

```tsx
// src/tests/unit/mission-diagram.test.tsx
import { describe, expect, it } from "vitest";
import { conceptGraph } from "@/features/docs/mission/mission-diagram";

describe("conceptGraph control-loop", () => {
  it("reveals nodes progressively with buildToStep", () => {
    const s0 = conceptGraph("control-loop", 0);
    const s2 = conceptGraph("control-loop", 2);
    expect(s2.nodes.length).toBeGreaterThan(s0.nodes.length);
  });
  it("every edge references existing nodes at its build step", () => {
    const g = conceptGraph("control-loop", 2);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) { expect(ids.has(e.source)).toBe(true); expect(ids.has(e.target)).toBe(true); }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/unit/mission-diagram.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `conceptGraph` returns cumulative nodes/edges up to `buildToStep`, with `markerEnd` arrowheads and `animated: true` on the latest edge. `MissionDiagram` renders `ServiceTopology` for `mode: "live"`, else a `<ReactFlow>` of `conceptGraph(...)`. Mirror `ServiceTopology`'s `nodeStyle`/`palette` usage and `proOptions={{ hideAttribution: true }}`, `nodesDraggable={false}`. For each variant, hand-author the ordered node/edge reveal list (control-loop: `you-declare → control-plane → cluster-runs`, arrows appearing per step). Keep node labels short.

```tsx
// src/features/docs/mission/mission-diagram.tsx  (shape; author full variant tables)
"use client";
import "@xyflow/react/dist/style.css";
import { Background, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { ServiceTopology } from "@/components/topology/service-topology";
import type { ClusterSnapshot } from "@/lib/kube/simulator";
import type { DiagramSpec, ConceptDiagramVariant } from "@/lib/domain/mission-types";
import { palette } from "@/lib/design/tokens";

interface Beat { node: Node; edgeFrom?: string }
const VARIANTS: Record<ConceptDiagramVariant, Beat[]> = {
  "control-loop": [
    { node: mk("declare", "You declare", "spec: replicas: 3", 0, 0) },
    { node: mk("control", "Control plane", "observe → diff → act", 1, 260) },
    { node: mk("runs", "Cluster runs", "status: ready 3/3", 2, 520), edgeFrom: "control" },
  ],
  "cluster-architecture": [/* author: api-server, etcd, controllers, scheduler, kubelet */],
  "api-object": [/* author: metadata, spec, status */],
  "workload-hierarchy": [/* author: Deployment → ReplicaSet → Pods */],
  "service-routing": [/* author: Client → DNS → Service → EndpointSlice → Pods */],
};
function mk(id: string, title: string, sub: string, i: number, x: number): Node {
  return { id, position: { x, y: i % 2 === 0 ? 0 : 90 }, data: { label: `${title}\n${sub}` },
    style: { background: palette.panelElevated, border: `1px solid ${palette.border}`, borderRadius: 10, color: palette.text, fontSize: 11, padding: "8px 10px", width: 168, whiteSpace: "pre-line" } };
}
export function conceptGraph(variant: ConceptDiagramVariant, buildToStep: number): { nodes: Node[]; edges: Edge[] } {
  const beats = VARIANTS[variant].slice(0, buildToStep + 1);
  const nodes = beats.map((b) => b.node);
  const edges: Edge[] = [];
  beats.forEach((b, i) => {
    if (b.edgeFrom) edges.push({ id: `${b.edgeFrom}->${b.node.id}`, source: b.edgeFrom, target: b.node.id, animated: i === beats.length - 1, markerEnd: { type: MarkerType.ArrowClosed } });
    else if (i > 0) edges.push({ id: `${beats[i - 1].node.id}->${b.node.id}`, source: beats[i - 1].node.id, target: b.node.id, animated: i === beats.length - 1, markerEnd: { type: MarkerType.ArrowClosed } });
  });
  return { nodes, edges };
}
export function MissionDiagram({ spec, snapshot, namespace }: { spec: DiagramSpec; snapshot: ClusterSnapshot; namespace: string }) {
  if (spec.mode === "live") return <div className="h-56"><ServiceTopology snapshot={snapshot} namespace={namespace} /></div>;
  const { nodes, edges } = conceptGraph(spec.variant as ConceptDiagramVariant, spec.mode === "concept" ? spec.buildToStep : 99);
  return (
    <div className="h-56 rounded-md border border-border">
      <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} proOptions={{ hideAttribution: true }} style={{ background: palette.panel }}>
        <Background color={palette.border} gap={16} />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 4: Author the remaining variant tables**, then run tests.

Run: `npx vitest run src/tests/unit/mission-diagram.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/docs/mission/mission-diagram.tsx src/tests/unit/mission-diagram.test.tsx
git commit -m "feat(docs): react-flow mission diagrams (live + step-synced concept)"
```

---

## Task 6: Step renderers

**Files:**
- Create: `src/features/docs/mission/steps/teach-step.tsx`, `predict-step.tsx`, `check-step.tsx`, `do-step.tsx`, `debrief-step.tsx`
- Test: `src/tests/unit/mission-steps.test.tsx`

**Interfaces:**
- Consumes: step types (Task 1), `MissionDiagram` (Task 5), `evaluateDoCheck` (Task 3), `YamlEditor`, `XtermTerminal`, `runCommandLine`, `UseSimulator` (from `use-simulator`).
- Produces each renderer with a common contract:
  `TeachStep({ step, onComplete }: { step: Extract<MissionStep,{kind:"teach"}>; onComplete: () => void; snapshot; namespace })` and analogous for the others. `onComplete` is what unlocks "Next". `DoStep` also takes `sim: UseSimulator`, `files`/`setFiles`, and calls `onComplete` when `evaluateDoCheck` passes after an apply.

- [ ] **Step 1: Write failing tests** (gating logic — the reviewer-critical behavior):

```tsx
// src/tests/unit/mission-steps.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckStep } from "@/features/docs/mission/steps/check-step";

const quiz = { question: "Q?", options: [
  { id: "a", text: "wrong", correct: false, explain: "no" },
  { id: "b", text: "right", correct: true, explain: "yes" },
] };

describe("CheckStep gating", () => {
  it("does not call onComplete on a wrong answer", () => {
    const onComplete = vi.fn();
    render(<CheckStep step={{ kind: "check", id: "c", quiz }} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("wrong"));
    expect(onComplete).not.toHaveBeenCalled();
  });
  it("calls onComplete once the correct answer is chosen", () => {
    const onComplete = vi.fn();
    render(<CheckStep step={{ kind: "check", id: "c", quiz }} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("right"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
```

> If `@testing-library/react` is not a dependency, check `package.json`; the repo already runs component behavior tests via Vitest — reuse whatever it uses. If none exists, add `@testing-library/react` + `jsdom` and set Vitest `environment: "jsdom"` for this file via a `// @vitest-environment jsdom` docblock.

- [ ] **Step 2: Run to verify failure.** `npx vitest run src/tests/unit/mission-steps.test.tsx` → FAIL.

- [ ] **Step 3: Implement the five renderers.** Each is a focused presentational component. Key behaviors:
  - **TeachStep**: renders `idea` + optional `MissionDiagram`; an "ack" button (`step.ack ?? "Got it"`) calls `onComplete`. If the teach has no way to be wrong, the ack IS the action.
  - **PredictStep**: shows options; on click reveals `predict.reveal` + per-option `explain`; `onComplete` fires after a choice is made (any choice — prediction is about engagement, not correctness), but highlights the correct one.
  - **CheckStep**: shows options; wrong → show `explain`, stay locked; correct → show `explain`, call `onComplete`.
  - **DoStep**: renders `YamlEditor` (files state), `XtermTerminal` (via `runCommandLine`), an Apply button (`sim.applyFiles(files)`), a live metrics/topology panel, and after each apply runs `evaluateDoCheck(sim.snapshot, step.check, namespace)`; on `passed` shows `debrief` + calls `onComplete`. Reuse the layout from `interactive-lab.tsx` `LiveLab` (editor+terminal left, live state right) — extract shared bits rather than duplicate.
  - **DebriefStep**: renders `summary`, `takeaways`, `commands`; a "Finish mission" button calls `onComplete`.

  (Author the full JSX following `docs-content.tsx` / `interactive-lab.tsx` styling: `border-border`, `bg-panel`, `palette` tones, `cn()`.)

- [ ] **Step 4: Run tests to verify pass.** `npx vitest run src/tests/unit/mission-steps.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/docs/mission/steps src/tests/unit/mission-steps.test.tsx
git commit -m "feat(docs): mission step renderers with gating"
```

---

## Task 7: `MissionRunner` — one mission, gated, writes progress

**Files:**
- Create: `src/features/docs/mission/mission-runner.tsx`
- Test: `src/tests/unit/mission-runner.test.tsx`

**Interfaces:**
- Consumes: step renderers (Task 6), `Mission` (Task 1), `mutateProgress` from `@/lib/storage/progress-store`, `UseSimulator`.
- Produces: `MissionRunner({ mission, sim, onMissionComplete }: { mission: Mission; sim: UseSimulator; onMissionComplete: () => void })`. Renders the cold open, a step rail (`n / total`), the current step, and a "Next" button enabled only when the current step reported complete. On finishing the last step it calls `mutateProgress({ kind: "completedLesson", slug: mission.slug.join("/") })` then `onMissionComplete()`.

- [ ] **Step 1: Write failing test** (advance-gating + completion writes progress). Mock `mutateProgress`:

```tsx
// src/tests/unit/mission-runner.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mutate = vi.fn();
vi.mock("@/lib/storage/progress-store", () => ({ mutateProgress: (i: unknown) => mutate(i) }));

import { MissionRunner } from "@/features/docs/mission/mission-runner";
import type { Mission } from "@/lib/domain/mission-types";

const mission: Mission = {
  slug: ["foundations", "x"], section: "Foundations", order: 1, title: "X",
  coldOpen: { goal: "g", clusterNote: "c" }, inheritsCluster: false, seedManifests: [], concepts: [],
  steps: [
    { kind: "teach", id: "t", idea: "hello", ack: "Got it" },
    { kind: "debrief", id: "d", summary: "s", takeaways: ["one"] },
  ],
};
const fakeSim = { snapshot: { pods: [], services: [], deployments: [], replicaSets: [], endpointSlices: [], namespaces: [], nodes: [], events: [] }, ready: true } as never;

describe("MissionRunner", () => {
  it("gates Next until the step completes, then finishes and writes progress", () => {
    const onDone = vi.fn();
    render(<MissionRunner mission={mission} sim={fakeSim} onMissionComplete={onDone} />);
    // teach step: click ack, advance, then finish debrief
    fireEvent.click(screen.getByText("Got it"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Finish mission"));
    expect(mutate).toHaveBeenCalledWith({ kind: "completedLesson", slug: "foundations/x" });
    expect(onDone).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure.** → FAIL.

- [ ] **Step 3: Implement `MissionRunner`.** Local state: `stepIndex`, `completed: Set<stepId>`. Render `steps[stepIndex]` via a switch to the matching renderer, passing `onComplete={() => markComplete(step.id)}`. "Next" is disabled unless `completed.has(currentId)`; clicking advances. On the last step's completion, call `mutateProgress` + `onMissionComplete`. Persist `stepIndex` to `localStorage` keyed by slug for resume.

- [ ] **Step 4: Run tests to verify pass.** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/docs/mission/mission-runner.tsx src/tests/unit/mission-runner.test.tsx
git commit -m "feat(docs): mission runner with step gating + completion"
```

---

## Task 8: `SectionPlayer` — persistent cluster across a section

**Files:**
- Create: `src/features/docs/mission/section-player.tsx`
- Test: manual (integration behavior; covered by E2E in Task 11). Add a light unit test for `initialMissionIndex(slug, missions)`.

**Interfaces:**
- Consumes: `MissionRunner` (Task 7), `useSimulator`, `getMissionsBySection` (Task 4).
- Produces: `SectionPlayer({ section, initialSlug }: { section: string; initialSlug?: string[] })`. Exports pure `initialMissionIndex(missions: Mission[], slug?: string[]): number`.

**Why this task exists (critical):** `useSimulator` boots once per mount and never re-boots. To make the cluster *persist and grow* across missions, ONE `SectionPlayer` stays mounted for the whole section and holds ONE simulator; advancing to the next mission swaps `MissionRunner` (client-side) and applies the next mission's incremental manifests **without** tearing down the cluster. The URL is updated with `history.replaceState`/`router.replace` (shallow) for deep-linking, but navigation does not remount the player.

- [ ] **Step 1: Write failing test for `initialMissionIndex`.**

```ts
// src/tests/unit/section-player.test.ts
import { describe, expect, it } from "vitest";
import { initialMissionIndex } from "@/features/docs/mission/section-player";
import { getMissionsBySection } from "@/content/missions";

describe("initialMissionIndex", () => {
  const missions = getMissionsBySection("Foundations");
  it("defaults to 0 when no slug", () => { expect(initialMissionIndex(missions, undefined)).toBe(0); });
  it("finds the mission matching a deep-link slug", () => {
    expect(initialMissionIndex(missions, ["foundations", "what-is-kubernetes"])).toBe(0);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `SectionPlayer`.**
  - `const missions = getMissionsBySection(section)`.
  - `const [index, setIndex] = useState(() => initialMissionIndex(missions, initialSlug))`.
  - `const sim = useSimulator(bootSpecForSection(missions))` — boot the section from `missions[0].seedManifests` (may be empty). The player owns the sim for the section lifetime.
  - When `index` advances to a mission with `inheritsCluster: true`, do NOT reset; if the new mission needs new seed objects, apply them via `sim.applyFiles`. When it advances to `inheritsCluster: false` (only mission 1), the boot already covered it.
  - Render `<MissionRunner mission={missions[index]} sim={sim} onMissionComplete={() => { if (index+1 < missions.length) { setIndex(index+1); router.replace(missionHref(missions[index+1])); } else { /* section complete UI */ } }} />`.
  - Guard: while `!sim.ready`, render a booting state.

- [ ] **Step 4: Run test → PASS.** Then `npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/docs/mission/section-player.tsx src/tests/unit/section-player.test.ts
git commit -m "feat(docs): section player with persistent cross-mission cluster"
```

---

## Task 9: Route wiring (player for missions, legacy fallback otherwise)

**Files:**
- Modify: `src/app/docs/[...slug]/page.tsx`
- Test: `src/tests/unit/docs-routing.test.ts` (pure resolver).

**Interfaces:**
- Consumes: `getMissionBySlug`, `isMissionSection`, `getMissionsBySection` (Task 4); `getLessonBySlug` (existing).
- Produces: a pure `resolveDocsRoute(slug: string[]): { kind: "mission"; section: string; slug: string[] } | { kind: "legacy" } | { kind: "not-found" }` used by the page.

- [ ] **Step 1: Write failing test.**

```ts
// src/tests/unit/docs-routing.test.ts
import { describe, expect, it } from "vitest";
import { resolveDocsRoute } from "@/app/docs/resolve-route";

describe("resolveDocsRoute", () => {
  it("routes a Foundations mission slug to the player", () => {
    expect(resolveDocsRoute(["foundations", "what-is-kubernetes"])).toMatchObject({ kind: "mission", section: "Foundations" });
  });
  it("routes a section root to the player", () => {
    expect(resolveDocsRoute(["foundations"])).toMatchObject({ kind: "mission", section: "Foundations" });
  });
  it("falls back to legacy for a non-migrated lesson", () => {
    expect(resolveDocsRoute(["operations", "namespaces"]).kind).toBe("legacy");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `src/app/docs/resolve-route.ts`** (a mission slug, or a bare migrated-section segment, → `mission`; else if `getLessonBySlug` exists → `legacy`; else `not-found`). Then update `page.tsx`:

```tsx
// src/app/docs/[...slug]/page.tsx  (client boundary added for the player)
import { notFound } from "next/navigation";
import { DOCS_LESSONS, getLessonBySlug } from "@/content/docs";
import { DocsPage } from "@/features/docs/components/docs-page";
import { SectionPlayer } from "@/features/docs/mission/section-player";
import { resolveDocsRoute } from "@/app/docs/resolve-route";

export function generateStaticParams() {
  return DOCS_LESSONS.map((lesson) => ({ slug: lesson.slug }));
}

export default async function DocsSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const route = resolveDocsRoute(slug);
  if (route.kind === "mission") return <SectionPlayer section={route.section} initialSlug={slug.length > 1 ? slug : undefined} />;
  if (route.kind === "legacy") { const lesson = getLessonBySlug(slug); if (lesson) return <DocsPage lesson={lesson} />; }
  notFound();
}
```

> `generateStaticParams` should also include `getMissionsBySection` slugs + bare section slugs so mission deep-links prerender. Add them.

- [ ] **Step 4: Run test → PASS.** Then load the app: `npm run dev`, open `/docs/foundations` → the player boots and mission 1 plays. `/docs/operations/namespaces` → legacy page still renders.

- [ ] **Step 5: Commit**

```bash
git add src/app/docs src/tests/unit/docs-routing.test.ts
git commit -m "feat(docs): route missions to SectionPlayer, keep legacy fallback"
```

---

## Task 10: Journey home for migrated sections

**Files:**
- Create: `src/features/docs/mission/journey-home.tsx`
- Modify: `src/features/docs/components/docs-home.tsx`
- Test: `src/tests/unit/journey-home.test.tsx` (renders missions as a path, marks completed).

**Interfaces:**
- Consumes: `getMissionsBySection`, `MISSION_SECTIONS`, `missionHref` (Task 4); `useProgress` (existing).
- Produces: `JourneyHome()` rendering each migrated section as an ordered path of mission nodes, with the current position and the next mission's goal; completed missions read from `progress.completedLessonSlugs`.

- [ ] **Step 1: Write failing test** asserting a mission title + its cold-open goal render, and a completed mission gets the completed treatment (mock `useProgress`).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `JourneyHome`** (path layout: a vertical/stepped route, each node = mission title + one-line goal + status dot). In `docs-home.tsx`, render `JourneyHome` for `MISSION_SECTIONS` above the existing list; keep the legacy list for the non-migrated sections.
- [ ] **Step 4: Run test → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/features/docs/mission/journey-home.tsx src/features/docs/components/docs-home.tsx src/tests/unit/journey-home.test.tsx
git commit -m "feat(docs): journey home for migrated sections"
```

---

## Task 11: Author Foundations missions 2–6

**Files:**
- Create: `src/content/missions/foundations/{cluster-architecture,desired-vs-actual-state,api-objects,labels-annotations-ownership,declarative-workflow}.ts`
- Modify: `src/content/missions/index.ts` (register them, they now inherit the cluster).
- Test: extend `src/tests/unit/mission-content.test.ts` to assert 6 Foundations missions and a growing cluster (mission N>1 has `inheritsCluster: true`).

**Interfaces:**
- Consumes: `Mission` type; the existing lesson content in `src/content/docs/index.ts` (lines noted below) is the source material to re-sequence — **restructure, don't rewrite**.

Source lessons (existing, correct content to re-sequence into steps):
- `cluster-architecture` (docs index ~line 916) → mission 2, `inheritsCluster: true`.
- `desired-vs-actual-state` (~1331) → mission 3.
- `api-objects` (~1717) → mission 4.
- `labels-annotations-ownership` (~2108) → mission 5.
- `declarative-workflow` (~2466) → mission 6.

Authoring rules per mission (enforced by Task 2 invariants + Task 4 tests):
1. `coldOpen.goal` is one concrete sentence tied to the growing cluster.
2. Steps alternate teach/predict/check so no more than ~2 teach screens run without an interaction.
3. Exactly one `do` (minimum) that advances the cluster (e.g. mission 2 scales via a Deployment, mission 3 edits desired replicas and watches reconcile, etc.), each with a `DoCheck` expressed in existing predicates.
4. Difficulty ramp: the first "fix a broken thing" `do` appears no earlier than mission 3.

- [ ] **Step 1: Author mission 2** (`cluster-architecture.ts`) following the Task 4 exemplar shape. Register in `index.ts`. Run `npx vitest run src/tests/unit/mission-content.test.ts`.
- [ ] **Step 2: Commit.** `git commit -m "feat(docs): Foundations mission 2 (cluster architecture)"`
- [ ] **Step 3–6: Repeat Step 1–2 for missions 3, 4, 5, 6**, one commit each. After each, run the content test.
- [ ] **Step 7: Update `MISSION_SECTIONS` test** to assert exactly 6 Foundations missions and that missions 2–6 inherit the cluster; run it → PASS.

```bash
git add src/content/missions src/tests/unit/mission-content.test.ts
git commit -m "test(docs): assert full Foundations mission arc"
```

---

## Task 12: Loop validation gate (manual E2E) + full suite

**Files:** none (verification task).

- [ ] **Step 1:** `npm run typecheck` → PASS. `npm run lint` → PASS. `npx vitest run` → all green.
- [ ] **Step 2:** `npm run dev`; walk `/docs` → journey view shows Foundations as a path. Play all 6 missions end-to-end in one sitting:
  - Every screen requires an action; "Next" is never available on a fresh screen.
  - The first hard "fix" `do` is not before mission 3.
  - The cluster **persists and grows** across missions (a Pod in m1 is still there in m2; by m6 a Service routes to Pods).
  - Live diagrams animate on apply; concept diagrams build arrow-by-arrow across teach steps.
  - Completing a mission ticks the sidebar/journey progress; refresh resumes mid-mission.
- [ ] **Step 3:** Check the success criteria in the spec (§7 "Loop validation"). Record pass/fail per criterion in the PR description.
- [ ] **Step 4:** If the loop clears the gate, STOP and hand back for the go/no-go on Plan 2 (batch the remaining 31 lessons). If it does not, file the specific failures and tune the engine before Plan 2.

---

## Self-Review notes (author)

- **Spec §3 (model):** Tasks 6–8 implement teach/predict/check/do/debrief, cold open, step rail, persistent cluster.
- **Spec §4 (diagrams):** Task 5 (live + step-synced concept + static on React Flow).
- **Spec §5.1 (schema):** Tasks 1–2.
- **Spec §5.2 (player):** Tasks 7–8; §5.3 (routing/fallback): Task 9.
- **Spec §5.4 (progress):** Task 7 uses `mutateProgress({ kind: "completedLesson" })`; per-step local resume in Tasks 7–8.
- **Spec §6 (guardrails):** invariants in Task 2, content tests in Tasks 4 & 11.
- **Spec §7 (success):** Task 12.
- **Type consistency:** `evaluateDoCheck`, `conceptGraph`, `initialMissionIndex`, `resolveDocsRoute`, `MissionRunner`, `SectionPlayer`, `getMissionBySlug`/`getMissionsBySection`/`missionHref` used consistently across tasks.
- **Deferred to Plan 2:** migrate Workloads/Networking/Observability/Operations/Real Incidents (31 lessons); delete legacy `DocsPage` + static diagram components once the last section is migrated.
