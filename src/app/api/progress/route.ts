import { getAuth } from "@/lib/auth/server";
import { getDb, hasDb } from "@/lib/db";
import { applyIntents, readProgress } from "@/lib/db/progress-repo";
import { isAuthConfigured } from "@/lib/env";
import { allowRequest } from "@/lib/rate-limit";
import { parseIntents } from "@/lib/storage/progress-intent";

/**
 * Signed-in progress sync. GET returns the server-derived Progress snapshot; POST
 * applies a batch of idempotent intents and returns the fresh snapshot. Guests never
 * reach here (their RemoteBackend is inactive) — but we still gate on config + session
 * so the route is safe when auth is off (501) or unauthenticated (401).
 */

export const dynamic = "force-dynamic";

async function currentUserId(request: Request): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthConfigured() || !hasDb()) {
    return Response.json({ error: "not configured" }, { status: 501 });
  }
  const userId = await currentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await readProgress(getDb(), userId));
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthConfigured() || !hasDb()) {
    return Response.json({ error: "not configured" }, { status: 501 });
  }
  const userId = await currentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // Sync is chatty (batched pushes + flushes); keep the ceiling generous.
  if (!(await allowRequest(`progress:${userId}`, { limit: 120, windowSec: 60 }))) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }
  const body: unknown = await request.json().catch(() => null);
  const intents = parseIntents(body);
  const db = getDb();
  await applyIntents(db, userId, intents);
  return Response.json(await readProgress(db, userId));
}
