You are a senior open-source frontend/platform engineer. Build a production-quality, open-source web app called `<app-name, e.g. KubeQuest>`.

The product is a gamified, hands-on Kubernetes learning platform. Users learn Kubernetes by debugging broken clusters, playing with infra in a sandbox, and studying interactive docs. The app should feel like a Vercel-quality developer tool: dark, minimal, fast, reliable, accessible, extremely polished, and built with maintainable code.

Reference images:

* Problems page reference: `"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_24_47 AM.png"`
* Playground page reference: `"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_40_56 AM.png"`
* Docs page reference: `"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_46_00 AM.png"`
* Brand/logo reference: `C:\Users\armaa\Downloads\kubernetes-vector-logo-seeklogo`
* Any additional moodboard/design references: `<additional-design-references>`

Do not copy the reference images pixel-for-pixel. Use them as visual/UX direction. Keep the design original, premium, and consistent.

## Product pages

Create three main routes:

1. `/problems`
   This is the gamified incident-debugging page. Users solve Kubernetes problems by inspecting a simulated cluster and editing real YAML.

2. `/playground`
   This is a free sandbox where users can create infra, run kubectl-style commands, apply manifests, inspect objects, and learn by experimenting.

3. `/docs`
   This is an interactive Kubernetes study area. Users read lessons, run inline examples, edit manifests, and see Kubernetes concepts animate/reconcile live.

Also create:

* `/` landing/redirect page with clean navigation into the three areas.
* `/problems/[levelId]` for individual levels.
* `/docs/[slug...]` for docs topics.
* `/playground/[templateId]?` for starter sandbox templates.

## Required tech stack

Use the latest stable versions available at implementation time.

Core:

* Next.js App Router
* React
* TypeScript with `strict: true`
* Tailwind CSS v4
* shadcn/ui for accessible, copy-owned components
* Radix primitives where needed
* Geist Sans and Geist Mono
* Lucide React icons
* `@ngrok/webernetes` for browser-based Kubernetes simulation
* `@monaco-editor/react` for YAML editor and diff editor
* `@xterm/xterm` for terminal UI
* React Flow for cluster topology / service flow visualization
* Zod for schemas and runtime validation
* `yaml` or `js-yaml` for manifest parsing
* IndexedDB/localStorage wrapper for local progress persistence
* Optional lightweight state management: Zustand or reducer-based domain stores; do not overuse global state

Quality:

* ESLint
* Prettier
* TypeScript strict mode
* Vitest for unit tests
* React Testing Library for component behavior tests
* Playwright for E2E flows
* axe or equivalent accessibility checks
* GitHub Actions CI
* README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, LICENSE placeholders
* Good folder structure, no throwaway prototype code

Package manager:

* Prefer `pnpm`.
* Use a lockfile.
* Add clean scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `format`, `format:check`.

## Design system

Create a small internal design system with tokens. Do not hardcode colors everywhere.

Use this Vercel-inspired dark palette:

```ts
const colors = {
  background: "#000000",
  app: "#050505",
  panel: "#09090B",
  panelElevated: "#0F0F11",
  panelHover: "#141417",
  border: "#27272A",
  borderStrong: "#3F3F46",
  text: "#FAFAFA",
  textMuted: "#A1A1AA",
  textSubtle: "#71717A",

  blue: "#0070F3",
  blueSoft: "#1D4ED8",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
  purple: "#8B5CF6",

  codeBackground: "#05070A",
  terminalBackground: "#020403",
};
```

Use these visual rules:

* Background: black / near-black.
* Panels: subtle contrast, 1px borders, mild gradients only.
* Border radius: 8px for small controls, 12px for cards, 16px for large panels.
* Shadows: subtle, never heavy.
* Accent colors should be sparse. Default UI should be monochrome.
* Blue is for primary action/selection.
* Green is success/ready.
* Amber is warning.
* Red is failure/unhealthy.
* Purple may be used for achievements/badges.
* Use Geist Sans for UI and Geist Mono for code/terminal.
* Use tabular numbers for metrics and status counters.
* Use subtle focus rings and fully keyboard-navigable components.
* Use responsive layouts, but optimize first for desktop developer workflows.

## Icon system

Use Lucide React for general UI icons. Recommended mapping:

