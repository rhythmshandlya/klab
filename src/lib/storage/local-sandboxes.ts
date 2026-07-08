import { z } from "zod";

/**
 * Local persistence for named playground sandboxes (localStorage). SSR-safe. Best
 * effort — failures are swallowed so a full/blocked storage never breaks the UI.
 */

const STORAGE_KEY = "klab:sandboxes:v1";

const sandboxSchema = z.object({
  name: z.string().min(1),
  templateId: z.string(),
  files: z.record(z.string(), z.string()),
  savedAt: z.number(),
});

const listSchema = z.array(sandboxSchema);

export type SavedSandbox = z.infer<typeof sandboxSchema>;

export function loadSandboxes(): SavedSandbox[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = listSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(list: SavedSandbox[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/** Save (or overwrite by name) a sandbox and return the updated list. */
export function saveSandbox(entry: SavedSandbox): SavedSandbox[] {
  const list = loadSandboxes().filter((s) => s.name !== entry.name);
  const next = [entry, ...list].sort((a, b) => b.savedAt - a.savedAt);
  write(next);
  return next;
}

export function deleteSandbox(name: string): SavedSandbox[] {
  const next = loadSandboxes().filter((s) => s.name !== name);
  write(next);
  return next;
}
