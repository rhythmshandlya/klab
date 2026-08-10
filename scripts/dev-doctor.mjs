import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const expectedRepository = "github.com/rhythmshandlya/klab";
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const expectedPnpm = packageJson.packageManager.split("@")[1];
const results = [];

function record(level, label, detail) {
  results.push({ level, label, detail });
}

function command(name, args) {
  return spawnSync(name, args, { encoding: "utf8", shell: process.platform === "win32" });
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
record(
  nodeMajor === 22 ? "pass" : "fail",
  "Node.js",
  `${process.versions.node}${nodeMajor === 22 ? "" : " (expected 22.x)"}`,
);

const pnpm = command("pnpm", ["--version"]);
const actualPnpm = pnpm.status === 0 ? pnpm.stdout.trim() : "not found";
record(
  actualPnpm === expectedPnpm ? "pass" : "fail",
  "pnpm",
  `${actualPnpm}${actualPnpm === expectedPnpm ? "" : ` (expected ${expectedPnpm})`}`,
);

record(
  existsSync("node_modules") ? "pass" : "fail",
  "Dependencies",
  existsSync("node_modules") ? "installed" : "missing; run pnpm install",
);

const remote = command("git", ["remote", "get-url", "origin"]);
const remoteUrl = remote.status === 0 ? remote.stdout.trim() : "not configured";
record(remoteUrl.includes(expectedRepository) ? "pass" : "warn", "Git remote", remoteUrl);

if (!existsSync(".env.local")) {
  record("warn", "Environment", "guest-only mode; copy .env.example to .env.local for accounts");
} else {
  const envFile = readFileSync(".env.local", "utf8");
  const values = Object.fromEntries(
    envFile
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim().replace(/^['"]|['"]$/gu, "")]),
  );
  const database = Boolean(values.DATABASE_URL && values.DATABASE_URL_UNPOOLED);
  const github = Boolean(values.GITHUB_CLIENT_ID && values.GITHUB_CLIENT_SECRET);
  const email = Boolean(values.RESEND_API_KEY && values.EMAIL_FROM);
  const auth = Boolean(database && values.BETTER_AUTH_SECRET && (github || email));
  record(
    auth ? "pass" : "warn",
    "Environment",
    auth ? "account backend configured" : "guest mode or partial account configuration",
  );
}

for (const result of results) {
  const marker = result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
  console.log(`${marker.padEnd(4)}  ${result.label.padEnd(14)} ${result.detail}`);
}

if (results.some((result) => result.level === "fail")) process.exitCode = 1;
