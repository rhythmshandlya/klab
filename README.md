# klab

> Learn Kubernetes by debugging real (simulated) clusters — not slides.

**klab** is a gamified, hands-on Kubernetes learning platform that runs entirely in your
browser. Debug broken clusters in incident labs, experiment freely in a sandbox, and study
interactive docs where concepts reconcile live. No install, no cloud bill, no risk.

It's built to feel like a Vercel-quality developer tool: dark, minimal, fast, accessible,
and meticulously polished.

Three areas, all backed by the same in-browser Kubernetes simulation:

- **/problems** — gamified incident labs. Read the signals, form a theory, edit real YAML,
  and prove your fix against hidden, behavior-based validators.
- **/playground** — a free sandbox: pick a template, edit manifests across files, apply,
  and watch the control plane reconcile in a live topology.
- **/docs** — interactive lessons whose inline labs boot a cluster you can poke.

> **Status:** feature-complete MVP. All three areas work end-to-end in a real browser,
> covered by unit/integration tests and Playwright E2E. See [`PROGRESS.md`](./PROGRESS.md)
> for the phase-by-phase build log.

---

## Quick start

Requires **Node ≥ 20.9** and **pnpm** (via [corepack](https://nodejs.org/api/corepack.html),
which ships with Node).

```bash
corepack enable        # activates the pnpm version pinned in package.json
pnpm install
pnpm dev               # http://localhost:3000
```

### Scripts

| Script | What it does |
|--------|--------------|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint (flat config) |
| `pnpm typecheck` | `tsc --noEmit`, strict mode |
| `pnpm test` / `pnpm test:watch` | Unit + integration tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright; run `pnpm exec playwright install chromium` once) |
| `pnpm format` / `pnpm format:check` | Prettier write / check |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Radix
primitives · Geist fonts · Lucide icons · Monaco editor · xterm.js · React Flow
(`@xyflow/react`) · Zod · **Webernetes** (`@ngrok/webernetes`, in-browser Kubernetes) ·
Zustand · Vitest + Testing Library + Playwright.

## Architecture

Route files stay thin — they compose components and pass params. Product logic lives in
`features/` and `lib/`.

```
src/
  app/                 # App Router routes: /, problems, playground, docs, progress
  components/
    app-shell/         # AppShell, TopNav, ⌘K action wiring, ErrorBoundary
    command-palette/   # ⌘K palette (Radix Dialog + cmdk)
    editor/            # Monaco YAML editor + diff (dynamic, ssr:false)
    terminal/          # xterm.js terminal (dynamic)
    topology/          # React Flow service topology (dynamic)
    object-explorer/   # cluster tree + object details
    events/ icons/ ui/ # events timeline; icon map; copy-owned primitives
  features/
    problems/          # level workspace, useSimulator hook, level store
    playground/        # sandbox workspace + store
    docs/              # lesson renderer + interactive lab
    progress/          # progress dashboard + useProgress
  lib/
    design/tokens.ts   # single source of truth for colors/radii/shadows
    domain/            # types.ts + Zod schemas for all content
    kube/              # KubeSimulator, command-runner, validators, evidence, images/
    storage/           # local progress + sandboxes + docs→playground handoff
  content/             # levels/, docs/, playground-templates/ (Zod-validated at load)
  tests/               # unit, component, integration (Vitest); e2e (Playwright)
```

### The design system

Colors, radii, and shadows are defined once in `src/lib/design/tokens.ts` and mirrored into
CSS variables via Tailwind v4's `@theme` in `src/app/globals.css`. Components use semantic
utilities (`bg-panel`, `text-muted`, `border-border`) — **no hardcoded hex** outside the
token files. Status is never conveyed by color alone; it always pairs with an icon + text.

### Simulation is not real Kubernetes

