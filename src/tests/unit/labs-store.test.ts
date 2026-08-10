import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLabsStore } from "@/features/playground/labs-store";
import type { SavedLab } from "@/lib/labs/contracts";
import { createLab as createLocalLab, loadLabs } from "@/lib/storage/local-labs";

const REMOTE_LAB: SavedLab = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "server lab",
  templateId: "empty",
  files: { "pod.yaml": "kind: Pod\n" },
  createdAt: 100,
  updatedAt: 200,
};

beforeEach(() => {
  localStorage.clear();
  useLabsStore.getState().resetForAccountExit();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  useLabsStore.getState().resetForAccountExit();
});

describe("account-aware labs store", () => {
  it("claims guest labs once and removes the shared browser copy", async () => {
    createLocalLab({ name: "guest", templateId: "empty", files: {} });
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ labs: [REMOTE_LAB] }));

    await useLabsStore.getState().setIdentity("user-A");

    expect(request).toHaveBeenCalledWith("/api/labs", expect.objectContaining({ method: "POST" }));
    expect(loadLabs()).toEqual([]);
    expect(useLabsStore.getState().labs).toEqual([REMOTE_LAB]);
  });

  it("never writes authenticated labs to localStorage", async () => {
    const created = { ...REMOTE_LAB, id: "123e4567-e89b-12d3-a456-426614174001" };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ labs: [] }))
      .mockResolvedValueOnce(Response.json({ labs: [created], mutationId: created.id }));

    await useLabsStore.getState().setIdentity("user-A");
    await useLabsStore.getState().create({ name: "server lab", templateId: "empty", files: {} });

    expect(loadLabs()).toEqual([]);
    expect(useLabsStore.getState().labs).toEqual([created]);
  });
});
