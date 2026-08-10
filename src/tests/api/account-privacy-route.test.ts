import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { userId: "user-B" as string | null, update, set, where };
});

vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({
    api: { getSession: async () => (mocks.userId ? { user: { id: mocks.userId } } : null) },
  }),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ update: mocks.update }),
  hasDb: () => true,
}));
vi.mock("@/lib/env", () => ({ isAuthConfigured: () => true }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: async () => true }));

import { POST } from "@/app/api/account/privacy/route";

afterEach(() => {
  mocks.userId = "user-B";
  vi.clearAllMocks();
});

describe("account privacy route", () => {
  it("requires an authenticated session", async () => {
    mocks.userId = null;
    const response = await POST(
      new Request("http://test/api/account/privacy", {
        method: "POST",
        body: JSON.stringify({ publicProfile: true }),
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates only the session user's setting", async () => {
    const response = await POST(
      new Request("http://test/api/account/privacy", {
        method: "POST",
        body: JSON.stringify({ publicProfile: true }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ publicProfile: true, updatedAt: expect.any(Date) }),
    );
    expect(mocks.where).toHaveBeenCalledOnce();
  });
});
