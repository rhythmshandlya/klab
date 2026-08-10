import { z } from "zod";

import { getAuth } from "@/lib/auth/server";
import { getDb, hasDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { isAuthConfigured } from "@/lib/env";
import { allowRequest } from "@/lib/rate-limit";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ publicProfile: z.boolean() });

export async function POST(request: Request): Promise<Response> {
  if (!isAuthConfigured() || !hasDb()) {
    return Response.json({ error: "not configured" }, { status: 501 });
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await allowRequest(`account-privacy:${userId}`, { limit: 20, windowSec: 60 }))) {
    return Response.json({ error: "rate limited" }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid privacy settings" }, { status: 400 });

  await getDb()
    .update(user)
    .set({ publicProfile: parsed.data.publicProfile, updatedAt: new Date() })
    .where(eq(user.id, userId));
  revalidatePath("/community");
  return Response.json({ publicProfile: parsed.data.publicProfile });
}
import { revalidatePath } from "next/cache";
