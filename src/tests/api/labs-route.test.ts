import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "user-B" as string | null,
  readLabs: vi.fn(async () => []),
  createLab: vi.fn(async () => ({
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "saved",
    templateId: "empty",
    files: {},
    createdAt: 1,
    updatedAt: 1,
  })),
  updateLab: vi.fn(async () => null),
  deleteLab: vi.fn(async () => false),
  mergeGuestLabs: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({
    api: { getSession: async () => (mocks.userId ? { user: { id: mocks.userId } } : null) },
  }),
}));
vi.mock("@/lib/db", () => ({ getDb: () => ({}), hasDb: () => true }));
vi.mock("@/lib/env", () => ({ isAuthConfigured: () => true }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: async () => true }));
vi.mock("@/lib/db/labs-repo", () => ({
  readLabs: mocks.readLabs,
  createLab: mocks.createLab,
  updateLab: mocks.updateLab,
  deleteLab: mocks.deleteLab,
  mergeGuestLabs: mocks.mergeGuestLabs,
}));

import { GET, POST } from "@/app/api/labs/route";

afterEach(() => {
  mocks.userId = "user-B";
  vi.clearAllMocks();
});

describe("labs route authorization", () => {
  it("rejects unauthenticated reads", async () => {
    mocks.userId = null;
    const response = await GET(new Request("http://test/api/labs"));
    expect(response.status).toBe(401);
    expect(mocks.readLabs).not.toHaveBeenCalled();
  });

  it("always creates for the session user", async () => {
    const response = await POST(
      new Request("http://test/api/labs", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          lab: {
            clientId: "create-client-0001",
            name: "saved",
            templateId: "empty",
            files: {},
            createdAt: 1,
            updatedAt: 1,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createLab).toHaveBeenCalledWith(
      {},
      "user-B",
      expect.objectContaining({ clientId: "create-client-0001" }),
    );
  });

  it("does not expose whether another user's lab id exists", async () => {
    const response = await POST(
      new Request("http://test/api/labs", {
        method: "POST",
        body: JSON.stringify({
          action: "update",
          id: "123e4567-e89b-12d3-a456-426614174000",
          patch: { name: "not yours" },
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mocks.updateLab).toHaveBeenCalledWith(
      {},
      "user-B",
      "123e4567-e89b-12d3-a456-426614174000",
      { name: "not yours" },
    );
  });
});
