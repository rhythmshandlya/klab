# klab — Execution Plan & Progress

> Gamified, hands-on Kubernetes learning platform. Vercel-quality dev tool: dark, minimal, fast, accessible.
> Brand string in nav: **`klab`**. Reference mockups say "KubeQuest" — reference-only; shipped brand stays `klab`.

**Last updated:** 2026-07-09
**Overall status:** ✅ ALL PHASES COMPLETE (1–6) + dev-mode hardening + **Phase 7: full problem catalog & UX overhaul**. 12 playable levels (4 beginner / 4 intermediate / 4 advanced), every one proven solvable by a red→green integration test. /problems is a full dashboard (filters, stats, table, daily challenge, progress rail — per `referance-images/problem-dashboard.png`); the solving screen implements the guided-investigation UX review (terminal-first, quick-command chips, live failing-checks card, evidence-gated hints, selector-aware topology). `pnpm lint`, `pnpm typecheck`, `pnpm test` (68), and `pnpm build` (28 pages) all pass; 3 Playwright E2E specs pass.

---

## 1. Current status

- **Phase 1 (Foundation / app shell / design system): DONE — all checks green.**
- Next.js 16 App Router + React 19 + TS strict + Tailwind v4 scaffolded from scratch (no create-next-app; hand-authored for full control).
- App shell, top nav, command palette (⌘K, navigational), design tokens, 9 UI primitives, custom logo, landing page, and all 8 routes render.
- Verified at runtime: all routes return 200, homepage content correct.

## 2. Environment & resolved toolchain (verified 2026-07-09)

| Tool | Version | Note |
|------|---------|------|
| Node | v22.16.0 | ✅ |
| pnpm | 11.10.0 | ✅ activated in-project (see B1) |
| Next.js | 16.2.10 | Turbopack build |
| React | 19.2.7 | |
| TypeScript | 6.0.3 | strict + noUncheckedIndexedAccess |
| Tailwind CSS | 4.3.2 | CSS-first `@theme` |
| ESLint | **9.39.4** | pinned — ESLint 10 breaks Next/TS parser (see B2) |
| Vitest | 4.1.10 | |
| zod | 4.4.3 | v4 API |
| js-yaml | 5.2.1 | v5 — bundles own types (see R6) |
| lucide-react | 1.23.0 | v1 |
| @xyflow/react | 12.11.2 | React Flow (renamed pkg) |
| @xterm/xterm | 6.0.0 | (renamed pkg) |
| @ngrok/webernetes | 0.1.4 | not yet integrated — Phase 2 |

## 3. Known blockers & risks

