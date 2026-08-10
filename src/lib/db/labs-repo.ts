import { and, desc, eq } from "drizzle-orm";

import type { LabDraft, SavedLab } from "@/lib/labs/contracts";

import type { ProgressDb } from "./progress-repo";
import { sandboxes } from "./schema";

function toSavedLab(row: typeof sandboxes.$inferSelect): SavedLab {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    files: row.files as Record<string, string>,
    createdAt: row.savedAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function readLabs(db: ProgressDb, userId: string): Promise<SavedLab[]> {
  const rows = await db
    .select()
    .from(sandboxes)
    .where(eq(sandboxes.userId, userId))
    .orderBy(desc(sandboxes.updatedAt));
  return rows.map(toSavedLab);
}

export async function createLab(
  db: ProgressDb,
  userId: string,
  draft: LabDraft,
): Promise<SavedLab> {
  const rows = await db
    .insert(sandboxes)
    .values({
      userId,
      clientId: draft.clientId,
      name: draft.name,
      templateId: draft.templateId,
      files: draft.files,
      savedAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    })
    .onConflictDoUpdate({
      target: [sandboxes.userId, sandboxes.clientId],
      set: {
        name: draft.name,
        templateId: draft.templateId,
        files: draft.files,
        updatedAt: new Date(draft.updatedAt),
      },
    })
    .returning();
  return toSavedLab(rows[0]!);
}

export async function updateLab(
  db: ProgressDb,
  userId: string,
  id: string,
  patch: { name?: string; files?: Record<string, string> },
): Promise<SavedLab | null> {
  const rows = await db
    .update(sandboxes)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(sandboxes.id, id), eq(sandboxes.userId, userId)))
    .returning();
  return rows[0] ? toSavedLab(rows[0]) : null;
}

export async function deleteLab(db: ProgressDb, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(sandboxes)
    .where(and(eq(sandboxes.id, id), eq(sandboxes.userId, userId)))
    .returning({ id: sandboxes.id });
  return rows.length > 0;
}

/** Claim browser-only guest labs for this account. Safe to retry by client id. */
export async function mergeGuestLabs(
  db: ProgressDb,
  userId: string,
  labs: readonly SavedLab[],
): Promise<void> {
  for (const lab of labs) {
    await createLab(db, userId, {
      clientId: `guest:${lab.id}`,
      name: lab.name,
      templateId: lab.templateId,
      files: lab.files,
      createdAt: lab.createdAt,
      updatedAt: lab.updatedAt,
    });
  }
}