```ts
const icons = {
  terminal: Terminal,
  yaml: FileCode2,
  docs: BookOpen,
  playground: Blocks,
  problems: AlertTriangle,
  cluster: Network,
  node: Server,
  pod: Box,
  deployment: Boxes,
  service: Route,
  endpointSlice: GitBranch,
  events: Activity,
  logs: ScrollText,
  command: Command,
  search: Search,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  run: Play,
  reset: RotateCcw,
  diff: GitCompare,
  validate: ShieldCheck,
  trophy: Trophy,
  streak: Flame,
  xp: Gem,
  database: Database,
  config: Braces,
  docsInteractive: GraduationCap,
};
```

For Kubernetes/CNCF-style logos:

* Use the official Kubernetes/CNCF artwork only if license and trademark use are acceptable.
* Otherwise create a custom abstract wheel/cluster icon inspired by Kubernetes concepts but not a trademarked copy.
* Store all icons in `components/icons`.
* Icons must be accessible: decorative icons use `aria-hidden`; meaningful icons get labels.

## Information architecture

Create app shell:

```txt
<AppShell>
  <TopNav />
  <MainContent />
</AppShell>
```

Top navigation:

* Left: logo + `klab`
* Center: Problems, Playground, Docs, Progress
* Right: streak, XP, user chip, command palette button
* Primary action depends on route:

  * Problems: Run Validation
  * Playground: Apply Manifest
  * Docs: Open Lab / Run Example

Use a command palette with `⌘K` / `Ctrl+K`:

* Jump to level
* Search docs
* Open playground templates
* Run common commands
* Reset cluster
* Toggle theme/compact mode

## Domain model

Create strongly typed models in `src/lib/domain`.

```ts
export type ProblemLevel = {
  id: string;
  slug: string;
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  severity: "low" | "medium" | "high" | "critical";
  xp: number;
  concepts: KubernetesConcept[];
  story: string;
  objective: string;
  constraints: LevelConstraint[];
  files: EditableFile[];
  readonlyFiles: ReadonlyFile[];
  initialManifests: string[];
  registeredImages: SimulatedImageDefinition[];
  allowedCommands: string[];
  validators: LevelValidatorDefinition[];
  hints: Hint[];
  evidenceRules: EvidenceRule[];
  postSolveExplanation: string;
};

export type EditableFile = {
  path: string;
  language: "yaml" | "json" | "typescript" | "markdown";
  initialValue: string;
};

export type Hint = {
  id: string;
  title: string;
  body: string;
  xpPenalty: number;
  unlockAfter?: EvidenceRuleId[];
};

export type EvidenceItem = {
  id: string;
  label: string;
  collected: boolean;
  source: "terminal" | "events" | "network" | "topology" | "object-explorer" | "validator";
  timestamp?: string;
};

export type PlaygroundTemplate = {
  id: string;
  title: string;
  description: string;
  concepts: KubernetesConcept[];
  files: EditableFile[];
  initialManifests: string[];
};

export type DocsLesson = {
  slug: string[];
  title: string;
  description: string;
  order: number;
  concepts: KubernetesConcept[];
  mdx: string;
  labs: InteractiveLab[];
};
```

Use Zod schemas for these models and validate all static level/template/docs data at build time.

## Kubernetes simulation architecture

Use Webernetes as the simulation engine.

Create:

```txt
src/lib/kube/
  simulator.ts
  command-runner.ts
  manifest-parser.ts
  validators.ts
  images/
  fixtures/
  kubectl/
```

`KubeSimulator` responsibilities:

* Create a Webernetes Cluster.
* Register simulated TypeScript images.
* Initialize cluster.
* Apply manifests.
* Reset cluster.
* Expose object snapshots.
* Expose events.
* Expose logs.
* Execute a supported kubectl-like command subset.
* Run network probes.
* Run validation checks.
* Emit state updates for UI.

Because Webernetes does not run real Docker images, implement fake images as TypeScript classes. Example image behavior:

* `web-app:1.0.0`

  * Serves `/healthz` with 200.
  * Serves `/readyz` with 404 for readiness-probe puzzle.
  * Serves `/` only when app is ready.
* `api:1.0.0`

  * Calls another service by DNS name.
* `debug-tools:1.0.0`

  * Supports curl-like simulated requests.

Do not pretend these are real OCI images. Document this clearly.

## Simulated kubectl

Implement a limited but useful kubectl command runner. It does not need to be a real shell; it must feel real.