- **B1 — pnpm blocked by parent package.json. ✅ RESOLVED.** Parent `C:\Users\armaa\package.json` forces yarn. Fixed by giving klab its own `package.json` with `"packageManager": "pnpm@11.10.0"` + running `corepack enable`. Also: pnpm 11 escalates ignored build scripts to a hard error, and its settings moved out of package.json → added `pnpm-workspace.yaml` with `allowBuilds: {sharp, unrs-resolver}`.
- **B2 — ESLint 10 incompatible with Next 16 / typescript-eslint 8. ✅ RESOLVED.** `latest` resolved ESLint to 10.6 which throws `scopeManager.addGlobals is not a function` via the TS parser. Pinned `eslint@^9` (9.39.4). Also switched from the `FlatCompat` bridge (circular-JSON crash) to Next's native flat config (`import next from "eslint-config-next"`) + explicit `typescript-eslint` plugin registration.
- **B3 — Infinite render loop froze every workspace under `next dev`. ✅ RESOLVED.** `useRegisterWorkspaceAction` (nav primary-action registry) had the caller's `onRun` closure in its effect deps. Both workspaces pass a fresh closure each render (`onRun: () => void handleValidate()`), so the effect re-ran every render → `setAction` → context (which the hook itself consumes) changed → re-render → new closure → loop → "Maximum update depth exceeded" → React halts → page frozen. Fixed with the latest-ref pattern: hold `onRun` in a ref (synced in an effect for `react-hooks/refs`), register a stable wrapper, depend only on the primitive rendered fields. Not StrictMode-specific — it also affects prod; slipped past the earlier E2E because that run predated wiring both workspace callers to the provider. Regression test: `src/tests/component/workspace-action.test.tsx`.
- **B4 — Simulator boot race under React StrictMode left status "Error". ✅ RESOLVED.** Dev-only. `reactStrictMode: true` double-invokes effects (mount → cleanup → mount), firing `boot → close → boot` on the SAME `KubeSimulator`. The old `boot()` guard returned `err("Simulator is already booting.")` on the second mount, and `close()` could tear down a cluster the second mount needed → status stuck at `error`, Apply disabled (killed the Docs inline lab; flaky on Problems/Playground depending on `import()` cache timing). Fixed by serializing all lifecycle ops (`boot`/`close`/`reset`) on a promise chain (`serializeLifecycle`) so the double-invoke resolves deterministically to a booted cluster; `boot()` is now idempotent. Invisible to production E2E (no StrictMode there). Regression test added to `src/tests/integration/simulator.test.ts`.
- **R1 — Webernetes 0.1.x, ESM/browser-only. ✅ SPIKED, risk downgraded to LOW.** The package is a remarkably complete browser port of Kubernetes: real deployment/replicaset/endpointslice/namespace/GC controllers, a **scheduler**, a **kubelet with an HTTP/TCP/exec readiness+liveness prober**, CRI, CNI (HTTP + DNS listeners), and a client-go-style client with full V1 models. **The readiness-probe puzzle is natively supported** (a pod failing its readiness probe is excluded from EndpointSlices, so the Service gets 0 ready endpoints). Key API learned:
  - `new Cluster(opts?)` → `await cluster.init()`; `cluster.registerImage(ImageCtor)` before init.
  - `cluster.apply(resources)` takes a typed union `ClusterApplyResource[]` (Deployment/ReplicaSet/Namespace/Node/Pod/Service).
  - Reads via `cluster.api.{corev1,appsv1,discoveryv1}` (`listNamespacedPod`, `readNamespacedService`, `listNamespacedEndpointSlice`, `listNamespacedEvent`, …). **No core `Endpoints` API** — only `EndpointSlice` (derive the `kubectl get endpoints` view from slices).
  - `cluster.informer(resource, cb, opts)` lists-then-watches; use for live UI snapshots + caches.
  - `cluster.fetch(url)` routes through the cluster network → powers `curl` + network probe + the "service returns 200" validator.
  - Images extend `BaseImage`, set static `imageName`/`imageVersion` + `defaultCommand`, implement `async exec(ctx, argv)`; serve HTTP via `ctx.listenHttp(port, handler)`, DNS via `ctx.listenDns`, call services via `ctx.fetch`, log via `ctx.writeStdout`, stay alive via `await ctx.waitUntilKilled()`.
  - **No client pod-log API.** Logs handled via a module-level `LogSink` our images write to (documented simulation detail; reset with the cluster).
  - Still SSR-hostile (browser/ESM) → `KubeSimulator` dynamically imports it client-side only; `transpilePackages: ["@ngrok/webernetes"]` already set.
- **R6 — @types/js-yaml v4 vs js-yaml v5. ✅ RESOLVED.** js-yaml@5.2.1 ships its own types; removed the redundant `@types/js-yaml`. Parser uses named ESM exports (`loadAll`, `dump`, `YAMLException`).
- **R7 — Webernetes extensionless ESM imports break Node's resolver (test-env only). ✅ RESOLVED.** Bundlers (Next/Turbopack) handle `./clock`-style imports fine, but Vitest externalized the package to Node's ESM resolver which rejects them. Fixed by inlining it in `vitest.config.ts` (`test.server.deps.inline`). The one-time Vite transform of the large package is slow (~6–20s), so integration `testTimeout` is 60s.
- **R3 — Editor/terminal/topology bundle weight (MED, OPEN).** Monaco/xterm/React Flow must be `ssr:false` dynamic imports with skeletons (Phase 3+).
- **Perf note:** first Vitest run is slow on Windows (~70s cold: jsdom env + vite transform). Warm runs are fast. Revisit in Phase 6 if it bites CI.

