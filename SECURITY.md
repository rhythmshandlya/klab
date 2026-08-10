# Security Policy

## Scope

The Kubernetes simulator still runs entirely in the browser: clusters and container images are
TypeScript simulations and submitted manifests never reach a real Kubernetes cluster.

Production accounts use Better Auth and Postgres. Session cookies are HTTP-only and secure;
OAuth credentials are encrypted before database storage. Every user-data API derives ownership
from the authenticated session. Signed-in progress and labs are server-authoritative, while guest
progress and guest labs remain in browser storage until a successful one-time account claim.
Sign-out and account deletion flush pending writes and clear account-scoped browser artifacts.

Display names, avatars, XP, solves, and timing records appear in community views only after a user
explicitly enables the public-profile setting. Database-backed account deletion cascades through
sessions, progress, submissions, merge records, and saved labs.

## Reporting a Vulnerability

If you believe you've found a security issue (for example, a dependency vulnerability, a
way to execute unintended code via crafted YAML/manifest input, or an XSS vector in the
editor/terminal/renderer):

1. **Do not** open a public issue.
2. Report it privately via GitHub's **Report a vulnerability** (Security → Advisories) on
   this repository, or contact the maintainers directly.
3. Include reproduction steps and the affected version/commit.

We aim to acknowledge reports within a few days and will coordinate a fix and disclosure
timeline with you.

## Supported Versions

This is an early-stage project; security fixes are applied to the default branch. There
are no long-term support branches yet.
