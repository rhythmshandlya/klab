import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { schema, user } from "@/lib/db/schema";

/**
 * In-process Postgres (pglite) for API/repo tests: a real Postgres engine compiled to
 * WASM, so FK constraints, ON CONFLICT, and jsonb behave exactly as production Neon.
 * Applies the committed drizzle migrations, so the schema under test is the shipped one.
 */

export type TestDb = PgliteDatabase<typeof schema>;

export async function createTestDb(): Promise<{ db: TestDb; client: PGlite }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db, client };
}

/** Insert a user row so FK-constrained app rows can reference it. */
export async function seedUser(db: TestDb, id = "u1"): Promise<string> {
  await db
    .insert(user)
    .values({
      id,
      name: "Test User",
      email: `${id}@example.com`,
      emailVerified: false,
      publicProfile: true,
    })
    .onConflictDoNothing();
  return id;
}
