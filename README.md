# klab

> Learn Kubernetes by debugging real (simulated) clusters — not slides.

**klab** is a gamified, hands-on Kubernetes learning platform that runs entirely in your
browser. Debug broken clusters in incident labs, experiment freely in a sandbox, and study
interactive docs where concepts reconcile live. No install, no cloud bill, no risk.

It is built to feel like a Vercel-quality developer tool: dark, minimal, fast, accessible,
and meticulously polished.

> **Status:** early development. **Phase 1 (foundation, app shell, design system) is complete.**
> The Kubernetes simulator, Problems, Playground, and Docs experiences are being built in
> subsequent phases — see [`PROGRESS.md`](./PROGRESS.md) for the live plan and status.

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
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint (flat config) |
| `pnpm typecheck` | `tsc --noEmit`, strict mode |
| `pnpm test` | Unit + component tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright) — _wired in a later phase_ |
| `pnpm format` / `pnpm format:check` | Prettier write / check |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Radix primitives ·
Geist fonts · Lucide icons · Monaco editor · xterm.js · React Flow (`@xyflow/react`) ·
Zod · Webernetes (`@ngrok/webernetes`, in-browser Kubernetes simulation) · Vitest + Testing
Library + Playwright.

## Architecture

Route files stay thin — they compose components and pass params. Product logic lives in
`features/` and `lib/`.

```
src/
  app/                 # App Router routes (thin): /, problems, playground, docs, progress
  components/
    app-shell/         # AppShell, TopNav, route-registered primary action
    command-palette/   # ⌘K palette (Radix Dialog + cmdk)
    icons/             # custom ClusterMark logo + Lucide icon map
    landing/           # marketing landing page
    ui/                # copy-owned primitives (button, badge, panel, tabs, …)
  lib/
    design/tokens.ts   # single source of truth for colors/radii/shadows
    config/            # placeholder/demo data (isolated, marked temporary)
    utils/             # cn, invariant, assertNever (exhaustive checks)
  tests/               # unit + component (Vitest); e2e (Playwright) later
  app/globals.css      # Tailwind v4 @theme mirroring tokens.ts
```

### Design system

All colors, radii, and shadows are defined once in `src/lib/design/tokens.ts` and mirrored
into CSS custom properties via Tailwind v4's `@theme` in `src/app/globals.css`. Components use
semantic utility classes (`bg-panel`, `text-muted`, `border-border`) — **no hardcoded hex
values** outside the token files. Status is never conveyed by color alone; color always pairs
with an icon and text label.

### Simulation is not real Kubernetes

klab simulates a Kubernetes control plane in the browser via Webernetes. The container
"images" are lightweight **TypeScript fakes** that emulate app behavior (health endpoints,
DNS calls) — they are **not** real OCI images and nothing is pulled or executed. Where the
simulation intentionally diverges from real Kubernetes, the code says so in a comment.

## Extending klab

These extension points land with their respective phases (tracked in `PROGRESS.md`):

- **Add a level** → author a typed, Zod-validated entry under `src/content/levels/`.
- **Add a simulated image** → add a TypeScript image class under `src/lib/kube/images/`.
- **Write a validator** → add a discriminated-union validator in `src/lib/kube/validators.ts`.
- **Add a docs lesson** → add an MDX lesson under `src/content/docs/`.

## Placeholders

Some values are intentionally temporary until later phases (auth/profile, real progress
persistence). They are isolated in `src/lib/config/placeholders.ts` and clearly marked. The
brand name (`klab`) and logo are placeholders you can replace — see `PROMPT.md`.

## License

[MIT](./LICENSE) _(LICENSE file added in the open-source-polish phase)._
