import { create } from "zustand";

import type { ProblemLevel } from "@/lib/domain/types";
import type { ValidationReport } from "@/lib/kube/validators";

/** Tabs in the center workspace's upper pane. */
export type CenterTab = "terminal" | "logs" | "events" | "network" | "diff";

export interface SelectedObject {
  kind: string;
  name: string;
  namespace: string;
}

interface LevelState {
  level: ProblemLevel | null;
  /** Current editor contents keyed by file path (starts from each file's initialValue). */
  files: Record<string, string>;
  activeFilePath: string;
  collectedEvidence: string[];
  revealedHintIds: string[];
  validation: ValidationReport | null;
  validating: boolean;
  solved: boolean;
  centerTab: CenterTab;
  selected: SelectedObject | null;

  initLevel: (level: ProblemLevel) => void;
  resetFiles: () => void;
  setFile: (path: string, content: string) => void;
  setActiveFile: (path: string) => void;
  /** Merge newly-collected evidence ids; returns the ids that were not already present. */
  addEvidence: (ids: readonly string[]) => string[];
  revealHint: (id: string) => void;
  setValidation: (report: ValidationReport | null) => void;
  setValidating: (value: boolean) => void;
  setSolved: (value: boolean) => void;
  setCenterTab: (tab: CenterTab) => void;
  select: (object: SelectedObject | null) => void;
}

function filesFromLevel(level: ProblemLevel): Record<string, string> {
  return Object.fromEntries(level.files.map((file) => [file.path, file.initialValue]));
}

export const useLevelStore = create<LevelState>((set, get) => ({
  level: null,
  files: {},
  activeFilePath: "",
  collectedEvidence: [],
  revealedHintIds: [],
  validation: null,
  validating: false,
  solved: false,
  centerTab: "terminal",
  selected: null,

  initLevel: (level) =>
    set({
      level,
      files: filesFromLevel(level),
      activeFilePath: level.files[0]?.path ?? "",
      collectedEvidence: [],
      revealedHintIds: [],
      validation: null,
      validating: false,
      solved: false,
      centerTab: "terminal",
      selected: null,
    }),

  resetFiles: () => {
    const level = get().level;
    if (level) set({ files: filesFromLevel(level), validation: null, solved: false });
  },

  setFile: (path, content) => set((state) => ({ files: { ...state.files, [path]: content } })),

  setActiveFile: (path) => set({ activeFilePath: path }),

  addEvidence: (ids) => {
    const current = get().collectedEvidence;
    const fresh = ids.filter((id) => !current.includes(id));
    if (fresh.length > 0) set({ collectedEvidence: [...current, ...fresh] });
    return fresh;
  },

  revealHint: (id) =>
    set((state) =>
      state.revealedHintIds.includes(id)
        ? state
        : { revealedHintIds: [...state.revealedHintIds, id] },
    ),

  setValidation: (report) => set({ validation: report }),
  setValidating: (value) => set({ validating: value }),
  setSolved: (value) => set({ solved: value }),
  setCenterTab: (tab) => set({ centerTab: tab }),
  select: (object) => set({ selected: object }),
}));