## 4. Phases, acceptance criteria & checklist

Route files stay thin; product logic lives in `features/` and `lib/`.

### Phase 1 — Foundation / app shell / design system ✅ DONE
- [x] git init, `.gitignore`, `.gitattributes`, `.editorconfig`
- [x] Next 16 + TS strict + Tailwind v4; klab-owned `package.json` (B1 resolved)
- [x] Scripts: `dev build start lint typecheck test test:e2e format format:check`
- [x] Design tokens `src/lib/design/tokens.ts` + CSS `@theme` from PROMPT palette; Geist Sans/Mono; `.tabnums`
- [x] UI primitives (copy-owned, shadcn-style): button, badge, card, panel, tabs, tooltip, separator, kbd, skeleton, section-placeholder
- [x] `cn`, `invariant`, `assertNever` utils
- [x] `<AppShell>` + `<TopNav>` (brand+`klab`, center nav, streak/XP/user/⌘K, route-registered primary action)
- [x] Command palette (⌘K/Ctrl+K) with navigation, level, template & docs jumps
- [x] Custom non-trademarked `ClusterMark` logo + Lucide icon map in `components/icons`
- [x] Landing `/` (polished hero + 3 area cards) and placeholders for all sections + dynamic routes
- [x] Test harness (Vitest + RTL + jsdom) with 7 passing tests
- **Acceptance: MET.** `dev` renders shell + landing; nav routes to all sections; ⌘K opens palette; typecheck/lint/build/test/format all pass; no hardcoded hex outside tokens (placeholder demo values isolated in `lib/config/placeholders.ts`).

### Phase 2 — Webernetes simulator layer ✅ DONE
- [x] Spiked `@ngrok/webernetes@0.1.4` API; findings documented (R1 above + code comments)
- [x] `lib/domain/types.ts` + `schemas.ts` (zod v4, discriminated unions, parse helpers with type-aligned returns)
- [x] `lib/kube/simulator.ts` (SSR-safe dynamic import, informer-backed live snapshots, apply/delete/probe/exec/logs/reset/subscribe)
- [x] `lib/kube/manifest-parser.ts` (multi-doc, Result-style, friendly errors) + `command-runner.ts` (discriminated-union commands) + `validators.ts` (behavior-based, exhaustive) + `evidence.ts` + `kubectl/format.ts`
- [x] Fake images `klab/web-app:1.0.0`, `klab/api:1.0.0`, `klab/debug-tools:1.0.0` (documented as NOT real OCI) + `LogSink`
- [x] kubectl subset: get (pods/svc/deploy/rs/endpoints/endpointslices/events/all, `-o yaml`, `-n`, `--sort-by`), describe, logs, apply -f, delete -f, curl, dig, help, clear; unknown → helpful output, never throws
- [x] Removed `@types/js-yaml` (R6)
- **Acceptance: MET.** 22 unit tests green (parser/command-parser/validators/evidence) + a real-boot integration test (boot → apply Deployment+Service → reconcile to ready pod + ready endpoints → validators pass → `kubectl get pods/svc` show objects). Unknown commands return helpful output.
- **Deferred to Phase 3 (need UI):** React error boundary around the simulator; `fixtures/` (levels supply their own manifests, so no shared fixtures needed yet).

