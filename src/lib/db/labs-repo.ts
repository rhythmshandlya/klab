import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { PlaygroundDraft, PlaygroundPatch, SavedPlayground } from "@/lib/labs/contracts";
import {
  checkPlaygroundPublishSafety,
  type PublishSafetyIssue,
} from "@/lib/playgrounds/publish-safety";

import type { ProgressDb } from "./progress-repo";
import { sandboxes, user } from "./schema";

type SandboxRow = typeof sandboxes.$inferSelect;

function toSavedPlayground(row: SandboxRow, publication?: SandboxRow): SavedPlayground {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    files: row.files as Record<string, string>,
    description: row.description,
    starred: row.starred,
    visibility:
      row.visibility === "public" ? "public" : row.visibility === "link" ? "link" : "private",
    activeFilePath: row.activeFilePath,
    publishedCopyId: publication?.id ?? null,
    publishedAt: publication?.publishedAt?.getTime() ?? null,
    forkCount: publication?.forkCount ?? 0,
    forkedFromId: row.forkedFromId,
    createdAt: row.savedAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    lastOpenedAt: row.lastOpenedAt.getTime(),
  };
}

export async function readPlaygrounds(db: ProgressDb, userId: string): Promise<SavedPlayground[]> {
  const [rows, publications] = await Promise.all([
    db
      .select()
      .from(sandboxes)
      .where(and(eq(sandboxes.userId, userId), isNull(sandboxes.publishedFromId)))
      .orderBy(desc(sandboxes.lastOpenedAt), desc(sandboxes.updatedAt)),
    db
      .select()
      .from(sandboxes)
      .where(
        and(
          eq(sandboxes.userId, userId),
          isNotNull(sandboxes.publishedFromId),
          eq(sandboxes.visibility, "public"),
        ),
      ),
  ]);
  const bySource = new Map(
    publications.map((publication) => [publication.publishedFromId!, publication]),
  );
  return rows.map((row) => toSavedPlayground(row, bySource.get(row.id)));
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
    .where(
      and(eq(sandboxes.id, id), eq(sandboxes.userId, userId), isNull(sandboxes.publishedFromId)),
    )
    .returning();
  if (!rows[0]) return null;
  const publications = await db
    .select()
    .from(sandboxes)
    .where(
      and(
        eq(sandboxes.userId, userId),
        eq(sandboxes.publishedFromId, id),
        eq(sandboxes.visibility, "public"),
      ),
    )
    .limit(1);
  return toSavedPlayground(rows[0], publications[0]);
}

