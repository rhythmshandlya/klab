import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { Landing } from "@/components/landing/landing";
import {
  GUEST_ENTRY_COOKIE,
  GUEST_ENTRY_VALUE,
  homeEntryDestination,
  safeEntryDestination,
} from "@/lib/auth/entry";
import { getAuth } from "@/lib/auth/server";
import { getAuthCapabilities, isAuthConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const authEnabled = isAuthConfigured();
  const destination = safeEntryDestination((await searchParams).next);
  const hasGuestEntry = (await cookies()).get(GUEST_ENTRY_COOKIE)?.value === GUEST_ENTRY_VALUE;
  const session = authEnabled
    ? await getAuth()
        .api.getSession({ headers: await headers() })
        .catch(() => null)
    : null;
  const enteredDestination = homeEntryDestination({
    hasSession: Boolean(session?.user),
    hasGuestEntry,
    requestedDestination: destination,
  });
  if (enteredDestination) redirect(enteredDestination);

  return (
    <Landing
      authEnabled={authEnabled}
      authCapabilities={getAuthCapabilities()}
      destination={destination}
    />
  );
}