### Phase 3 — Problems + Broken Readiness Probe (reference level) ✅ DONE
- [x] `/problems` content-driven level list; `/problems/[levelId]` renders the workspace (SSG)
- [x] Three-column workspace matching `problems.png`: left (incident brief, hints w/ XP penalty + progressive unlock, evidence board, level progress), center (tabbed Terminal/Logs/Events/Network/Diff over a Monaco editor + Apply/Reset/Run Validation toolbar), right (cluster explorer, object details, React Flow topology)
- [x] Real Monaco editor (dynamic, ssr:false, custom dark theme) + diff view
- [x] Real xterm.js terminal (dynamic) wired to the command-runner; history, Ctrl+L, evidence emission
- [x] Real React Flow topology with ready/not-ready coloring; clickable → object details
- [x] `useSimulator` hook (boots cluster client-side, live snapshot subscription) + error boundaries
- [x] Level store (Zustand), evidence collection, hints, network probe, validation dialog + post-solve teaching
- [x] Throttled local progress persistence (`lib/storage/local-progress.ts`)
- [x] Playwright E2E of investigate → collect evidence → author fix (passing); Vitest content + evidence tests
- **Verified end-to-end in a real browser (Playwright):** boot → `kubectl get pods` → evidence collected → validation fails → edit `/readyz`→`/healthz` → Apply → Run Validation → **Incident resolved** + post-solve teaching.
- **✅ FIXED — the in-browser churn/validation bug.** Root cause: the broken **Deployment** had never-Ready pods; Webernetes drives toward `readyReplicas`, so its ReplicaSet kept creating pods (10+). In headless Chromium that churn overloaded the event loop and destabilized the workspace's simulator after Apply (validators then read a torn-down/empty cluster). **Fix:** (1) redesigned the level's broken workload as a **bare Pod** — no ReplicaSet, so exactly one pod and zero churn (verified: 1 pod vs. 10+); (2) since Pods are immutable, the `KubeSimulator.applyManifests` now **deletes an existing Pod, waits for it to be gone, then recreates it** so an edited probe actually takes effect; (3) validators check real ready pods (`pod-ready-by-selector`) + Service endpoints + HTTP-200 rather than the unreliable `Deployment.status.readyReplicas`. Also hardened `useSimulator` to boot once (deps `[simulator]`, level via ref) so a prop-identity change can't tear the cluster down mid-session.

### Phase 4 — Playground ✅ DONE
- [x] `/playground` (default template) + `/playground/[templateId]` (SSG for all templates)
- [x] Left sidebar: templates list, saved sandboxes (save/load/delete, localStorage), object shortcuts (+ Pod/Service/Deployment), command cheatsheet — matches `playground.png`
- [x] Center: multi-file YAML workspace (file tabs, add/remove) + terminal + Apply Manifests/Reset/Copy YAML
- [x] Right: live React Flow topology + tabbed Explorer (cluster tree + object details) / Events / Resource summary
- [x] Six Zod-validated templates in `src/content/playground-templates/`: empty, pod-service, deployment-service, probes, namespaces, dns (all HEALTHY → churn-free)
- [x] Reuses the Phase 1–3 simulator/editor/terminal/topology/explorer components; `useSimulator` generalized to a `SimulatorBootSpec` (powers both Problems and Playground). `ResourceSummary` counts user-namespace resources only.
- [x] Playground store (Zustand) + local sandbox persistence; save/load/copy-YAML
- **Verified:** unit (template loading), integration (`playground-template.test.ts`: boot → apply → reconcile ready → **stays stable, no churn** → scale 2→3 reconciles → observable via kubectl), and a **Playwright E2E** (open Deployment+Service → pods appear → add a Pod via shortcut → Apply → observe it). Note: healthy Deployment pods report their ready-count with some lag in-browser (webernetes deployment status), so UI/tests key on pod presence + topology, not the raw ready-count.

