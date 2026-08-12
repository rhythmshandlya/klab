import { describe, expect, it } from "vitest";

import { DELETE, POST } from "@/app/api/entry/guest/route";
import { GUEST_ENTRY_COOKIE, GUEST_ENTRY_VALUE } from "@/lib/auth/entry";

describe("guest entry route", () => {
  it("sets a scoped, HTTP-only guest-mode cookie", async () => {
    const response = await POST(
      new Request("https://klab.dev/api/entry/guest", { method: "POST" }),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain(`${GUEST_ENTRY_COOKIE}=${GUEST_ENTRY_VALUE}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
  });

  it("expires guest mode when an account takes over", async () => {
    const response = await DELETE(
      new Request("https://klab.dev/api/entry/guest", { method: "DELETE" }),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(204);
    expect(cookie).toContain(`${GUEST_ENTRY_COOKIE}=`);
    expect(cookie).toContain("Max-Age=0");
  });
});
