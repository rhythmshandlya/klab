# klab — Execution Plan & Progress

> Gamified, hands-on Kubernetes learning platform. Vercel-quality dev tool: dark, minimal, fast, accessible.
> Brand string in nav: **`klab`**. Reference mockups say "KubeQuest" — reference-only; shipped brand stays `klab`.

**Last updated:** 2026-07-09
**Overall status:** 🟢 Phase 1 complete & verified. ⬜ Phases 2–6 pending.

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
- **R1 — Webernetes 0.1.x, ESM/browser-only (HIGH, OPEN).** Not yet touched. Phase 2 opens with an API spike; all usage behind a `KubeSimulator` facade + `dynamic({ ssr:false })`; in-house reconciler fallback if the API can't support endpoints/probes/logs. Still the #1 schedule risk. `transpilePackages: ["@ngrok/webernetes"]` is already set in `next.config.ts`.
- **R6 — @types/js-yaml v4 vs js-yaml v5 (LOW, OPEN).** js-yaml resolved to v5 (ships its own types); `@types/js-yaml@4` is still in devDeps and may shadow/conflict. Remove `@types/js-yaml` in Phase 2 when wiring `manifest-parser.ts` and confirm typecheck.
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

### Phase 2 — Webernetes simulator layer ⬜ NEXT
- [ ] Spike `@ngrok/webernetes@0.1.4` API; document findings
- [ ] `lib/domain/types.ts` + `schemas.ts` (zod v4) for levels/templates/docs
- [ ] `lib/kube/{simulator,manifest-parser,command-runner,validators}.ts`, `images/`, `fixtures/`
- [ ] Fake images `web-app:1.0.0`, `api:1.0.0`, `debug-tools:1.0.0` (documented as NOT real OCI)
- [ ] kubectl subset (discriminated-union commands, Result-style returns, friendly errors)
- [ ] Remove `@types/js-yaml` (R6); SSR-safe dynamic import + error boundary
- **Acceptance:** unit tests green for parser/command-runner/validators/apply/reset/evidence; boot + apply Deployment+Service + return object state; unknown command never throws.

### Phase 3 — Problems + Broken Readiness Probe (reference level, full E2E) ⬜
### Phase 4 — Playground ⬜
### Phase 5 — Interactive Docs ⬜
### Phase 6 — Tests, polish, a11y, README/CI ⬜
_(Full criteria unchanged from prior plan; see git history if trimmed.)_

## 5. Verification log

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

Begin **Phase 2** (simulator). First: spike Webernetes to learn the real API before writing the facade.

```bash
# inspect the installed Webernetes type surface
cat node_modules/@ngrok/webernetes/dist/index.d.ts | head -200
```