### Phase 5 — Interactive Docs ✅ DONE
- [x] `/docs` (default lesson) + `/docs/[...slug]` (SSG for all lessons)
- [x] Left section nav (Foundations / Workloads / Networking / Observability & Debugging / Operations / Real Incidents), reading area, right TOC (scroll-spy) + related labs + related problem-level link — matches `docs.png`
- [x] Typed content blocks (no MDX build step): heading, paragraph, callout, concept card, code, compare (desired-vs-actual), and inline `lab` — extended `DocsLesson`/schema with a validated `content: DocsBlock[]`
- [x] Inline interactive labs: lazy "Start lab" → editable YAML + live cluster (compact topology + pod status + endpoint readout) + Apply/Reset + **Open in Playground** handoff (sessionStorage) + "try changing this"
- [x] Three fully interactive lessons: `foundations/desired-vs-actual-state`, `networking/services`, `debugging/readiness-probes` (each with a bare-Pod lab → churn-free)
- **Verified:** docs content unit tests + a Playwright E2E (open the readiness lesson → content renders → Start lab → the lab's cluster boots, applies its Pod+Service, and reaches a ready endpoint). Labs prefer bare Pods so readiness reports promptly in-browser.

### Phase 6 — Tests, polish, a11y, README/CI ✅ DONE
- [x] Open-source docs: expanded `README.md` (quick start, scripts, architecture, how-to-add level/image/validator/docs/template, roadmap+placeholders), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant), `SECURITY.md`, `LICENSE` (MIT)
- [x] GitHub Actions CI (`.github/workflows/ci.yml`): `checks` job (lint → typecheck → test → build) + separate `e2e` job (Playwright) on push/PR, pnpm + Node 22 + corepack
- [x] Issue templates (bug report, level proposal, docs improvement) + `config.yml` + pull request template
- [x] Accessibility: jest-axe component tests (Button incl. icon-only, Badge, Panel, ClusterMark decorative, SectionPlaceholder) — 0 violations; keyboard flows (⌘K palette, tabs, skip-to-content), reduced-motion, and color-never-sole-indicator already in place from Phase 1
- [x] Wired `/progress` dashboard + TopNav streak/XP chips to the local progress store (`useProgress` + `PROGRESS_EVENT`), replacing placeholder stats
- [x] Future backend/auth documented as placeholders (README roadmap + `lib/config/placeholders.ts`)
- **Verified:** `pnpm lint` / `pnpm typecheck` / `pnpm test` (14 files, 50 tests) / `pnpm build` all exit 0; `pnpm test:e2e` → 3/3 pass.

## 5. Verification log

