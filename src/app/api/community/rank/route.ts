import { getAuth } from "@/lib/auth/server";
import { getDb, hasDb } from "@/lib/db";
import { readUserRank } from "@/lib/db/community-repo";
import { isAuthConfigured } from "@/lib/env";
import { allowRequest } from "@/lib/rate-limit";

/**
 * The session user's leaderboard position (rank, cohort size, server XP). The public
 * community aggregates are ISR-cached on the page; this is the only per-user piece, so
 * it stays a tiny dynamic endpoint. Returns `{ rank: null }` for users with no solves.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthConfigured() || !hasDb()) {
    return Response.json({ error: "not configured" }, { status: 501 });
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await allowRequest(`community-rank:${userId}`, { limit: 30, windowSec: 60 }))) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }
  const rank = await readUserRank(getDb(), userId);
  return Response.json({ rank });
}
