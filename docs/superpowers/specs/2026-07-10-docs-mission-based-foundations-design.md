# Design: `/docs` as a mission-based, micro-step learning experience

**Date:** 2026-07-10
**Status:** Approved (design), pending spec review
**Scope:** All 37 lessons across all 6 sections migrated to the mission engine. The mission
engine becomes THE `/docs` architecture; the old static `DocsPage` + hand-built-diagram path
is retired. Not on prod — no backward-compat constraint.
**Build sequencing:** engine → migrate **Foundations (6)** → validate the loop end-to-end →
then batch the remaining 31 with the proven pattern. Same deliverable (all 37), but we don't
discover a loop problem after re-sequencing lesson 37.
**Author:** brainstormed with Rhythm

---

## 1. Problem

`/docs` is meant to take an absolute beginner to k8s architect. A learner (the product
owner) went through it and bounced: couldn't focus, didn't enjoy it, didn't retain. Self-
diagnosed failure modes (confirmed): **too passive / wall of text**, **no goal or stakes**,
and **got lost or bored (difficulty mismatch)**. Progress tracking was *not* a complaint.

### Evidence from auditing the live experience

- **The home is a syllabus.** `/docs` opens as a flat vertical checklist of 37 lesson
  titles across 6 sections (Operations alone is 13 undifferentiated items). This frames the
  product as *reference material to get through*, priming passive skimming.
- **Each lesson is one giant scroll that front-loads reading and back-loads doing.**
  "What is Kubernetes?" (lesson 1 of 37) packs, in a single page: the orchestration problem
  → declarative state + control-loop diagram → reconciliation → a callout → 6 capability
  cards → a cluster-blocks diagram → a fully annotated YAML manifest → a 3-stage build-up →
  imperative-vs-declarative comparison → a callout → **spot-the-bug in a broken manifest** →
  **write YAML from scratch** → a decision table → two quizzes → takeaways → mark complete.
  All *active* elements are stacked at the bottom, so interaction is positionally optional.
- **Difficulty whiplash.** A rank beginner is asked to debug a broken manifest and author
  YAML *inside lesson one* — zero to "spot the bug" on one page.