- **2026-07-09 — Phase 7: full problem catalog + problems UX overhaul verified.** Scope (user request + UX review): expand problems across all difficulty ranges per `referance-images/problem-dashboard.png`, audit/rebuild the dashboard, keep the structure server-side, and rework the solving screen into a guided investigation.
  - **Catalog: 1 → 12 playable levels.** Beginner: Service Selector Mismatch, Port Routing Bug, Broken Readiness Probe, Namespace Confusion (100 XP each). Intermediate: Service Has No Endpoints, Pod CrashLoop Mystery, Rolling Update Gone Wrong, DNS Resolution Failure (150 XP). Advanced (locked until 2 solves): Liveness Probe Death Spiral, Config Drift, Broken Service Chain, Zombie ReplicaSet (200 XP). Three reference names weren't simulable (no ConfigMap/NetworkPolicy/StatefulSet in webernetes) and were honestly adapted: ConfigMap Drift → Config Drift (env/port drift), Network Policy Meltdown → Broken Service Chain (3-tier masked failure), StatefulSet Orphaned PVCs → Zombie ReplicaSet (orphaned RS poisoning a Service). New fake images: `klab/worker:1.0.0` (exits without DATABASE_URL → real CrashLoopBackOff), `klab/web-app:2.0.0` (broken release, 500s), `klab/web-app:0.9.0` (legacy: healthz 200 but / 500). New validator kinds: `pod-restarts-below`, `no-pods-matching`.
  - **Solvability proof:** `src/tests/integration/levels.test.ts` boots a real cluster per level, asserts the broken state FAILS validation and the canonical fix (`src/content/levels/solutions.ts`) PASSES — **12/12 green, 81s** (cross-namespace DNS `svc.ns`, CrashLoopBackOff, liveness kills, multi-version images, standalone RS all confirmed working in webernetes 0.1.4).
  - **Dashboard (`/problems`):** server component passes the static catalog to a client dashboard — filter rail (difficulty/status/topics with counts), 5 stat cards, All/Saved/Completed tabs, search + sort, full problem table (status icons incl. padlocks, difficulty pills, topic chips, XP, success %, est. time, bookmarks), right rail (Daily Challenge picked per-day, Continue Learning from attempted levels, Recommended, progress donut + XP-to-level). All numbers real (localStorage progress; attempted/saved/streak fields added with schema-safe defaults). Advanced tier locked until 2 solves; `LevelGate` renders a lock screen (verified in a fresh isolated browser context) and never boots the simulator behind it.
  - **Solving screen (per the user's UX review):** Terminal default tab + per-level quick-command chips (`<pod>` resolves to the most relevant live pod); "Simulator ready" split from a live "Challenge failing · n/m checks" chip; new Failing-Checks card quietly re-runs validators on boot/apply/reset (observational details only); evidence board shows neutral `hiddenLabel`s pre-collection; hints collapsed by default ("Need help?") and still evidence-gated; single Run Validation CTA (nav + ⌘R) with the editor toolbar reduced to Apply/Show Diff/Reset; auto-selects the most broken workload object; structured Logs tab (time | pod | message, All/HTTP/Errors + per-pod filters, live streaming); topology rewritten to render ALL services/deployments/pods with selector-derived edges (a zombie pod shows as a red direct service→pod edge; a selector mismatch shows as a disconnected graph), namespace-aware (`name · ns`) with control-plane namespaces hidden; explorer gains ReplicaSets + namespace suffixes; describe pod/svc now print Port/TargetPort/Environment; `kubectl get namespaces` added; XP demoted to a footer line.
  - **Live browser verification (dev):** dashboard renders with real progress + clean console; solved Service Selector Mismatch end-to-end via chips → 4/5 evidence → Monaco edit → Apply → checks flip to "Challenge passing" → Run Validation → "Incident resolved" (+100 XP, streak 1); advanced tier unlocked at 2 solves; Zombie ReplicaSet workspace shows both RSes + red orphan edge; Namespace Confusion shows dual-namespace explorer/topology and a live cross-namespace validator. Known benign console items: webernetes falls back to a real fetch for intentionally-unresolvable upstreams (`ERR_NAME_NOT_RESOLVED` — the broken state working as designed), and Chrome's autofill hint for xterm/Monaco internal textareas.
  - **Gate:** `pnpm lint` → 0 · `pnpm typecheck` → 0 · `pnpm test` → **16 files / 68 tests** · `pnpm build` → 0 (**28 pages**, all 12 levels SSG) · `pnpm test:e2e` → 3/3.

- **2026-07-09 — Dev-mode hardening (chrome-devtools bug hunt).** User reported "none of the features work" under `next dev`. Root-caused two bugs by driving the running app with chrome-devtools MCP (not guessing): (1) an infinite render loop in `useRegisterWorkspaceAction` — "Maximum update depth exceeded", froze Problems + Playground (B3); (2) a StrictMode `boot → close → boot` race in `KubeSimulator` leaving status `error` with Apply disabled — broke the Docs inline lab (B4). Fixed both (latest-ref pattern; lifecycle serialization). Re-verified **live in the browser (dev)**: Problems solved end-to-end ("Incident resolved", all 3 validators pass), Playground template reconciled 2/2, Docs lab boots Ready with 1 endpoint; consoles clean. Full gate re-run all green: `pnpm lint` → 0, `pnpm typecheck` → 0, `pnpm test` → **15 files / 53 tests** (+3: 2 workspace-action, 1 simulator StrictMode race), `pnpm build` → 0 (17 routes), `pnpm test:e2e` → **3/3**.

- **2026-07-09 — Phase 6 (polish) verified; PROJECT COMPLETE.** Final gate all green:
  `pnpm lint` → exit 0, `pnpm typecheck` → exit 0, `pnpm test` → **14 files / 50 tests**,
  `pnpm build` → exit 0 (all routes prerender), `pnpm test:e2e` → **3/3** (Problems solve,
  Playground apply→observe, Docs inline lab). Added README/CONTRIBUTING/CoC/SECURITY/LICENSE,
  GitHub Actions CI, issue+PR templates, jest-axe a11y tests, and live `/progress` + nav wiring.

- **2026-07-09 — Phase 5 (Interactive Docs) verified.** `pnpm typecheck`/`lint`/`build` → exit 0 (3 lesson routes prerender). `pnpm test` (vitest) → **13 files / 45 tests** (adds docs content parsing). `pnpm test:e2e` → **3 passed**: Problems full solve, Playground apply→observe, and Docs (open lesson → Start lab → lab cluster reconciles to a ready endpoint).

- **2026-07-09 — Phase 4 (Playground) verified.** `pnpm typecheck`/`lint`/`build` → exit 0 (all 6 template routes prerender). `pnpm test` (vitest) → **12 files / 40 tests** (adds playground template loading + a boot→apply→reconcile→scale integration test proving no churn). `pnpm test:e2e` → **2 passed**: the Problems full solve AND the Playground apply→observe (`/playground/deployment-service` → pods appear → add Pod → Apply → observe).

- **2026-07-09 — Phase 3 fully verified (level solves end-to-end in-browser).**
  - `pnpm build` → **exit 0**; `/problems/broken-readiness-probe` prerenders (SSG).
  - `pnpm typecheck` / `pnpm lint` → **exit 0**.
  - `pnpm test` (vitest) → **10 files / 35 tests passed** (level content, evidence, validators, and the `level-solve` integration test: apply-broken → fix → all validators pass).
  - `pnpm test:e2e` (Playwright, production build) → **1 passed**: the FULL happy path — boot, `kubectl get pods`, evidence, validation-fails, edit `/readyz`→`/healthz`, Apply, Run Validation, **Incident resolved**.
- **2026-07-09 — Phase 2 verified.**
  - `pnpm typecheck` → **exit 0** (whole simulator layer typechecked against real Webernetes model types on first try).
  - `pnpm lint` → **exit 0**.
  - `pnpm test` → **8 files / 29 tests passed**, including `src/tests/integration/simulator.test.ts` which boots a **real Webernetes cluster**, applies a Deployment+Service, waits for the pod to pass its `/healthz` readiness probe, confirms the endpointslice controller publishes a ready endpoint, runs the behavior validators (pass), and runs `kubectl get pods/svc`.
  - `pnpm build` → **exit 0**; 8 routes.
  - `pnpm format:check` → clean.
- **2026-07-09 — Phase 1 verified.** Commands run from `C:\Users\armaa\Documents\klab`:
  - `pnpm install` → clean (sharp + unrs-resolver built).
  - `pnpm typecheck` (`tsc --noEmit`) → **exit 0**.
  - `pnpm lint` (eslint 9, flat config) → **exit 0**.
  - `pnpm build` (Next 16 Turbopack) → **exit 0**; 8 routes generated (5 static, 3 dynamic).
  - `pnpm test` (vitest) → **3 files / 7 tests passed**.
  - `pnpm format:check` → **all files formatted**.
  - Runtime: `pnpm dev` → `/`, `/problems`, `/playground`, `/docs`, `/problems/broken-readiness-probe`, `/progress` all **200**; homepage content correct.
- 2026-07-09: Governor — confirmed empty repo, verified deps on npm incl. `@ngrok/webernetes@0.1.4`.

## 6. Next command to run

All phases are complete — the MVP is done, with a 12-level catalog. To run it:

```bash
corepack enable && pnpm install && pnpm dev   # http://localhost:3000
```

Future work (not blocking): achievement badges + per-concept mastery on `/progress`,
"Study Plan" / learning-path grouping on the problems dashboard, a focus/expand mode
for the topology panel, and an optional backend for accounts / cloud-synced progress
behind `src/lib/storage/*`.
