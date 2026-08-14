import { existsSync } from "node:fs";
import process from "node:process";

// Vercel replaces sensitive production values with unreadable placeholders when
// they are pulled locally. Load the developer's real ignored values first;
// process.loadEnvFile intentionally preserves variables that are already set.
for (const file of [".env.local", ".env.production.local"]) {
  if (existsSync(file) && typeof process.loadEnvFile === "function") process.loadEnvFile(file);
}

const errors = [];
const warnings = [];
const present = (name) => Boolean(process.env[name]?.trim());

for (const name of [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
]) {
  if (!present(name)) errors.push(`${name} is required.`);
}

if (present("BETTER_AUTH_SECRET") && process.env.BETTER_AUTH_SECRET.length < 32) {
  errors.push("BETTER_AUTH_SECRET must contain at least 32 characters.");
}

if (present("BETTER_AUTH_URL")) {
  try {
    const url = new URL(process.env.BETTER_AUTH_URL);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      errors.push("BETTER_AUTH_URL must use HTTPS outside local development.");
    }
    if (url.pathname !== "/") errors.push("BETTER_AUTH_URL must be an origin without a path.");
  } catch {
    errors.push("BETTER_AUTH_URL must be a valid absolute URL.");
  }
}

const githubPair = present("GITHUB_CLIENT_ID") && present("GITHUB_CLIENT_SECRET");
const emailPair = present("RESEND_API_KEY") && present("EMAIL_FROM");
if (!githubPair && !emailPair) {
  errors.push("Configure GitHub OAuth or Resend email authentication.");
}
if (present("GITHUB_CLIENT_ID") !== present("GITHUB_CLIENT_SECRET")) {
  errors.push("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured together.");
}
if (present("RESEND_API_KEY") !== present("EMAIL_FROM")) {
  errors.push("RESEND_API_KEY and EMAIL_FROM must be configured together.");
}

const upstashNativePair = present("UPSTASH_REDIS_REST_URL") && present("UPSTASH_REDIS_REST_TOKEN");
const upstashVercelPair = present("KV_REST_API_URL") && present("KV_REST_API_TOKEN");
const upstashPair = upstashNativePair || upstashVercelPair;
if (!upstashPair)
  warnings.push("Upstash is not configured; app API limits will be instance-local.");
if (
  present("UPSTASH_REDIS_REST_URL") !== present("UPSTASH_REDIS_REST_TOKEN") ||
  present("KV_REST_API_URL") !== present("KV_REST_API_TOKEN")
) {
  errors.push("Each configured Upstash URL and token must be provided together.");
}

if (warnings.length) {
  console.warn(warnings.map((message) => `Warning: ${message}`).join("\n"));
}
if (errors.length) {
  console.error(errors.map((message) => `Error: ${message}`).join("\n"));
  process.exitCode = 1;
} else {
  console.info(
    `Deployment environment is ready (${[githubPair && "GitHub", emailPair && "email"]
      .filter(Boolean)
      .join(" + ")}).`,
  );
}