- **No stakes.** Lessons open with dictionary definitions ("Kubernetes is a control plane
  for running containers reliably…"), not a problem the learner feels or a mission they're on.

### The core insight

klab already has **KodeKloud-grade infrastructure** (a live cluster simulator, embedded
terminal, YAML editor, and a React-Flow topology graph) but delivers it in a **passive-
textbook wrapper**. The platforms that hold attention invert this: *doing is the spine and
reading is support* (KodeKloud missions/challenges), delivered *one idea per screen with an
action every screen* and framed as a *journey* (Duolingo/Brilliant). **This design flips
klab from reading-primary to doing-primary.**

Sources reviewed: KodeKloud (mission/challenge-based browser labs, learn-by-doing primary),
Duolingo/Brilliant (bite-sized single-concept steps, immediate feedback, journey framing,
active recall / spaced repetition).

## 2. Goals & non-goals

### Goals
- Every screen in a lesson has a required action; skimming past content is not possible.
- Each lesson opens with a concrete goal and stakes, not a definition.
- Difficulty ramps structurally: a hard action can only appear after its concepts are taught.
- The learner tends **one persistent cluster** that visibly grows across a section.
- Teaching diagrams become immersive: real arrows/structure, animated, and — where it makes
  sense — *live views of the actual cluster* that respond as the learner acts.
- Migrate **all 37 lessons** to the mission engine; retire the old static `DocsPage` path.
- Validate the loop on Foundations first, then roll the proven pattern across the rest.

### Non-goals (YAGNI)
- **No gamification** (XP, streaks, leagues, mascot). Progress wasn't the complaint; earn
  engagement from mission stakes first. Can be layered later if it still feels flat.
- **No new simulator.** Reuse the existing sim, command runner, and validation predicates.
- **No spaced-repetition system** (noted as a future layer; not built now).

## 3. The model

### 3.1 The step primitive
A lesson becomes a **mission**: an ordered list of **steps**. Each step is **one screen =
one focal idea + one required action**. Advancement is gated on the action, so the learner
is always active. Five step kinds:

| Kind | On screen | Action to advance | Reuses (existing) |
|---|---|---|---|
| `teach` | One idea (≤ ~60 words) + at most one visual | Tap "got it", or a one-tap prediction that reveals | `paragraph`, `diagram`, `annotatedCode` renderers |
| `predict` | A question posed *before* the answer (curiosity gap) | Guess → reveal | quiz + reveal-block logic |
| `check` | A quiz / decision | Answer (correct, or shown why) to advance | `DocsQuiz` |
| `do` | The live cluster + editor/terminal | Make a real change, validated against sim state | `useSimulator`, `runCommandLine`, `YamlEditor`, `XtermTerminal` |
| `debrief` | "What you just did" + commands + what changed | Finish mission | takeaways + lab `debrief` |

### 3.2 The mission shell
- **Cold open:** concrete goal + current cluster state in one line
  (e.g. "3 replicas, 0 ready — get traffic flowing before you move on").
- **Step rail:** `3 / 8` progress within the mission, so it feels short and finishable.
- **Persistent cluster:** sim state **carries forward** across Foundations missions. Mission
  N inherits mission N-1's cluster; the world accumulates (1 Pod → Deployment → …). This is
  the through-line that supplies stakes across the section, not just per-screen.

### 3.3 The journey (home)
Replace the flat checklist with a **path/journey view**: the missions as a route per section,
the evolving cluster's growth, current position, and the next mission's goal. During the
build, sections not yet migrated fall back to today's list as a *temporary dev scaffold* —
the end state is every section on the journey view.

### 3.4 Difficulty ramp — fixed structurally
A `do` step may only require concepts introduced by earlier steps/missions. Foundations
lesson 1 ends with a **tiny** `do` (set `replicas`, apply, watch it converge), **not**
spot-the-bug. Authoring rule enforced by review + a content lint (see §6).

## 4. Immersive diagrams

**Engine:** standardize teaching diagrams on **React Flow (`@xyflow/react`)** — already a
dependency, already powering the lab's `ServiceTopology`. This replaces the hand-built static
`<div>` diagrams and the arrowhead-less bezier `LoopArrows`, giving real arrowheads
(`markerEnd`), proper edge routing, animated flow, and one consistent node style everywhere.

Three tiers, matched to purpose:

1. **Live diagrams = the cluster itself.** In `do` steps, reuse `ServiceTopology` so the
   diagram *is* the running cluster and animates as the learner acts (edit YAML → apply →
   endpoints light up green; a bad selector shows a red edge). The diagram participates in
   the mission instead of illustrating beside it.
2. **Step-synced concept diagrams.** For ideas that are not live state (control loop, cluster
   architecture, API-object shape), build React-Flow graphs that **assemble node-by-node in
   sync with the micro-steps** — "you declare" → arrow animates in → "control plane" → arrow →
   "cluster runs." Structure/arrows arrive progressively, reinforcing one-idea-per-screen.
3. **Static-but-correct.** Any remaining decorative diagram is rebuilt on the same engine so
   arrows/structure are consistent; no orphaned hand-drawn SVG.

This is a *reach extension* of proven code (the data-driven, health-aware, animated-edge
graph already exists in the lab), not a new capability.

## 5. Technical architecture

### 5.1 Content
- New content type, alongside the existing `DocsLesson` (in `src/lib/domain/types.ts`):
  ```ts
  type MissionStep =
    | { kind: "teach"; idea: string; visual?: DiagramSpec; predict?: PredictSpec }
    | { kind: "predict"; question: string; reveal: string; options?: QuizOption[] }
    | { kind: "check"; quiz: QuizSpec }        // reuses DocsQuiz shape
    | { kind: "do"; goal: string; files: EditableFile[]; validate: DoCheck; debrief?: string }
    | { kind: "debrief"; summary: string; commands?: string[]; takeaways: string[] };

  interface Mission {
    slug: string[];            // e.g. ["foundations", "what-is-kubernetes"]
    section: string;           // "Foundations"
    order: number;
    coldOpen: { goal: string; clusterNote: string };
    steps: MissionStep[];
    // persistent-cluster seeding
    inheritsCluster: boolean;  // true for all but the first Foundations mission
    seedManifests?: string[];  // starting state when not inheriting
  }
  ```
  `DiagramSpec` covers the tiered diagrams: `{ mode: "live" } | { mode: "concept";
  variant; buildSteps: Node[][] } | { mode: "static"; variant }`. `DoCheck` is expressed with
  existing sim predicates (`isPodReady`, `readyEndpointCount`, `deploymentReadyReplicas`,
  `podPhase`) so validation logic is reused, not reinvented.
- Author Foundations' 6 lessons as `Mission`s. Existing `DocsLesson` content for those 6 is
  the raw material (already written and correct) — it is *re-sequenced into steps*, not
  rewritten from scratch.

### 5.2 Player
- New client component `MissionPlayer` (`src/features/docs/components/mission-player.tsx`):
  renders one step at a time, keyboard-driven (Enter/→ to advance when the action is
  satisfied), with the step rail and cold-open header. It composes existing pieces:
  `useSimulator`, `runCommandLine`, `YamlEditor`, `XtermTerminal`, `ServiceTopology`,
  `DocsQuiz`, reveal blocks. **No new sim engine.**
- Persistent cluster: the player owns a section-scoped sim instance seeded from the previous
  mission's ending state (mechanism: extend `useSimulator`/handoff so a mission can boot from
  a serialized snapshot; the existing `setPlaygroundHandoff` pattern is the precedent).