Support:

```bash
kubectl get pods
kubectl get pod <name> -o yaml
kubectl get svc
kubectl get service <name> -o yaml
kubectl get endpoints
kubectl get endpoints <name>
kubectl get endpointslices
kubectl get deployment
kubectl describe pod <name>
kubectl describe svc <name>
kubectl logs <pod>
kubectl get events
kubectl get events --sort-by=.lastTimestamp
kubectl apply -f <file>
kubectl delete -f <file>
curl <url>
dig <service-name>
clear
help
```

For unsupported commands:

* Return helpful educational output.
* Do not crash.
* Suggest related supported commands.

Terminal UX:

* Use xterm.js.
* Preserve command history.
* Support arrow up/down.
* Support copy/paste.
* Support `Ctrl+L` clear.
* Keep terminal state per session.
* Emit evidence items when the user discovers facts through commands.

## Page 1: Problems

Route: `/problems` and `/problems/[levelId]`

Goal:
A hands-on Kubernetes incident debugging lab, not a passive dashboard.

Use `"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_24_47 AM.png"` as visual/UX reference.

Layout:

* Three-column desktop layout.
* Left: incident context, constraints, hints, evidence board, progress.
* Center: investigation workspace.
* Right: cluster explorer, object details, events, topology, network probe.

Left column:

* Incident brief card:

  * Level title
  * Severity badge
  * Story
  * Objective
  * Constraints
  * Editable files
* Hints card:

  * Hints locked by default.
  * Opening a hint costs XP or reduces score.
  * Do not reveal final answer immediately.
* Evidence board:

  * Collected facts appear as the user investigates.
  * Example:

    * Pod is Running
    * Pod is not Ready
    * Service has zero ready endpoints
    * GET /readyz returns 404
    * GET /healthz returns 200
* Progress/XP card.

Center workspace:

* Tabs:

  * Terminal
  * YAML Editor
  * Logs
  * Events
  * Network
  * Diff
* Default split:

  * Upper pane: terminal.
  * Lower pane: YAML editor.
* Actions:

  * Apply Changes
  * Reset
  * Show Diff
  * Validate
  * Run Validation
* YAML editor:

  * Monaco editor.
  * Syntax-highlighted Kubernetes YAML.
  * Line numbers.
  * Diagnostics.
  * Diff mode.
  * Schema validation where reasonable.
  * Highlight suspicious lines only if evidence supports it; do not over-teach.

Right column:

* Cluster Explorer:

  * Namespace tree:

    * Deployments
    * ReplicaSets
    * Pods
    * Services
    * EndpointSlices
    * Events
  * Selecting an object shows:

    * YAML
    * Status
    * Conditions
    * Labels
    * Selectors
    * Owner references
    * Events related to the object
* Events Timeline:

  * Timestamped events.
  * Normal/Warning severity coloring.
* Service Topology:

  * React Flow graph.
  * Show Service → Deployment → Pods.
  * Show ready/not-ready states.
  * Clicking nodes selects object details.
* Network Probe:

  * User can probe:

    * Service DNS
    * Pod IP
    * NodePort
    * URL
  * Show response code, body preview, and reason.

Validation:

* Run hidden validators against cluster behavior, not just YAML text.
* Example checks:

  * Service returns 200.
  * Deployment has expected ready replicas.
  * Service has ready endpoints.
  * No probe failures after fix.
* After solve, show:

  * Root cause
  * Why it failed
  * What fixed it
  * Related Kubernetes concepts
  * Link to Docs lesson

Create at least these initial levels:

1. Service Selector Mismatch
2. Port Routing Bug
3. Broken Readiness Probe
4. Namespace Confusion
5. Rolling Update Gone Wrong

Implement Level 3 fully end-to-end as the polished reference level.

## Page 2: Playground

Route: `/playground`

Goal:
A free Kubernetes sandbox where users create objects, run commands, break things, inspect reconciliation, and learn commands.

Use `"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_40_56 AM.png"` as visual/UX reference.

Layout:

* Left sidebar:

  * Templates
  * Saved sandboxes
  * Object shortcuts
  * Command cheatsheet
* Center:

  * YAML editor / multi-file workspace
  * Terminal
  * Apply/reset controls
* Right:

  * Live cluster topology
  * Object explorer
  * Events stream
  * Resource summary

