import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { env, hasDatabase } from "@/lib/env";

import { schema } from "./schema";

/**
 * Lazily-constructed Drizzle client over the Neon serverless HTTP driver. Never
 * connects at import time — `getDb()` builds it on first use, so modules can import
 * this file even when `DATABASE_URL` is unset (guest / static-build path).
 *
 * The HTTP driver is edge/serverless-friendly (no WebSocket, no pooling to manage).
 * Every klab write is a single idempotent statement, so cross-statement transactions
 * aren't required. Tests use a separate pglite-backed client (see src/tests/api).
 */

export type Database = NeonHttpDatabase<typeof schema>;

let cached: Database | null = null;

export function getDb(): Database {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error("getDb() called without DATABASE_URL — guard callers with hasDb().");
  }
  if (!cached) {
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

/** True when a database is configured; guard all server data access with this. */
export const hasDb = hasDatabase;

export { schema };
