import { revalidatePath } from "next/cache";

import { getAuth } from "@/lib/auth/server";
import { getDb, hasDb } from "@/lib/db";
import {
  createPlayground,
  deletePlayground,
  duplicatePlayground,
  forkPublicPlayground,
  mergeGuestPlaygrounds,
  openPlayground,
  publishPlaygroundSnapshot,
  readPlaygrounds,
  unpublishPlaygroundSnapshot,
  updatePlayground,
} from "@/lib/db/labs-repo";
import { isAuthConfigured } from "@/lib/env";
import { playgroundMutationSchema } from "@/lib/labs/contracts";
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
  return Response.json({ playgrounds: await readPlaygrounds(getDb(), userId) });
}

export async function POST(request: Request): Promise<Response> {
  const configurationError = unavailable();
  if (configurationError) return configurationError;
  const userId = await currentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await allowRequest(`playgrounds:${userId}`, { limit: 180, windowSec: 60 }))) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }

  const parsed = playgroundMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid playground mutation" }, { status: 400 });
  }

  const db = getDb();
  switch (parsed.data.action) {
    case "merge": {
      const claimedIds = await mergeGuestPlaygrounds(db, userId, parsed.data.playgrounds);
      return Response.json({
        playgrounds: await readPlaygrounds(db, userId),
        claimedIds,
      });
    }
    case "create":
      return Response.json({
        playground: await createPlayground(db, userId, parsed.data.playground),
      });
    case "update": {
      const playground = await updatePlayground(db, userId, parsed.data.id, parsed.data.patch);
      return playground
        ? Response.json({ playground })
        : Response.json({ error: "playground not found" }, { status: 404 });
    }
    case "open": {
      const playground = await openPlayground(db, userId, parsed.data.id);
      return playground
        ? Response.json({ playground })
        : Response.json({ error: "playground not found" }, { status: 404 });
    }
    case "publish": {
      const result = await publishPlaygroundSnapshot(
        db,
        userId,
        parsed.data.id,
        parsed.data.description,
      );
      if (result.status === "not-found") {
        return Response.json({ error: "playground not found" }, { status: 404 });
      }
      if (result.status === "profile-private") {
        return Response.json(
          { error: "Enable your community profile before publishing." },
          { status: 409 },
        );
      }
      if (result.status === "unsafe") {
        return Response.json(
          { error: "Remove possible secrets before publishing.", issues: result.issues },
          { status: 422 },
        );
      }
      revalidatePath("/community");
      return Response.json({ playground: result.playground });
    }
    case "unpublish": {
      const playground = await unpublishPlaygroundSnapshot(db, userId, parsed.data.id);
      if (!playground) {
        return Response.json({ error: "playground not found" }, { status: 404 });
      }
      revalidatePath("/community");
      return Response.json({ playground });
    }
    case "fork-public": {
      const playground = await forkPublicPlayground(
        db,
        userId,
        parsed.data.id,
        parsed.data.clientId,
      );
      if (!playground) {
        return Response.json({ error: "public playground not found" }, { status: 404 });
      }
      revalidatePath("/community");
      return Response.json({ playground });
    }
    case "duplicate": {
      const playground = await duplicatePlayground(
        db,
        userId,
        parsed.data.id,
        parsed.data.clientId,
      );
      return playground
        ? Response.json({ playground })
        : Response.json({ error: "playground not found" }, { status: 404 });
    }
    case "delete":
      return (await deletePlayground(db, userId, parsed.data.id))
        ? Response.json({ deletedId: parsed.data.id })
        : Response.json({ error: "playground not found" }, { status: 404 });
  }
}
