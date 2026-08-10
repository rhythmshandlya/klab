import { create } from "zustand";

import type { PlaygroundTemplate } from "@/lib/domain/types";

/** Multi-file sandbox UI state. Simulator/cluster state lives in the useSimulator hook. */
interface PlaygroundState {
  template: PlaygroundTemplate | null;
  /** Current editor contents keyed by file path. */
  files: Record<string, string>;
  activeFilePath: string;
  /** Increments only when manifest contents change, for debounced persistence. */
  contentRevision: number;

  initTemplate: (template: PlaygroundTemplate) => void;
  setFile: (path: string, content: string) => void;
  addFile: (path: string) => void;
  removeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  resetToTemplate: () => void;
  loadFiles: (files: Record<string, string>, activeFilePath?: string) => void;
}

function filesFromTemplate(template: PlaygroundTemplate): Record<string, string> {
  return Object.fromEntries(template.files.map((f) => [f.path, f.initialValue]));
}

const STARTER = "# New manifest\n";

export const usePlaygroundStore = create<PlaygroundState>((set, get) => ({
  template: null,
  files: {},
  activeFilePath: "",
  contentRevision: 0,

  initTemplate: (template) =>
    set({
      template,
      files: filesFromTemplate(template),
      activeFilePath: template.files[0]?.path ?? "",
      contentRevision: 0,
    }),

  setFile: (path, content) =>
    set((s) =>
      s.files[path] === content
        ? s
        : { files: { ...s.files, [path]: content }, contentRevision: s.contentRevision + 1 },
    ),

  addFile: (path) => {
    const clean = path.trim();
    if (clean === "" || get().files[clean] !== undefined) return;
    set((s) => ({
      files: { ...s.files, [clean]: STARTER },
      activeFilePath: clean,
      contentRevision: s.contentRevision + 1,
    }));
  },

  removeFile: (path) =>
    set((s) => {
      const next = { ...s.files };
      delete next[path];
      const remaining = Object.keys(next);
      return {
        files: next,
        activeFilePath: s.activeFilePath === path ? (remaining[0] ?? "") : s.activeFilePath,
        contentRevision: s.contentRevision + 1,
      };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  resetToTemplate: () => {
    const template = get().template;
    if (template) {
      set((s) => ({
        files: filesFromTemplate(template),
        activeFilePath: template.files[0]?.path ?? "",
        contentRevision: s.contentRevision + 1,
      }));
    }
  },

  loadFiles: (files, activeFilePath) =>
    set({
      files: { ...files },
      activeFilePath:
        activeFilePath && files[activeFilePath] !== undefined
          ? activeFilePath
          : (Object.keys(files)[0] ?? ""),
      contentRevision: 0,
    }),
}));
