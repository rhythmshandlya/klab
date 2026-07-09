# Security Policy

## Scope

klab is a **client-only** learning app. It runs entirely in the browser: the "Kubernetes
cluster" is simulated in-page via `@ngrok/webernetes`, container "images" are TypeScript
fakes, and there is no backend, database, authentication, or network egress from the app
itself. Progress is stored in the browser's `localStorage`/`sessionStorage`.

Because there is no server component or user data collection, the attack surface is
limited to the static site and its dependencies.

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
