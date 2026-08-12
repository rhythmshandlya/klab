import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Landing } from "@/components/landing/landing";
import { BRAND } from "@/config/brand";
import {
  GUEST_ENTRY_COOKIE,
  GUEST_ENTRY_VALUE,
  homeEntryDestination,
  safeEntryDestination,
} from "@/lib/auth/entry";
import { getAuth } from "@/lib/auth/server";
import { getAuthCapabilities, isAuthConfigured } from "@/lib/env";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interactive Kubernetes practice in your browser",
  description:
    "Practice Kubernetes by diagnosing production-inspired incidents, editing manifests, running kubectl-style commands, and watching a simulated cluster reconcile in your browser.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${BRAND.name}: learn production Kubernetes by fixing what breaks`,
    description:
      "Hands-on Kubernetes incidents, architecture challenges, interactive lessons, and a browser playground.",
    url: "/",
    type: "website",
  },
};

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: BRAND.name,
            url: absoluteUrl("/"),
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web browser",
            description:
              "An interactive Kubernetes practice platform with incidents, architecture challenges, lessons, and a simulated cluster playground.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <Landing
        authEnabled={authEnabled}
        authCapabilities={getAuthCapabilities()}
        destination={destination}
      />
    </>
  );
}
