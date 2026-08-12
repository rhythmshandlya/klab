import { revalidatePath } from "next/cache";

import { BRAND } from "@/config/brand";
import { z } from "zod";

import { getAuth } from "@/lib/auth/server";
import { moderateDiscussionSchema } from "@/lib/community/contracts";
import { getDb, hasDb } from "@/lib/db";
import { moderateDiscussion } from "@/lib/db/discussions-repo";
import { isAuthConfigured } from "@/lib/env";
import { allowRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ discussionId: string }> },
): Promise<Response> {
  if (!isAuthConfigured() || !hasDb()) {
    return Response.json({ error: "Community discussions are not configured." }, { status: 501 });
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await allowRequest(`discussion-moderate:${userId}`, { limit: 60, windowSec: 3600 }))) {
    return Response.json({ error: "Rate limited." }, { status: 429 });
  }

  const discussionId = z.uuid().safeParse((await params).discussionId);
  if (!discussionId.success) {
    return Response.json({ error: "Invalid discussion id." }, { status: 400 });
  }
  const parsed = moderateDiscussionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid moderation update." }, { status: 400 });
  }

  const discussion = await moderateDiscussion(getDb(), userId, discussionId.data, parsed.data);
  if (discussion === "forbidden") {
    return Response.json({ error: `Official ${BRAND.name} access required.` }, { status: 403 });
  }
  if (!discussion) return Response.json({ error: "Discussion not found." }, { status: 404 });
  revalidatePath("/community");
  revalidatePath("/community/discussions");
  revalidatePath(`/community/discussions/${discussionId.data}`, "layout");
  return Response.json({ discussion });
}
