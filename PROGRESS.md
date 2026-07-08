# klab — Execution Plan & Progress

> Gamified, hands-on Kubernetes learning platform. Vercel-quality dev tool: dark, minimal, fast, accessible.
> Brand string in nav: **`klab`**. Reference mockups say "KubeQuest" — reference-only; shipped brand stays `klab`.

**Last updated:** 2026-07-09
**Overall status:** 🟢 Phases 1–4 complete & verified (Problems solves end-to-end; Playground apply→observe works in a real browser). ⬜ Phases 5–6 pending.

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

### Phase 5 — Interactive Docs ⬜ NEXT
### Phase 6 — Tests, polish, a11y, README/CI ⬜
_(Full criteria unchanged from prior plan; see git history if trimmed.)_

## 5. Verification log

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

Begin **Phase 5 (Interactive Docs)** — MDX lessons under `src/content/docs/` with inline
runnable labs that reuse the simulator + editor + a compact topology. Build `/docs` +
`/docs/[...slug]` with left section nav, reading area, right TOC/related-labs, and
"Open in Playground" / "Related problem level" links. Prefer bare-Pod labs (churn-free).

```bash
pnpm dev   # build /docs on top of the Phase 1–4 components
```