Required features:

* Start from templates:

  * Empty cluster
  * Pod + Service
  * Deployment + Service
  * Readiness/Liveness probes
  * Rolling update
  * Namespaces
  * DNS/service discovery
* Users can create/edit manifests.
* Users can apply manifests.
* Users can run kubectl-like commands.
* Users can observe reconciliation.
* Users can inspect objects.
* Users can reset sandbox.
* Users can save/load local playground state.
* Users can copy shareable YAML snippets.
* Provide command suggestions, but do not block experimentation.
* Provide inline explanations when commands fail.

Playground UX:

* It should feel like a real infra scratchpad.
* The user should be able to learn commands hands-on.
* The topology updates live after apply.
* Events stream should show what the control plane did.
* Object details should show spec/status differences.

Example user flow:

1. Select “Deployment + Service” template.
2. Edit replicas from 1 to 3.
3. Click Apply.
4. Watch ReplicaSet create Pods.
5. Run `kubectl get pods`.
6. Open topology and see 3 pods behind Service.
7. Break selector intentionally.
8. Observe Service endpoints go empty.

## Page 3: Docs

Route: `/docs`

Goal:
Interactive Kubernetes docs, not static documentation.

Use `"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_46_00 AM.png"` as visual/UX reference.

Layout:

* Left docs navigation:

  * Foundations
  * Pods
  * Deployments
  * Services
  * Probes
  * DNS
  * Rollouts
  * Debugging
  * Real Incidents
* Main reading area:

  * MDX content.
  * High-quality explanations.
  * Diagrams.
  * Inline callouts.
  * Concept cards.
* Right side:

  * Table of contents.
  * Related labs.
  * Current progress.
* Inline interactive labs:

  * YAML snippet
  * Run button
  * Tiny cluster visualization
  * Terminal output
  * “Try changing this” exercises

Docs must teach by doing:

* Every major docs page should include a runnable mini-lab.
* Explain desired state vs actual state.
* Explain spec vs status.
* Explain labels/selectors.
* Explain readiness vs liveness.
* Explain Service/EndpointSlice relationship.
* Explain Deployment → ReplicaSet → Pod ownership.
* Explain how to debug:

  * get
  * describe
  * logs
  * events
  * endpoints
  * probes
  * DNS

Docs page examples:

* `/docs/foundations/desired-vs-actual-state`
* `/docs/workloads/pods`
* `/docs/workloads/deployments`
* `/docs/networking/services`
* `/docs/networking/dns`
* `/docs/debugging/events`
* `/docs/debugging/readiness-probes`
* `/docs/incidents/service-has-no-endpoints`

Docs UX:

* Provide “Open in Playground” for every example.
* Provide “Related Problem Level” for each concept.
* Keep explanations simple but technically correct.
* Avoid huge walls of text.
* Use diagrams and interactive state changes.

## Architecture and folder structure

Use this structure:

```txt
src/
  app/
    layout.tsx
    page.tsx
    problems/
      page.tsx
      [levelId]/
        page.tsx
    playground/
      page.tsx
      [templateId]/
        page.tsx
    docs/
      page.tsx
      [...slug]/
        page.tsx

  components/
    app-shell/
    command-palette/
    editor/
    terminal/
    topology/
    object-explorer/
    events/
    evidence/
    progress/
    docs/
    ui/
    icons/

  features/
    problems/
      components/
      hooks/
      level-runner.ts
      level-store.ts
    playground/
      components/
      playground-store.ts
    docs/
      components/
      mdx-components.tsx

  lib/
    design/
      tokens.ts
    domain/
      schemas.ts
      types.ts
    kube/
      simulator.ts
      command-runner.ts
      manifest-parser.ts
      validators.ts
      images/
      fixtures/
    storage/
      local-progress.ts
    utils/
      cn.ts
      invariant.ts
      exhaustive.ts

  content/
    levels/
    docs/
    playground-templates/

  tests/
    unit/
    component/
    e2e/
```

Keep route files thin. Put product logic in `features` and `lib`.

## Performance requirements

* Heavy browser-only dependencies must be dynamically imported:

  * Monaco
  * xterm.js
  * React Flow
  * Webernetes cluster runtime if needed
