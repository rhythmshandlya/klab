import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GUEST_ENTRY_COOKIE, GUEST_ENTRY_VALUE } from "@/lib/auth/entry";
import { config, proxy } from "@/proxy";

describe("product entry proxy", () => {
  it("returns signed-out visitors to the landing page with their deep link", () => {
    const response = proxy(
      new NextRequest("https://klab.dev/playground/deployment-service?mode=debug"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://klab.dev/?next=%2Fplayground%2Fdeployment-service%3Fmode%3Ddebug",
    );
  });

  it("keeps Community outside the entry gate for public readers and crawlers", () => {
    expect(config.matcher).not.toContain("/community/:path*");
  });

  it("allows a visitor who explicitly selected guest mode", () => {
    const request = new NextRequest("https://klab.dev/playground", {
      headers: { cookie: `${GUEST_ENTRY_COOKIE}=${GUEST_ENTRY_VALUE}` },
    });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  });

  it("optimistically allows a Better Auth session cookie", () => {
    const request = new NextRequest("https://klab.dev/problems", {
      headers: { cookie: "better-auth.session_token=signed-session-value" },
    });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  });
});