klab simulates a Kubernetes control plane in the browser via Webernetes (real scheduler,
controllers, and a kubelet with HTTP readiness/liveness probers). Container "images" are
lightweight **TypeScript fakes** that emulate app behavior (health endpoints, DNS calls) —
they are **not** OCI images and nothing is pulled or executed. Where the simulation
intentionally diverges from real Kubernetes, the code says so in a comment.

**Simulator note:** Webernetes' ReplicaSet controller drives toward `readyReplicas`, so a
Deployment whose pods never become Ready keeps creating pods. For any *broken / not-Ready*
scenario, model the workload as a **bare Pod** (the reference level and all docs labs do).

## Extending klab

All static content is validated by Zod at load time, so an invalid entry fails the build.

### Add a problem level

1. Create `src/content/levels/<slug>.ts` exporting a `ProblemLevel` (use `satisfies
   ProblemLevel`): story, objective, constraints, editable `files`, `initialManifests`,
   `registeredImages`, behavior-based `validators`, progressive `hints`, `evidenceRules`,
   and a `postSolveExplanation`.
2. Register it in `src/content/levels/index.ts` — add it to `LEVELS` (playable) and add a
   summary to `LEVEL_CATALOG`.

### Add a simulated image

1. Create `src/lib/kube/images/<name>.ts` — a class `extends BaseImage` with static
   `imageName`/`imageVersion`, a `defaultCommand`, and an `async exec(ctx, argv)` that
   serves HTTP via `ctx.listenHttp(port, handler)` and stays alive with
   `await ctx.waitUntilKilled()`. Document that it's a fake, not an OCI image.
2. Add it to `KLAB_IMAGES` (and `KLAB_IMAGE_CATALOG`) in `src/lib/kube/images/index.ts`.

### Write a validator

Validators check real cluster *behavior*. Add a variant to the `ValidatorCheck` union in
`src/lib/domain/types.ts`, mirror it in `src/lib/domain/schemas.ts`, and handle it in the
exhaustive `switch` in `src/lib/kube/validators.ts` (`evaluate`). Read from
`simulator.getSnapshot()` and/or `simulator.probe(url)`.

### Add a docs lesson

Add a `DocsLesson` to `src/content/docs/index.ts` with typed `content` blocks (heading,
paragraph, callout, concept, code, compare, `lab`) and one or more bare-Pod `labs`. Slot it
into a section; the nav and TOC build themselves.

### Add a playground template

Add a `PlaygroundTemplate` to `src/content/playground-templates/index.ts` (id, title,
`files`, `registeredImages`). It appears in the sidebar and prerenders at
`/playground/<id>`.

## Testing

- **Unit / integration** (Vitest): schema validation, YAML parser, kubectl command parser,
  validators, evidence engine, plus real-boot integration tests that apply manifests and
  assert reconciliation. Webernetes is inlined for Vitest (`test.server.deps.inline`).
- **E2E** (Playwright, against the production build): solve the Broken Readiness Probe
  incident; apply/observe in the Playground; run a docs inline lab.
- **Accessibility**: jest-axe component checks; keyboard flows (⌘K palette, tabs,
  skip-to-content), reduced-motion, and color-not-sole-indicator throughout.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on every push/PR, with
a separate Playwright E2E job.

## Roadmap / placeholders

- More levels (Service Selector Mismatch, Port Routing Bug, Namespace Confusion, Rolling
  Update Gone Wrong) — listed as "coming soon" in the catalog.
- Achievement badges and per-concept mastery on `/progress`.
- **Future backend/auth (not implemented):** klab is client-only today; progress lives in
  `localStorage`. A backend for accounts, cloud-synced progress, and shareable sandboxes
  would slot in behind `src/lib/storage/*`. The demo user chip in the nav
  (`src/lib/config/placeholders.ts`) is a marked placeholder.
- Brand name (`klab`) and logo (`ClusterMark`) are placeholders you can replace.

## License

[MIT](./LICENSE). See [CONTRIBUTING](./CONTRIBUTING.md), [Code of Conduct](./CODE_OF_CONDUCT.md),
and [Security Policy](./SECURITY.md).
