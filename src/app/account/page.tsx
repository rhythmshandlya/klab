import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountSettings } from "@/features/account/account-settings";
import { getAuth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { isAuthConfigured } from "@/lib/env";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!isAuthConfigured()) redirect("/");

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/");
  const rows = await getDb()
    .select({ publicProfile: user.publicProfile })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  return (
    <AccountSettings
      userId={session.user.id}
      initialName={session.user.name}
      email={session.user.email}
      initialPublicProfile={rows[0]?.publicProfile ?? false}
    />
  );
}
