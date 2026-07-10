import { create } from "zustand";

import { createLab, deleteLab, loadLabs, updateLab, type SavedLab } from "@/lib/storage/local-labs";

/**
 * Shared view of the user's saved labs so the sidebar list and the workspace
 * toolbar stay in sync. Storage (localStorage) remains the source of truth;
 * every action re-mirrors it into state. Hydrates after mount (client-only).
 */
interface LabsState {
  labs: SavedLab[];
  hydrated: boolean;
  hydrate: () => void;
  create: (input: { name: string; templateId: string; files: Record<string, string> }) => SavedLab;
  update: (id: string, patch: { name?: string; files?: Record<string, string> }) => void;
  remove: (id: string) => void;
}

export const useLabsStore = create<LabsState>((set) => ({
  labs: [],
  hydrated: false,

  hydrate: () => set({ labs: loadLabs(), hydrated: true }),

  create: (input) => {
    const lab = createLab(input);
    set({ labs: loadLabs() });
    return lab;
  },

  update: (id, patch) => {
    updateLab(id, patch);
    set({ labs: loadLabs() });
  },

  remove: (id) => {
    deleteLab(id);
    set({ labs: loadLabs() });
  },
}));
