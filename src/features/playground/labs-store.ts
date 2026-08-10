import { create } from "zustand";

import { createClientMutationId } from "@/lib/storage/progress-intent";
import { clearLabs, createLab, deleteLab, loadLabs, updateLab } from "@/lib/storage/local-labs";
import { parseLabsResponse, type SavedLab } from "@/lib/labs/contracts";

type LabsIdentity = string | null | undefined;

interface LabsState {
  labs: SavedLab[];
  /** `undefined` means the auth session is still resolving. */
  identity: LabsIdentity;
  hydrated: boolean;
  error: string | null;
  setIdentity: (identity: string | null) => Promise<void>;
  hydrate: () => Promise<void>;
  create: (input: {
    name: string;
    templateId: string;
    files: Record<string, string>;
  }) => Promise<SavedLab>;
  update: (
    id: string,
    patch: { name?: string; files?: Record<string, string> },
  ) => Promise<SavedLab | undefined>;
  remove: (id: string) => Promise<void>;
  resetForAccountExit: () => void;
}

let identityEpoch = 0;

async function requestLabs(body?: unknown): Promise<{ labs: SavedLab[]; mutationId?: string }> {
  const response = await fetch("/api/labs", {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) throw new Error(`Lab sync failed (${response.status}).`);
  return parseLabsResponse(await response.json());
}

function localCreate(input: {
  name: string;
  templateId: string;
  files: Record<string, string>;
}): SavedLab {
  return createLab(input);
}

export const useLabsStore = create<LabsState>((set, get) => {
  async function hydrateFor(identity: string | null, epoch: number): Promise<void> {
    if (identity === null) {
      if (epoch === identityEpoch) set({ labs: loadLabs(), hydrated: true, error: null });
      return;
    }

    try {
      const guestLabs = loadLabs();
      const result =
        guestLabs.length > 0
          ? await requestLabs({ action: "merge", labs: guestLabs })
          : await requestLabs();
      if (epoch !== identityEpoch || get().identity !== identity) return;
      if (guestLabs.length > 0) clearLabs();
      set({ labs: result.labs, hydrated: true, error: null });
    } catch (error) {
      if (epoch !== identityEpoch || get().identity !== identity) return;
      set({
        labs: [],
        hydrated: true,
        error: error instanceof Error ? error.message : "Could not load saved labs.",
      });
    }
  }

  return {
    labs: [],
    identity: undefined,
    hydrated: false,
    error: null,

    async setIdentity(identity) {
      if (get().identity === identity && get().hydrated) return;
      const epoch = ++identityEpoch;
      set({ identity, labs: [], hydrated: false, error: null });
      await hydrateFor(identity, epoch);
    },

    async hydrate() {
      const identity = get().identity;
      if (identity === undefined || get().hydrated) return;
      await hydrateFor(identity, identityEpoch);
    },

    async create(input) {
      const identity = get().identity;
      if (identity === undefined) throw new Error("Your account is still loading.");
      if (identity === null) {
        const lab = localCreate(input);
        set({ labs: loadLabs(), error: null });
        return lab;
      }

      const now = Date.now();
      const clientId = createClientMutationId();
      const result = await requestLabs({
        action: "create",
        lab: {
          clientId,
          name: input.name.trim() || "untitled lab",
          templateId: input.templateId,
          files: input.files,
          createdAt: now,
          updatedAt: now,
        },
      });
      const created = result.labs.find((lab) => lab.id === result.mutationId);
      if (!created) throw new Error("The server did not return the saved lab.");
      set({ labs: result.labs, error: null });
      return created;
    },

    async update(id, patch) {
      const identity = get().identity;
      if (identity === undefined) throw new Error("Your account is still loading.");
      if (identity === null) {
        const updated = updateLab(id, patch);
        set({ labs: loadLabs(), error: null });
        return updated;
      }

      const result = await requestLabs({ action: "update", id, patch });
      set({ labs: result.labs, error: null });
      return result.labs.find((lab) => lab.id === id);
    },

    async remove(id) {
      const identity = get().identity;
      if (identity === undefined) throw new Error("Your account is still loading.");
      if (identity === null) {
        deleteLab(id);
        set({ labs: loadLabs(), error: null });
        return;
      }

      const result = await requestLabs({ action: "delete", id });
      set({ labs: result.labs, error: null });
    },

    resetForAccountExit() {
      identityEpoch += 1;
      clearLabs();
      set({ identity: undefined, labs: [], hydrated: false, error: null });
    },
  };
});
