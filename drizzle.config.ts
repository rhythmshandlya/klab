import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config. `generate` (schema → SQL migration) works offline and needs no
 * connection string; `migrate`/`push`/`studio` require DATABASE_URL_UNPOOLED (a direct,
 * unpooled Neon URL — migrations must not run through the pooler).
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
