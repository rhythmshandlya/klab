import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuth } from "@/lib/auth/server";
import { createDiscussionReplySchema } from "@/lib/community/contracts";
import { getDb, hasDb } from "@/lib/db";
import { createDiscussionReply } from "@/lib/db/discussions-repo";
import { isAuthConfigured } from "@/lib/env";
import { allowRequest } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ discussionId: string }> },
): Promise<Response> {
  if (!isAuthConfigured() || !hasDb()) {
    return Response.json({ error: "Community discussions are not configured." }, { status: 501 });
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to reply." }, { status: 401 });
  if (!(await allowRequest(`discussion-reply:${userId}`, { limit: 60, windowSec: 3600 }))) {
    return Response.json({ error: "Too many replies. Try again later." }, { status: 429 });
  }

  const discussionId = z.uuid().safeParse((await params).discussionId);
  if (!discussionId.success) {
    return Response.json({ error: "Invalid discussion id." }, { status: 400 });
  }
  const parsed = createDiscussionReplySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid reply." },
      { status: 400 },
    );
  }

  const reply = await createDiscussionReply(getDb(), userId, discussionId.data, parsed.data);
  if (reply === "closed") {
    return Response.json({ error: "This discussion is closed." }, { status: 409 });
  }
  if (reply === "not-found") {
    return Response.json({ error: "Discussion or parent reply not found." }, { status: 404 });
  }
  revalidatePath("/community");
  revalidatePath("/community/discussions");
  revalidatePath(`/community/discussions/${discussionId.data}`, "layout");
  return Response.json({ reply }, { status: 201 });
}
