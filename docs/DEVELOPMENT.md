# Development workflow

This is the day-to-day guide for working on klab. The source of truth is
[`rhythmshandlya/klab`](https://github.com/rhythmshandlya/klab), the default branch is `main`,
and production is deployed to [klab-five.vercel.app](https://klab-five.vercel.app).

## First-time setup

Install Node.js 22 and enable the pnpm version pinned by the repository:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm doctor
pnpm dev
```

The app opens at <http://localhost:3000>. The repository includes `.node-version`, so tools such
as fnm, nvm, and asdf can select the expected Node major automatically. Recommended VS Code
extensions and workspace settings are checked in under `.vscode/`.

No cloud credentials are required for frontend, curriculum, simulator, or guest-mode work. Copy
`.env.example` to `.env.local` only when you need accounts, persistence, email, or distributed
rate limiting. Never commit `.env*`, `.vercel/`, database dumps, or access tokens.

## Daily branch workflow

Start each change from an up-to-date `main` and use a short-lived branch:

```bash
git switch main
git pull --ff-only
git switch -c feat/short-description
```

While working:

```bash
pnpm dev                 # application with fast refresh
pnpm test:watch          # focused Vitest loop
pnpm test:levels         # Kubernetes problem authoring harness
pnpm test:api            # repositories/routes against in-process Postgres
```

Before pushing, run:

```bash
pnpm verify              # format, lint, types, all Vitest suites, production build
pnpm test:e2e            # also run for user-visible or browser behavior changes
```

Open a pull request with `gh pr create --fill`. Merge only after the `Quality` and `End-to-end`
checks pass. Prefer squash merges so `main` remains a readable release history; merged branches
are deleted automatically.

## Local quality controls

`simple-git-hooks` installs two repository-local hooks during `pnpm install`:

- Pre-commit runs Prettier and ESLint only on staged files through `lint-staged`.
- Pre-push runs `pnpm check:fast` (format, lint, and type checking).

Hooks are a fast feedback loop, not a replacement for CI. If a hook reports a problem, fix it and
stage the updated file before committing. Do not routinely bypass hooks with `--no-verify`.

Useful commands:

| Command | Purpose |
| --- | --- |
| `pnpm doctor` | Check Node, pnpm, dependencies, Git remote, and account configuration |
| `pnpm check:fast` | Formatting, lint, and TypeScript checks |
| `pnpm test:all` | Application and API/Postgres test suites |
| `pnpm verify` | Complete non-browser CI quality gate |
| `pnpm security:audit` | Fail on high or critical production dependency advisories |
| `pnpm test:e2e` | Production-build Playwright suite |
| `pnpm smoke:production [url]` | Health and authorization smoke checks against a deployment |
| `pnpm new:problem <slug> <title>` | Scaffold a Kubernetes incident problem |
| `pnpm db:generate` | Generate a reviewed SQL migration from schema changes |
| `pnpm db:migrate` | Apply checked-in migrations using the direct database URL |

## Database changes

Edit `src/lib/db/schema.ts`, then generate and inspect the SQL:

```bash
pnpm db:generate
git diff -- drizzle/
pnpm test:api
```

Migrations must be backward compatible with the currently deployed application. Never use
`pnpm db:push` against production. Apply a reviewed migration through the procedure in
[`DEPLOYMENT.md`](./DEPLOYMENT.md) before deploying code that depends on it. The nightly
`Database compatibility` workflow applies the full migration history to clean Postgres and checks
for schema drift.

## CI and delivery

Every pull request runs two secret-free jobs:

1. `Quality` installs from the frozen lockfile and runs `pnpm verify`, including a production
   dependency audit that blocks high and critical advisories.
2. `End-to-end` installs Chromium and runs the Playwright production-build suite.

After reviewed code reaches `main`, the same workflow waits for both jobs and asks Vercel to build
the source remotely, where protected production values never leave Vercel. It then runs
authorization and health smoke checks against the immutable deployment URL. Pull-request code
never receives the Vercel production token.

Dependabot opens grouped weekly pnpm and GitHub Actions updates. GitHub Actions are pinned to full
commit SHAs; retain that policy when adding a new action.

## Troubleshooting

- `pnpm doctor` fails Node or pnpm: use Node 22 and run `corepack prepare pnpm@11.10.0 --activate`.
- The account UI is absent locally: complete a database, Better Auth secret, canonical URL, and at
  least one provider pair in `.env.local`.
- Playwright is missing Chromium: run `pnpm exec playwright install chromium`.
- A production deployment fails: inspect the `Production deployment` job, fix forward on a branch,
  and merge after CI. For an urgent application rollback, promote the last known-good deployment in
  Vercel; do not reverse a database migration unless a reviewed down migration exists.
