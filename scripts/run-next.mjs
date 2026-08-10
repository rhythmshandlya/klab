import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import process from "node:process";

export function runNext(command, args = []) {
  // Vercel marks sensitive values as unreadable placeholders when production env is
  // pulled locally. Load a developer's real .env.local first; process.loadEnvFile does
  // not replace variables already supplied by CI or Vercel.
  if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(".env.local");
  }

  const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const result = spawnSync(process.execPath, [nextBin, command, ...args], {
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
