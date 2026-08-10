import { create } from "zustand";

import type { PlaygroundPatch, SavedPlayground } from "@/lib/labs/contracts";
import { parsePlaygroundsResponse } from "@/lib/labs/contracts";
import {
  clearPlaygrounds,
  createPlayground as createLocalPlayground,
  deletePlayground as deleteLocalPlayground,
  duplicatePlayground as duplicateLocalPlayground,
  loadPlaygrounds,
  openPlayground as openLocalPlayground,
  updatePlayground as updateLocalPlayground,
} from "@/lib/storage/local-labs";
import { createClientMutationId } from "@/lib/storage/progress-intent";

type PlaygroundsIdentity = string | null | undefined;

interface PlaygroundsState {
  playgrounds: SavedPlayground[];
  /** Guest route id → server route id after a successful sign-in claim. */
  claimedIds: Record<string, string>;
  /** `undefined` means the auth session is still resolving. */
  identity: PlaygroundsIdentity;
  hydrated: boolean;
  error: string | null;
  setIdentity: (identity: string | null) => Promise<void>;
  hydrate: () => Promise<void>;
  create: (input: {
    name?: string;
    templateId: string;
    files: Record<string, string>;
    activeFilePath?: string;
  }) => Promise<SavedPlayground>;
  update: (id: string, patch: PlaygroundPatch) => Promise<SavedPlayground | undefined>;
  open: (id: string) => Promise<SavedPlayground | undefined>;
  duplicate: (id: string) => Promise<SavedPlayground | undefined>;
  remove: (id: string) => Promise<void>;
  resetForAccountExit: () => void;
}

let identityEpoch = 0;
const updateQueues = new Map<string, Promise<unknown>>();

function byRecent(a: SavedPlayground, b: SavedPlayground): number {
  return b.lastOpenedAt - a.lastOpenedAt || b.updatedAt - a.updatedAt;
}

function replaceOne(playgrounds: SavedPlayground[], next: SavedPlayground): SavedPlayground[] {
  return [next, ...playgrounds.filter((playground) => playground.id !== next.id)].sort(byRecent);
}

async function requestPlaygrounds(body?: unknown) {
  const response = await fetch("/api/playgrounds", {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) throw new Error(`Playground sync failed (${response.status}).`);
  return parsePlaygroundsResponse(await response.json());
}

export const usePlaygroundsStore = create<PlaygroundsState>((set, get) => {
  async function hydrateFor(identity: string | null, epoch: number): Promise<void> {
    if (identity === null) {
      if (epoch === identityEpoch) {
        set({ playgrounds: loadPlaygrounds(), claimedIds: {}, hydrated: true, error: null });
      }
      return;
    }

    try {
      const guestPlaygrounds = loadPlaygrounds();
      const result = guestPlaygrounds.length
        ? await requestPlaygrounds({ action: "merge", playgrounds: guestPlaygrounds })
        : await requestPlaygrounds();
      if (epoch !== identityEpoch || get().identity !== identity) return;
      if (guestPlaygrounds.length) clearPlaygrounds();
      set({
        playgrounds: result.playgrounds ?? [],
        claimedIds: result.claimedIds ?? {},
        hydrated: true,
        error: null,
      });
    } catch (error) {
      if (epoch !== identityEpoch || get().identity !== identity) return;
      set({
        playgrounds: [],
        claimedIds: {},
        hydrated: true,
        error: error instanceof Error ? error.message : "Could not load your playgrounds.",
      });
    }
  }

  return {
    playgrounds: [],
    claimedIds: {},
    identity: undefined,
    hydrated: false,
    error: null,

    async setIdentity(identity) {
      if (get().identity === identity && get().hydrated) return;
      const epoch = ++identityEpoch;
      set({ identity, playgrounds: [], claimedIds: {}, hydrated: false, error: null });
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
        const playground = createLocalPlayground(input);
        set({ playgrounds: loadPlaygrounds(), error: null });
        return playground;
      }

      const now = Date.now();
      const result = await requestPlaygrounds({
        action: "create",
        playground: {
          clientId: createClientMutationId(),
          name: input.name?.trim() || "Untitled Playground",
          templateId: input.templateId,
          files: input.files,
          description: "",
          starred: false,
          visibility: "private",
          activeFilePath: input.activeFilePath ?? Object.keys(input.files)[0] ?? "",
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
        },
      });
      if (!result.playground) throw new Error("The server did not return the new playground.");
      set((state) => ({
        playgrounds: replaceOne(state.playgrounds, result.playground!),
        error: null,
      }));
      return result.playground;
    },

    async update(id, patch) {
      const perform = async () => {
        const identity = get().identity;
        if (identity === undefined) throw new Error("Your account is still loading.");
        if (identity === null) {
          const playground = updateLocalPlayground(id, patch);
          set({ playgrounds: loadPlaygrounds(), error: null });
          return playground;
        }

        try {
          const result = await requestPlaygrounds({ action: "update", id, patch });
          if (!result.playground) throw new Error("The server did not return the playground.");
          set((state) => ({
            playgrounds: replaceOne(state.playgrounds, result.playground!),
            error: null,
          }));
          return result.playground;
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Could not save playground." });
          throw error;
        }
      };

      const queued = (updateQueues.get(id) ?? Promise.resolve()).then(perform, perform);
      updateQueues.set(
        id,
        queued.catch(() => undefined),
      );
      return queued;
    },

    async open(id) {
      const identity = get().identity;
      if (identity === undefined) return undefined;
      const playground =
        identity === null
          ? openLocalPlayground(id)
          : (await requestPlaygrounds({ action: "open", id })).playground;
      if (playground) {
        set((state) => ({ playgrounds: replaceOne(state.playgrounds, playground), error: null }));
      }
      return playground;
    },

    async duplicate(id) {
      const identity = get().identity;
      if (identity === undefined) throw new Error("Your account is still loading.");
      const playground =
        identity === null
          ? duplicateLocalPlayground(id)
          : (
              await requestPlaygrounds({
                action: "duplicate",
                id,
                clientId: createClientMutationId(),
              })
            ).playground;
      if (playground) {
        set((state) => ({ playgrounds: replaceOne(state.playgrounds, playground), error: null }));
      }
      return playground;
    },

    async remove(id) {
      const identity = get().identity;
      if (identity === undefined) throw new Error("Your account is still loading.");
      if (identity === null) deleteLocalPlayground(id);
      else await requestPlaygrounds({ action: "delete", id });
      set((state) => ({
        playgrounds: state.playgrounds.filter((playground) => playground.id !== id),
        error: null,
      }));
    },

    resetForAccountExit() {
      identityEpoch += 1;
      updateQueues.clear();
      clearPlaygrounds();
      set({
        identity: undefined,
        playgrounds: [],
        claimedIds: {},
        hydrated: false,
        error: null,
      });
    },
  };
});

/** @deprecated Prefer usePlaygroundsStore. */
export const useLabsStore = usePlaygroundsStore;
