import { and, desc, eq } from "drizzle-orm";

import type { PlaygroundDraft, PlaygroundPatch, SavedPlayground } from "@/lib/labs/contracts";

import type { ProgressDb } from "./progress-repo";
import { sandboxes } from "./schema";

function toSavedPlayground(row: typeof sandboxes.$inferSelect): SavedPlayground {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    files: row.files as Record<string, string>,
    description: row.description,
    starred: row.starred,
    visibility: row.visibility === "link" ? "link" : "private",
    activeFilePath: row.activeFilePath,
    createdAt: row.savedAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    lastOpenedAt: row.lastOpenedAt.getTime(),
  };
}

export async function readPlaygrounds(db: ProgressDb, userId: string): Promise<SavedPlayground[]> {
  const rows = await db
    .select()
    .from(sandboxes)
    .where(eq(sandboxes.userId, userId))
    .orderBy(desc(sandboxes.lastOpenedAt), desc(sandboxes.updatedAt));
  return rows.map(toSavedPlayground);
}

export async function createPlayground(
  db: ProgressDb,
  userId: string,
  draft: PlaygroundDraft,
): Promise<SavedPlayground> {
  const values = {
    userId,
    clientId: draft.clientId,
    name: draft.name,
    templateId: draft.templateId,
    files: draft.files,
    description: draft.description,
    starred: draft.starred,
    visibility: draft.visibility,
    activeFilePath: draft.activeFilePath,
    savedAt: new Date(draft.createdAt),
    updatedAt: new Date(draft.updatedAt),
    lastOpenedAt: new Date(draft.lastOpenedAt),
  };
  const rows = await db
    .insert(sandboxes)
    .values(values)
    .onConflictDoUpdate({
      target: [sandboxes.userId, sandboxes.clientId],
      set: {
        name: values.name,
        templateId: values.templateId,
        files: values.files,
        description: values.description,
        starred: values.starred,
        visibility: values.visibility,
        activeFilePath: values.activeFilePath,
        updatedAt: values.updatedAt,
        lastOpenedAt: values.lastOpenedAt,
      },
    })
    .returning();
  return toSavedPlayground(rows[0]!);
}

export async function updatePlayground(
  db: ProgressDb,
  userId: string,
  id: string,
  patch: PlaygroundPatch,
): Promise<SavedPlayground | null> {
  const now = new Date();
  const rows = await db
    .update(sandboxes)
    .set({ ...patch, updatedAt: now, lastOpenedAt: now })
    .where(and(eq(sandboxes.id, id), eq(sandboxes.userId, userId)))
    .returning();
  return rows[0] ? toSavedPlayground(rows[0]) : null;
}

export async function openPlayground(
  db: ProgressDb,
  userId: string,
  id: string,
): Promise<SavedPlayground | null> {
  const rows = await db
    .update(sandboxes)
    .set({ lastOpenedAt: new Date() })
    .where(and(eq(sandboxes.id, id), eq(sandboxes.userId, userId)))
    .returning();
  return rows[0] ? toSavedPlayground(rows[0]) : null;
}

export async function duplicatePlayground(
  db: ProgressDb,
  userId: string,
  id: string,
  clientId: string,
): Promise<SavedPlayground | null> {
  const rows = await db
    .select()
    .from(sandboxes)
    .where(and(eq(sandboxes.id, id), eq(sandboxes.userId, userId)))
    .limit(1);
  const source = rows[0];
  if (!source) return null;

  const now = Date.now();
  return createPlayground(db, userId, {
    clientId,
    name: `${source.name} copy`,
    templateId: source.templateId,
    files: source.files as Record<string, string>,
    description: source.description,
    starred: false,
    visibility: "private",
    activeFilePath: source.activeFilePath,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  });
}

export async function deletePlayground(
  db: ProgressDb,
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(sandboxes)
    .where(and(eq(sandboxes.id, id), eq(sandboxes.userId, userId)))
    .returning({ id: sandboxes.id });
  return rows.length > 0;
}

/** Claim browser-only guest playgrounds for this account. Safe to retry by client id. */
export async function mergeGuestPlaygrounds(
  db: ProgressDb,
  userId: string,
  playgrounds: readonly SavedPlayground[],
): Promise<Record<string, string>> {
  const claimedIds: Record<string, string> = {};
  for (const playground of playgrounds) {
    const claimed = await createPlayground(db, userId, {
      clientId: `guest:${playground.id}`,
      name: playground.name,
      templateId: playground.templateId,
      files: playground.files,
      description: playground.description,
      starred: playground.starred,
      visibility: playground.visibility,
      activeFilePath: playground.activeFilePath,
      createdAt: playground.createdAt,
      updatedAt: playground.updatedAt,
      lastOpenedAt: playground.lastOpenedAt,
    });
    claimedIds[playground.id] = claimed.id;
  }
  return claimedIds;
}

// Server compatibility for the legacy /api/labs route.
export const readLabs = readPlaygrounds;
export const createLab = createPlayground;
export const updateLab = updatePlayground;
export const deleteLab = deletePlayground;
export const mergeGuestLabs = mergeGuestPlaygrounds;
