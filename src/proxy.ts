import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { GUEST_ENTRY_COOKIE, GUEST_ENTRY_VALUE } from "@/lib/auth/entry";

/**
 * This is an entry-choice boundary, not an authorization boundary. Sensitive APIs
 * continue to validate their Better Auth session beside the data they protect.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(getSessionCookie(request));
  const hasGuestEntry = request.cookies.get(GUEST_ENTRY_COOKIE)?.value === GUEST_ENTRY_VALUE;
  if (hasSessionCookie || hasGuestEntry) return NextResponse.next();

  const landing = new URL("/", request.url);
  landing.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(landing);
}

export const config = {
  matcher: ["/problems/:path*", "/playground/:path*", "/docs/:path*", "/account/:path*"],
};
