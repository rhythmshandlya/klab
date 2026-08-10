import { z } from "zod";

import { savedLabSchema, type SavedLab } from "@/lib/labs/contracts";

/**
 * Local persistence for the user's saved labs. A lab is the user's own work —
 * a named snapshot of editor files plus the template whose cluster it boots on.
 * Templates themselves are read-only starting points and are never saved.
 *
 * SSR-safe and best effort: failures are swallowed so a full/blocked storage
 * never breaks the UI. Entries saved by the old "sandboxes" widget migrate in
 * transparently on first read.
 */

const STORAGE_KEY = "klab:labs:v1";
const LEGACY_SANDBOXES_KEY = "klab:sandboxes:v1";

const listSchema = z.array(savedLabSchema);

export type { SavedLab } from "@/lib/labs/contracts";

function newId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

function write(list: SavedLab[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** Remove guest-only labs after an authenticated account has claimed them. */
export function clearLabs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_SANDBOXES_KEY);
  } catch {
    // ignore
  }
}

/** One-time import of labs saved under the legacy sandboxes key. */
function migrateLegacySandboxes(): SavedLab[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_SANDBOXES_KEY);
    if (!raw) return [];
    window.localStorage.removeItem(LEGACY_SANDBOXES_KEY);
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
    return parsed.data.map((s) => ({
      id: newId(),
      name: s.name,
      templateId: s.templateId,
      files: s.files,
      createdAt: s.savedAt,
      updatedAt: s.savedAt,
    }));
  } catch {
    return [];
  }
}

export function loadLabs(): SavedLab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? listSchema.safeParse(JSON.parse(raw)) : null;
    const labs = parsed?.success ? parsed.data : [];
    const migrated = migrateLegacySandboxes();
    if (migrated.length > 0) {
      const merged = [...migrated, ...labs].sort((a, b) => b.updatedAt - a.updatedAt);
      write(merged);
      return merged;
    }
    return labs;
  } catch {
    return [];
  }
}

export function getLab(id: string): SavedLab | undefined {
  return loadLabs().find((lab) => lab.id === id);
}

export function createLab(input: {
  name: string;
  templateId: string;
  files: Record<string, string>;
}): SavedLab {
  const now = Date.now();
  const lab: SavedLab = {
    id: newId(),
    name: input.name.trim() || "untitled lab",
    templateId: input.templateId,
    files: { ...input.files },
    createdAt: now,
    updatedAt: now,
  };
  write([lab, ...loadLabs()]);
  return lab;
}

export function updateLab(
  id: string,
  patch: { name?: string; files?: Record<string, string> },
): SavedLab | undefined {
  const labs = loadLabs();
  const existing = labs.find((lab) => lab.id === id);
  if (!existing) return undefined;
  const latest = Math.max(...labs.map((lab) => lab.updatedAt));
  const next: SavedLab = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() || existing.name } : {}),
    ...(patch.files !== undefined ? { files: { ...patch.files } } : {}),
    // Monotonic: an update always outranks every other lab, even within one ms.
    updatedAt: Math.max(Date.now(), latest + 1),
  };
  write(labs.map((lab) => (lab.id === id ? next : lab)).sort((a, b) => b.updatedAt - a.updatedAt));
  return next;
}

export function deleteLab(id: string): SavedLab[] {
  const next = loadLabs().filter((lab) => lab.id !== id);
  write(next);
  return next;
}
