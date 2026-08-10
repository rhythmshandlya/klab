import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePlaygroundsStore } from "@/features/playground/labs-store";
import type { SavedPlayground } from "@/lib/labs/contracts";
import {
  createPlayground as createLocalPlayground,
  loadPlaygrounds,
} from "@/lib/storage/local-labs";

const REMOTE_PLAYGROUND: SavedPlayground = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "server lab",
  templateId: "empty",
  files: { "pod.yaml": "kind: Pod\n" },
  description: "",
  starred: false,
  visibility: "private",
  activeFilePath: "pod.yaml",
  createdAt: 100,
  updatedAt: 200,
  lastOpenedAt: 200,
};

beforeEach(() => {
  localStorage.clear();
  usePlaygroundsStore.getState().resetForAccountExit();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  usePlaygroundsStore.getState().resetForAccountExit();
});

describe("account-aware playgrounds store", () => {
  it("claims guest playgrounds once and removes the shared browser copy", async () => {
    const guest = createLocalPlayground({ name: "guest", templateId: "empty", files: {} });
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        playgrounds: [REMOTE_PLAYGROUND],
        claimedIds: { [guest.id]: REMOTE_PLAYGROUND.id },
      }),
    );

    await usePlaygroundsStore.getState().setIdentity("user-A");

    expect(request).toHaveBeenCalledWith(
      "/api/playgrounds",
      expect.objectContaining({ method: "POST" }),
    );
    expect(loadPlaygrounds()).toEqual([]);
    expect(usePlaygroundsStore.getState().playgrounds).toEqual([REMOTE_PLAYGROUND]);
    expect(usePlaygroundsStore.getState().claimedIds[guest.id]).toBe(REMOTE_PLAYGROUND.id);
  });

  it("never writes authenticated playgrounds to localStorage", async () => {
    const created = {
      ...REMOTE_PLAYGROUND,
      id: "123e4567-e89b-12d3-a456-426614174001",
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ playgrounds: [] }))
      .mockResolvedValueOnce(Response.json({ playground: created }));

    await usePlaygroundsStore.getState().setIdentity("user-A");
    await usePlaygroundsStore
      .getState()
      .create({ name: "server playground", templateId: "empty", files: {} });

    expect(loadPlaygrounds()).toEqual([]);
    expect(usePlaygroundsStore.getState().playgrounds).toEqual([created]);
  });
});
