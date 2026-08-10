# Production deployment

klab targets Vercel, Neon Postgres, Better Auth, and optionally Resend and Upstash. The
learning product remains free: accounts provide identity, cloud progress, saved work,
password recovery, and account deletion; there is no billing gate.

## 1. Create the hosting project

Link this directory to a Vercel project:

```bash
pnpm exec vercel link
```

Choose a stable production domain before configuring OAuth or email links. Every production
and preview environment that should support sign-in needs the complete variable set below.

## 2. Provision Postgres

Create a Neon database and set:

- `DATABASE_URL`: pooled/serverless connection string used at runtime.
- `DATABASE_URL_UNPOOLED`: direct connection string used for migrations.

Pull the production values locally, apply every checked-in migration, and never run `db:push`
against production:

```bash
pnpm exec vercel env pull .env.production.local --environment=production
pnpm deploy:check
pnpm db:migrate
```

## 3. Configure authentication

Generate and store a signing secret:

```bash
openssl rand -base64 32
```

Set the result as `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL` to the canonical HTTPS origin.
Configure at least one provider:

- GitHub OAuth: set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. The authorization callback is
  `<BETTER_AUTH_URL>/api/auth/callback/github`.
- Resend email: verify the sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`. This enables
  verified email/password accounts, password recovery, magic links, and deletion confirmation.

Email/password endpoints stay disabled if email delivery is incomplete. OAuth buttons are only
shown for configured providers.

## 4. Configure abuse protection

Create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` (the Vercel Marketplace's `KV_REST_API_URL` and
`KV_REST_API_TOKEN` aliases are also recognized). Upstash makes Better Auth's sign-in limits and the app's progress
sync, guest merge, and per-user community limits atomic across serverless instances.

## 5. Deploy and verify

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:api
pnpm build
pnpm exec vercel deploy --prod
```

After deployment:

1. `GET /api/health` returns HTTP 200 with database reachable and auth configured.
2. Sign up or use OAuth, then verify the account appears in the user menu.
3. Complete one action as a guest, sign in, and confirm it merges into the account.
4. Open `/account`, update the display name, and test the recovery path.
5. Confirm unauthenticated requests to `/api/progress`, `/api/labs`, `/api/account/privacy`,
   `/api/merge`, and `/api/community/rank` return HTTP 401.
6. Save a guest lab, sign in, and confirm it appears on another signed-in device and no longer
   remains in the first browser's guest storage.
7. Confirm community activity remains hidden until the account opts in under `/account`.

If `/api/health` returns 503, do not promote the deployment. It intentionally reports degraded
until the database is reachable and the complete auth configuration is active.
