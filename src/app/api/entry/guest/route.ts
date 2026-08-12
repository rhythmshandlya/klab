import { NextResponse } from "next/server";

import {
  GUEST_ENTRY_COOKIE,
  GUEST_ENTRY_MAX_AGE_SECONDS,
  GUEST_ENTRY_VALUE,
} from "@/lib/auth/entry";

function cookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: new URL(request.url).protocol === "https:",
    path: "/",
  };
}

export async function POST(request: Request): Promise<Response> {
  const response = NextResponse.json({ mode: "guest" });
  response.cookies.set(GUEST_ENTRY_COOKIE, GUEST_ENTRY_VALUE, {
    ...cookieOptions(request),
    maxAge: GUEST_ENTRY_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE(request: Request): Promise<Response> {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(GUEST_ENTRY_COOKIE, "", {
    ...cookieOptions(request),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
