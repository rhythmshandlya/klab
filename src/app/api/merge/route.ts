import { getAuth } from "@/lib/auth/server";
import { getDb, hasDb } from "@/lib/db";
import { mergeGuestProgress } from "@/lib/db/merge-repo";
import { readProgress } from "@/lib/db/progress-repo";
import { isAuthConfigured } from "@/lib/env";
import { allowRequest } from "@/lib/rate-limit";
import { coerceProgress } from "@/lib/storage/local-progress";

/**
 * One-shot guest→account merge. The client POSTs its localStorage Progress here on
 * first sign-in (Better Auth's server-side onLinkAccount can't read the browser's
 * storage). Idempotent server-side + marker-guarded client-side. Returns the merged
 * snapshot so the client can adopt it immediately.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isAuthConfigured() || !hasDb()) {
    return Response.json({ error: "not configured" }, { status: 501 });
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // Merge is a rare one-shot per sign-in; a tight ceiling is plenty.
  if (!(await allowRequest(`merge:${userId}`, { limit: 10, windowSec: 60 }))) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const guest = coerceProgress((body as { progress?: unknown } | null)?.progress);
  const db = getDb();
  await mergeGuestProgress(db, userId, guest);
  return Response.json(await readProgress(db, userId));
}