export async function openPlayground(
  db: ProgressDb,
  userId: string,
  id: string,
): Promise<SavedPlayground | null> {
  const rows = await db
    .update(sandboxes)
    .set({ lastOpenedAt: new Date() })
    .where(
      and(eq(sandboxes.id, id), eq(sandboxes.userId, userId), isNull(sandboxes.publishedFromId)),
    )
    .returning();
  if (!rows[0]) return null;
  const publications = await db
    .select()
    .from(sandboxes)
    .where(
      and(
        eq(sandboxes.userId, userId),
        eq(sandboxes.publishedFromId, id),
        eq(sandboxes.visibility, "public"),
      ),
    )
    .limit(1);
  return toSavedPlayground(rows[0], publications[0]);
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
    .where(
      and(eq(sandboxes.id, id), eq(sandboxes.userId, userId), isNull(sandboxes.publishedFromId)),
    )
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

export type PublishPlaygroundResult =
  | { status: "published"; playground: SavedPlayground }
  | { status: "not-found" }
  | { status: "profile-private" }
  | { status: "unsafe"; issues: PublishSafetyIssue[] };

/** Create or refresh a public snapshot while leaving the working Playground private. */
export async function publishPlaygroundSnapshot(
  db: ProgressDb,
  userId: string,
  id: string,
  description: string,
): Promise<PublishPlaygroundResult> {
  const [sources, profiles] = await Promise.all([
    db
      .select()
      .from(sandboxes)
      .where(
        and(eq(sandboxes.id, id), eq(sandboxes.userId, userId), isNull(sandboxes.publishedFromId)),
      )
      .limit(1),
    db.select({ publicProfile: user.publicProfile }).from(user).where(eq(user.id, userId)).limit(1),
  ]);
  const source = sources[0];
  if (!source) return { status: "not-found" };
  if (!profiles[0]?.publicProfile) return { status: "profile-private" };

  const files = source.files as Record<string, string>;
  const issues = checkPlaygroundPublishSafety(files);
  if (issues.length) return { status: "unsafe", issues };

  const now = new Date();
  const cleanDescription = description.trim();
  const updatedSources = await db
    .update(sandboxes)
    .set({ description: cleanDescription, updatedAt: now })
    .where(and(eq(sandboxes.id, source.id), eq(sandboxes.userId, userId)))
    .returning();
  const updatedSource = updatedSources[0] ?? { ...source, description: cleanDescription };

  const publications = await db
    .insert(sandboxes)
    .values({
      userId,
      clientId: `published:${source.id}`,
      name: source.name,
      templateId: source.templateId,
      files,
      description: cleanDescription,
      starred: false,
      visibility: "public",
      activeFilePath: source.activeFilePath,
      publishedFromId: source.id,
      publishedAt: now,
      savedAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    })
    .onConflictDoUpdate({
      target: [sandboxes.userId, sandboxes.clientId],
      set: {
        name: source.name,
        templateId: source.templateId,
        files,
        description: cleanDescription,
        visibility: "public",
        activeFilePath: source.activeFilePath,
        publishedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  return {
    status: "published",
    playground: toSavedPlayground(updatedSource, publications[0]),
  };
}

export async function unpublishPlaygroundSnapshot(
  db: ProgressDb,
  userId: string,
  id: string,
): Promise<SavedPlayground | null> {
  const sources = await db
    .select()
    .from(sandboxes)
    .where(
      and(eq(sandboxes.id, id), eq(sandboxes.userId, userId), isNull(sandboxes.publishedFromId)),
    )
    .limit(1);
  const source = sources[0];
  if (!source) return null;
  await db
    .update(sandboxes)
    .set({ visibility: "private", publishedAt: null, updatedAt: new Date() })
    .where(and(eq(sandboxes.userId, userId), eq(sandboxes.publishedFromId, id)));
  return toSavedPlayground(source);
}

/** Idempotently fork a discoverable snapshot into the signed-in user's private library. */
export async function forkPublicPlayground(
  db: ProgressDb,
  userId: string,
  id: string,
  clientId: string,
): Promise<SavedPlayground | null> {
  const rows = await db
    .select({ playground: sandboxes })
    .from(sandboxes)
    .innerJoin(user, eq(user.id, sandboxes.userId))
    .where(
      and(
        eq(sandboxes.id, id),
        eq(sandboxes.visibility, "public"),
        isNotNull(sandboxes.publishedFromId),
        eq(user.publicProfile, true),
      ),
    )
    .limit(1);
  const source = rows[0]?.playground;
  if (!source) return null;

  const now = new Date();
  const inserted = await db
    .insert(sandboxes)
    .values({
      userId,
      clientId,
      name: `${source.name} fork`,
      templateId: source.templateId,
      files: source.files,
      description: source.description,
      starred: false,
      visibility: "private",
      activeFilePath: source.activeFilePath,
      forkedFromId: source.id,
      savedAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    })
    .onConflictDoNothing({ target: [sandboxes.userId, sandboxes.clientId] })
    .returning();

  if (inserted[0]) {
    await db
      .update(sandboxes)
      .set({ forkCount: sql`${sandboxes.forkCount} + 1` })
      .where(eq(sandboxes.id, source.id));
    return toSavedPlayground(inserted[0]);
  }

  const existing = await db
    .select()
    .from(sandboxes)
    .where(and(eq(sandboxes.userId, userId), eq(sandboxes.clientId, clientId)))
    .limit(1);
  return existing[0] ? toSavedPlayground(existing[0]) : null;
}

export async function deletePlayground(
  db: ProgressDb,
  userId: string,
  id: string,
): Promise<boolean> {
  await db
    .delete(sandboxes)
    .where(and(eq(sandboxes.userId, userId), eq(sandboxes.publishedFromId, id)));
  const rows = await db
    .delete(sandboxes)
    .where(
      and(eq(sandboxes.id, id), eq(sandboxes.userId, userId), isNull(sandboxes.publishedFromId)),
    )
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
      // Browser data can be edited by the user; claiming it must never publish it.
      visibility: playground.visibility === "link" ? "link" : "private",
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
