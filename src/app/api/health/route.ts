import { sql } from "drizzle-orm";

import { getDb, hasDb } from "@/lib/db";
import { getAuthCapabilities, isAuthConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const databaseConfigured = hasDb();
  const authConfigured = isAuthConfigured();
  const providers = getAuthCapabilities();
  let databaseReachable = false;

  if (databaseConfigured) {
    try {
      await getDb().execute(sql`select 1`);
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  const healthy = databaseReachable && authConfigured;
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      database: {
        configured: databaseConfigured,
        reachable: databaseReachable,
      },
      auth: {
        configured: authConfigured,
        providers,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