### 5.3 Routing & migration
- `MissionPlayer` becomes the docs renderer. The `[...slug]` route renders a `Mission`;
  the old `DocsPage` and hand-built diagram components are **removed once all sections are
  migrated**.
- During the build, a slug that has not yet been converted to a `Mission` falls back to the
  legacy `DocsPage` as a *temporary scaffold* so the app stays runnable section-by-section.
  This fallback is deleted when migration completes — it is not a permanent coexistence layer.
- The `/docs` home renders the journey view; migrated sections show the path, not-yet-migrated
  sections show the legacy list, until all 6 are done.

### 5.4 Progress
- Reuse the existing grow-only, cloud-synced progress store. Completing a mission calls the
  existing `mutateProgress({ kind: "completedLesson", slug })`, so the sidebar checkmark and
  course-progress bar keep working unchanged.
- Add per-step progress within a mission (resume where you left off). This is *local* mission
  state; only mission completion writes to the synced store, keeping the sync surface small.

## 6. Authoring & quality guardrails
- **Content lint** (extend the existing content test suite): every mission has a cold-open
  goal; every step has an action; the first `do` in Foundations appears no earlier than a
  configured step index; `validate` references only sim predicates.
- **Difficulty rule** documented for authors: a `do` may only require concepts taught in
  earlier steps of the same or a prior mission.

## 7. Success criteria
**Loop validation (after Foundations, gate before batching the other 31):**
- A beginner completes all of Foundations without hitting a wall.
- Every screen has a required action; no screen is pure scroll-past reading.
- The first hard `do` lands only after its concepts are taught.
- The cluster visibly accumulates across the 6 missions (persistent world).
- Diagrams have real arrows/structure; live diagrams animate in response to the learner's
  actions.
- After each mission the learner can state what changed and why (validated informally by the
  product owner running Foundations end-to-end).

**Full delivery:**
- All 37 lessons render as missions through `MissionPlayer`; the legacy `DocsPage` and
  hand-built diagram components are deleted.
- The `/docs` home is the journey view for every section; the flat syllabus is gone.
- Existing progress (completed-lesson checkmarks, course-progress bar) still works unchanged.

## 8. Risks & mitigations
- **Re-sequencing 37 lessons into steps is a large content lift committed up front.**
  Mitigation: the build sequencing gates on Foundations — we validate the loop on 6 lessons
  before spending effort on the other 31, so a loop problem is caught after 6, not 37. Content
  already exists and is correct; this is restructuring, not net-new writing.
- **Persistent-cluster handoff across missions is the trickiest new mechanic.** Mitigation:
  the sim already serializes snapshots for the playground handoff; extend that precedent, and
  fall back to per-mission `seedManifests` if cross-mission carry-forward proves fiddly.
- **Temporary legacy fallback during migration.** Mitigation: it's an explicit scaffold with
  a deletion criterion (removed when all 6 sections are migrated), not a permanent path; both
  renderers share content types and the progress store meanwhile.
- **The loop underperforms and we've committed to all 37.** Mitigation: the Foundations gate
  is a real decision point — if the loop doesn't clear its success criteria, we stop and tune
  the engine before batching, rather than proceeding on schedule.

## 9. Out of scope / future
- Gamification layer (XP/streaks/leagues), spaced-repetition review, and a mascot/character.
  All deferred until the core mission loop is shown to hold attention on its own.
