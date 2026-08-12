import { revalidatePath } from "next/cache";

import { getAuth } from "@/lib/auth/server";
import { createDiscussionSchema } from "@/lib/community/contracts";
import { getDb, hasDb } from "@/lib/db";
import { createDiscussion } from "@/lib/db/discussions-repo";
import { isAuthConfigured } from "@/lib/env";
import { allowRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isAuthConfigured() || !hasDb()) {
    return Response.json({ error: "Community discussions are not configured." }, { status: 501 });
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to start a discussion." }, { status: 401 });
  if (!(await allowRequest(`discussion-create:${userId}`, { limit: 10, windowSec: 3600 }))) {
    return Response.json({ error: "Too many new discussions. Try again later." }, { status: 429 });
  }

  const parsed = createDiscussionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid discussion." },
      { status: 400 },
    );
  }

  const discussion = await createDiscussion(getDb(), userId, parsed.data);
  revalidatePath("/community");
  revalidatePath("/community/discussions");
  return Response.json({ discussion }, { status: 201 });
}