* Do not block initial page render with simulator boot.
* Show skeletons while booting cluster.
* Keep state updates efficient.
* Avoid unnecessary rerenders in terminal/editor/topology.
* Use memoization only where it helps.
* Persist local progress with throttling.
* Keep bundle size visible with an analysis script if practical.
* Ensure app remains responsive while applying manifests and running validation.

## Accessibility requirements

* Full keyboard navigation.
* Command palette accessible by keyboard.
* Terminal focus states clear.
* Editor panels labeled.
* Tabs use correct ARIA roles.
* Icon-only buttons have labels.
* Color is not the only indicator of status.
* Respect reduced motion.
* Good contrast in dark mode.
* Tests should cover basic keyboard flows.

## Testing requirements

Write tests for:

* Zod schemas for levels/templates/docs.
* YAML parser.
* kubectl command parser.
* validators.
* evidence collection.
* applying manifests.
* reset behavior.
* Problems happy path: user fixes readiness probe and validation passes.
* Playground: apply Deployment + Service template and inspect Pods.
* Docs: inline lab runs and opens in playground.
* Basic accessibility checks.
* E2E with Playwright:

  * Open `/problems/broken-readiness-probe`.
  * Run `kubectl get pods`.
  * Inspect evidence.
  * Edit YAML path from `/readyz` to `/healthz`.
  * Apply changes.
  * Run validation.
  * See success state.

## Code quality rules

* TypeScript strict mode must pass.
* No `any` unless explicitly justified in a comment.
* Prefer pure domain functions with tests.
* Keep components small and focused.
* Keep UI components separate from Kubernetes simulation logic.
* Use meaningful names.
* No copy-pasted mock data inside components.
* Level data should live in content files.
* Use discriminated unions for validators and commands.
* Use exhaustive checks for union types.
* Do not hide errors; surface useful debugging messages.
* Error boundaries for simulator/editor failures.
* Use `Result`-style return objects for user-facing command failures instead of throwing everywhere.
* Keep code documented where the simulation intentionally differs from real Kubernetes.

## Open-source polish

Add:

* `README.md` with:

  * What the project is
  * Quick start
  * Architecture overview
  * How to add a level
  * How to add a simulated image
  * How to write validators
  * How to add docs lessons
* `CONTRIBUTING.md`
* `CODE_OF_CONDUCT.md`
* `SECURITY.md`
* `LICENSE` with `<license-choice>`
* `.github/workflows/ci.yml`
* Issue templates:

  * Bug report
  * Level proposal
  * Docs improvement
* Pull request template
* Clear TODOs for future backend/auth if not implemented now

## Placeholder configuration

Keep these placeholders in the code/docs where needed so I can replace them later:

```txt
klab
C:\Users\armaa\Downloads\kubernetes-vector-logo-seeklogo
"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_24_47 AM.png"
"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_40_56 AM.png"
"C:\Users\armaa\Downloads\ChatGPT Image Jul 9, 2026, 12_46_00 AM.png"
basic 
yes, i think varcel stack
NA
varcel
MIT
https://k8s.af/
someteting easy and litework
```

Do not invent final values for those placeholders unless a sensible default is needed to make the app runnable. If using a default, mark it clearly as temporary.

## First implementation milestone

Build a working MVP with:

* Complete app shell and navigation.
* Fully functional `/problems/broken-readiness-probe`.
* Basic `/problems` level list.
* Functional `/playground` with at least two templates.
* Functional `/docs` with at least three interactive lessons.
* Real Monaco YAML editor.
* Real xterm.js terminal UI.
* Real React Flow topology.
* Real Webernetes-backed cluster simulation.
* Local progress persistence.
* Tests and CI.

The MVP should be impressive enough to demo, but the codebase should be structured so new levels/docs/templates can be added easily.

## Important UX rule

Do not give the answer too directly.

Bad:
“Fix the readinessProbe path.”

Good:

* Pod is Running but not Ready.
* Events show readiness probe failed with 404.
* Service has zero ready endpoints.
* `/readyz` returns 404.
* `/healthz` returns 200.
* User must connect the evidence and edit the YAML.

The app should teach Kubernetes debugging by exposing signals, not by spoon-feeding solutions.

## Final output expected from you

1. Create the full codebase.
2. Explain the architecture briefly.
3. List the commands to run locally.
4. List what is fully implemented and what is still placeholder.
5. Include screenshots or describe where each of the three reference images influenced the result.
6. Ensure `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
