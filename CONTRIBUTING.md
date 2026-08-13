# Contributing to k8lab

Thanks for your interest in improving k8lab! This guide covers the workflow and the
common "how do I add …" tasks. The [README](./README.md) has the architecture overview.

Brand changes belong in `src/config/brand.tsx`. Do not scatter product-name or logo literals
through feature modules. Runtime storage keys and simulated image names are compatibility
identifiers, not visible branding, and should not be renamed during a brand refresh.

## Development setup

Requires **Node 24** and **pnpm 11.10.0** (via corepack). The complete onboarding and daily
branch workflow lives in [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md).

```bash
corepack enable
pnpm install
pnpm doctor
pnpm dev            # http://localhost:3000
```

## Before you open a PR

Run the full local gate — CI runs the same commands and must be green:

```bash
pnpm verify         # format + lint + types + Vitest + API/Postgres + production build
pnpm test:e2e       # Playwright (installs a browser on first run: pnpm exec playwright install chromium)
```

Please also:

- Keep route files thin — product logic lives in `features/` and `lib/`.
- No hardcoded hex colors outside `src/lib/design/tokens.ts` + `globals.css`; use the
  semantic Tailwind utilities (`bg-panel`, `text-muted`, …).
- No `any` unless justified with a comment.
- Status must never be conveyed by color alone — pair it with an icon and text.
- Add or update tests for behavior you change.

## Simulator gotcha (please read before adding cluster content)

k8lab simulates Kubernetes in the browser via `@ngrok/webernetes`. Its ReplicaSet
controller drives toward `readyReplicas`, so a **Deployment whose pods never become
Ready keeps creating pods** (churn) and can overload the browser. When you author a
level, template, or lab that should sit in a *broken / not-Ready* state, use a **bare
Pod**, not a Deployment. Healthy Deployments (pods reach Ready) are fine.

## Adding a problem (the most common contribution)

Problems live **in code** — there's no CMS. Contribute one via a normal reviewed PR:

```bash
pnpm new:problem wrong-container-port "Wrong Container Port"   # scaffolds a working level
```

This writes `src/content/levels/<slug>.ts` (a working selector-mismatch level that already
passes the harness) and prints the two lines to register it in `index.ts` + `solutions.ts`.
Edit the story/hints/evidence/validators, then **prove it**:

```bash
pnpm test:levels # content audit + broken state FAILS, canonical fix PASSES
```

Every problem must red→green through that harness — CI runs it on your PR, so an
unsolvable or trivially-passing level can't merge. Optional: `pnpm gen:problem "<idea>"`
drafts a candidate with Claude into `scripts/candidates/` for you to review and run through
the same gate (needs `ANTHROPIC_API_KEY`).

## Other how-to guides

See the README's [Extending k8lab](./README.md#extending-k8lab) section for step-by-step
recipes: add a simulated image, write a validator, add a docs lesson, and add a playground
template. All static content is validated by Zod schemas at load time, so an invalid entry
fails the build.

## Commit & PR style

- Small, focused commits with a clear message.
- Reference the issue you're addressing.
- Use a short-lived branch and open the pull request with `gh pr create --fill`.
- Fill in the pull request template. The `Quality` and `End-to-end` checks must pass.
- Prefer a squash merge; GitHub removes merged branches automatically.

## Code of Conduct

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).
