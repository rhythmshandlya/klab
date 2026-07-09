/**
 * One-shot handoff of manifest files from a docs lab into the Playground. The docs
 * "Open in Playground" button stashes files here and navigates to /playground, which
 * consumes (and clears) them on mount. SSR-safe; best effort.
 */

const KEY = "klab:playground-handoff:v1";

export function setPlaygroundHandoff(files: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(files));
  } catch {
    // ignore
  }
}

/** Read and clear the pending handoff, if any. */
export function takePlaygroundHandoff(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return null;
  } catch {
    return null;
  }
}
