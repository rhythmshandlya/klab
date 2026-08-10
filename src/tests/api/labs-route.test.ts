import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: "user-B" as string | null,
  readPlaygrounds: vi.fn(async () => []),
  createPlayground: vi.fn(async () => ({
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "saved",
    templateId: "empty",
    files: {},
    description: "",
    starred: false,
    visibility: "private" as const,
    activeFilePath: "",
    createdAt: 1,
    updatedAt: 1,
    lastOpenedAt: 1,
  })),
  updatePlayground: vi.fn(async () => null),
  openPlayground: vi.fn(async () => null),
  duplicatePlayground: vi.fn(async () => null),
  deletePlayground: vi.fn(async () => false),
  mergeGuestPlaygrounds: vi.fn(async () => undefined),
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
  readPlaygrounds: mocks.readPlaygrounds,
  createPlayground: mocks.createPlayground,
  updatePlayground: mocks.updatePlayground,
  openPlayground: mocks.openPlayground,
  duplicatePlayground: mocks.duplicatePlayground,
  deletePlayground: mocks.deletePlayground,
  mergeGuestPlaygrounds: mocks.mergeGuestPlaygrounds,
}));

import { GET, POST } from "@/app/api/labs/route";

afterEach(() => {
  mocks.userId = "user-B";
  vi.clearAllMocks();
});

describe("playgrounds route authorization", () => {
  it("rejects unauthenticated reads", async () => {
    mocks.userId = null;
    const response = await GET(new Request("http://test/api/labs"));
    expect(response.status).toBe(401);
    expect(mocks.readPlaygrounds).not.toHaveBeenCalled();
  });

  it("always creates for the session user", async () => {
    const response = await POST(
      new Request("http://test/api/labs", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          playground: {
            clientId: "create-client-0001",
            name: "saved",
            templateId: "empty",
            files: {},
            description: "",
            starred: false,
            visibility: "private",
            activeFilePath: "",
            createdAt: 1,
            updatedAt: 1,
            lastOpenedAt: 1,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createPlayground).toHaveBeenCalledWith(
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
    expect(mocks.updatePlayground).toHaveBeenCalledWith(
      {},
      "user-B",
      "123e4567-e89b-12d3-a456-426614174000",
      { name: "not yours" },
    );
  });
});
