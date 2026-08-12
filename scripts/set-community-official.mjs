import { existsSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

for (const file of [".env.production.local", ".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const args = process.argv.slice(2);
const emailIndex = args.indexOf("--email");
const email = emailIndex >= 0 ? args[emailIndex + 1]?.trim().toLowerCase() : undefined;
const enabled = !args.includes("--off");
if (!email) {
  console.error(
    "Usage: pnpm community:official -- --email owner@example.com [--off]\n" +
      "The target must already have a KLab account.",
  );
  process.exit(1);
}

const connection = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connection) throw new Error("DATABASE_URL_UNPOOLED is required.");
const sql = neon(connection);
const rows = await sql`
  update "user"
  set "is_official" = ${enabled}, "updated_at" = now()
  where lower("email") = ${email}
  returning "id", "name", "is_official"
`;
const changed = rows[0];
if (!changed) throw new Error("No existing KLab account matches that email.");
console.log(
  `${changed.name} (${changed.id}) is ${changed.is_official ? "now" : "no longer"} a KLab Team account.`,
);
