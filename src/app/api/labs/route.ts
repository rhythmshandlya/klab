import { getAuth } from "@/lib/auth/server";
import { getDb, hasDb } from "@/lib/db";
import { createLab, deleteLab, mergeGuestLabs, readLabs, updateLab } from "@/lib/db/labs-repo";
import { isAuthConfigured } from "@/lib/env";
import { labMutationSchema } from "@/lib/labs/contracts";
import { allowRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function currentUserId(request: Request): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

function unavailable(): Response | null {
  return !isAuthConfigured() || !hasDb()
    ? Response.json({ error: "not configured" }, { status: 501 })
    : null;
}

export async function GET(request: Request): Promise<Response> {
  const configurationError = unavailable();
  if (configurationError) return configurationError;
  const userId = await currentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ labs: await readLabs(getDb(), userId) });
}

export async function POST(request: Request): Promise<Response> {
  const configurationError = unavailable();
  if (configurationError) return configurationError;
  const userId = await currentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await allowRequest(`labs:${userId}`, { limit: 90, windowSec: 60 }))) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  const parsed = labMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid lab mutation" }, { status: 400 });

  const db = getDb();
  let mutationId: string | undefined;
  switch (parsed.data.action) {
    case "merge":
      await mergeGuestLabs(db, userId, parsed.data.labs);
      break;
    case "create": {
      const created = await createLab(db, userId, parsed.data.lab);
      mutationId = created.id;
      break;
    }
    case "update": {
      const updated = await updateLab(db, userId, parsed.data.id, parsed.data.patch);
      if (!updated) {
        return Response.json({ error: "lab not found" }, { status: 404 });
      }
      mutationId = updated.id;
      break;
    }
    case "delete":
      if (!(await deleteLab(db, userId, parsed.data.id))) {
        return Response.json({ error: "lab not found" }, { status: 404 });
      }
      break;
  }

  return Response.json({ labs: await readLabs(db, userId), mutationId });
}
