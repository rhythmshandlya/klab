import { z } from "zod";

import {
  savedPlaygroundSchema,
  type PlaygroundPatch,
  type SavedPlayground,
} from "@/lib/labs/contracts";

/** Guest-only persistence. Authenticated playgrounds always live in Postgres. */
const STORAGE_KEY = "klab:playgrounds:v1";
const LEGACY_LABS_KEY = "klab:labs:v1";
const LEGACY_SANDBOXES_KEY = "klab:sandboxes:v1";
const listSchema = z.array(savedPlaygroundSchema);

export type { SavedPlayground } from "@/lib/labs/contracts";

function newId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

function byRecent(a: SavedPlayground, b: SavedPlayground): number {
  return b.lastOpenedAt - a.lastOpenedAt || b.updatedAt - a.updatedAt;
}

function write(playgrounds: SavedPlayground[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(playgrounds));
  } catch {
    // Storage is best effort for guests.
  }
}

export function clearPlaygrounds(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_LABS_KEY);
    window.localStorage.removeItem(LEGACY_SANDBOXES_KEY);
  } catch {
    // ignore
  }
}

function loadLegacySandboxes(): SavedPlayground[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_SANDBOXES_KEY);
    if (!raw) return [];
    const legacySchema = z.array(
      z.object({
        name: z.string().min(1),
        templateId: z.string(),
        files: z.record(z.string(), z.string()),
        savedAt: z.number(),
      }),
    );
    const parsed = legacySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return parsed.data.map((item) => ({
      id: newId(),
      name: item.name,
      templateId: item.templateId,
      files: item.files,
      description: "",
      starred: false,
      visibility: "private" as const,
      activeFilePath: Object.keys(item.files)[0] ?? "",
      createdAt: item.savedAt,
      updatedAt: item.savedAt,
      lastOpenedAt: item.savedAt,
    }));
  } catch {
    return [];
  }
}

export function loadPlaygrounds(): SavedPlayground[] {
  if (typeof window === "undefined") return [];
  try {
    const currentRaw = window.localStorage.getItem(STORAGE_KEY);
    const legacyLabsRaw = window.localStorage.getItem(LEGACY_LABS_KEY);
    const current = currentRaw ? listSchema.safeParse(JSON.parse(currentRaw)) : null;
    const legacyLabs = legacyLabsRaw ? listSchema.safeParse(JSON.parse(legacyLabsRaw)) : null;
    const merged = [
      ...loadLegacySandboxes(),
      ...(legacyLabs?.success ? legacyLabs.data : []),
      ...(current?.success ? current.data : []),
    ];
    const unique = [
      ...new Map(merged.map((playground) => [playground.id, playground])).values(),
    ].sort(byRecent);

    if (legacyLabsRaw || window.localStorage.getItem(LEGACY_SANDBOXES_KEY)) {
      write(unique);
      window.localStorage.removeItem(LEGACY_LABS_KEY);
      window.localStorage.removeItem(LEGACY_SANDBOXES_KEY);
    }
    return unique;
  } catch {
    return [];
  }
}

export function createPlayground(input: {
  name?: string;
  templateId: string;
  files: Record<string, string>;
  activeFilePath?: string;
}): SavedPlayground {
  const now = Date.now();
  const playground: SavedPlayground = {
    id: newId(),
    name: input.name?.trim() || "Untitled Playground",
    templateId: input.templateId,
    files: { ...input.files },
    description: "",
    starred: false,
    visibility: "private",
    activeFilePath: input.activeFilePath ?? Object.keys(input.files)[0] ?? "",
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
  write([playground, ...loadPlaygrounds()].sort(byRecent));
  return playground;
}

export function updatePlayground(id: string, patch: PlaygroundPatch): SavedPlayground | undefined {
  const playgrounds = loadPlaygrounds();
  const existing = playgrounds.find((playground) => playground.id === id);
  if (!existing) return undefined;
  const latest = Math.max(...playgrounds.map((playground) => playground.updatedAt));
  const now = Math.max(Date.now(), latest + 1);
  const next: SavedPlayground = {
    ...existing,
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() || existing.name } : {}),
    ...(patch.files !== undefined ? { files: { ...patch.files } } : {}),
    updatedAt: now,
    lastOpenedAt: now,
  };
  write(playgrounds.map((playground) => (playground.id === id ? next : playground)).sort(byRecent));
  return next;
}

export function openPlayground(id: string): SavedPlayground | undefined {
  const playgrounds = loadPlaygrounds();
  const existing = playgrounds.find((playground) => playground.id === id);
  if (!existing) return undefined;
  const next = { ...existing, lastOpenedAt: Date.now() };
  write(playgrounds.map((playground) => (playground.id === id ? next : playground)).sort(byRecent));
  return next;
}

export function duplicatePlayground(id: string): SavedPlayground | undefined {
  const source = loadPlaygrounds().find((playground) => playground.id === id);
  if (!source) return undefined;
  const created = createPlayground({
    name: `${source.name} copy`,
    templateId: source.templateId,
    files: source.files,
    activeFilePath: source.activeFilePath,
  });
  return updatePlayground(created.id, { description: source.description });
}

export function deletePlayground(id: string): void {
  write(loadPlaygrounds().filter((playground) => playground.id !== id));
}

// Compatibility exports while call sites move from Labs to Playgrounds.
export const loadLabs = loadPlaygrounds;
export const clearLabs = clearPlaygrounds;
export const createLab = createPlayground;
export const updateLab = updatePlayground;
export const deleteLab = deletePlayground;
export const getLab = (id: string) => loadPlaygrounds().find((playground) => playground.id === id);
