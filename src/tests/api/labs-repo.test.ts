import { describe, expect, it } from "vitest";

import {
  createPlayground,
  deletePlayground,
  duplicatePlayground,
  forkPublicPlayground,
  mergeGuestPlaygrounds,
  openPlayground,
  publishPlaygroundSnapshot,
  readPlaygrounds,
  unpublishPlaygroundSnapshot,
  updatePlayground,
} from "@/lib/db/labs-repo";
import { readPublicPlaygrounds } from "@/lib/db/community-repo";
import { user } from "@/lib/db/schema";
import type { SavedPlayground } from "@/lib/labs/contracts";
import { eq } from "drizzle-orm";

import { createTestDb, seedUser } from "./pglite";

const GUEST_PLAYGROUND: SavedPlayground = {
  id: "guest-lab-1",
  name: "guest work",
  templateId: "deployment-service",
  files: { "deployment.yaml": "kind: Deployment\n" },
  description: "guest notes",
  starred: true,
  visibility: "private",
  activeFilePath: "deployment.yaml",
  publishedCopyId: null,
  publishedAt: null,
  forkCount: 0,
  forkedFromId: null,
  createdAt: 100,
  updatedAt: 200,
  lastOpenedAt: 250,
};

describe("playgrounds repository over pglite", () => {
  it("claims guest playgrounds idempotently and updates a retried client mutation", async () => {
    const { db, client } = await createTestDb();
    try {
      const userId = await seedUser(db);
      await mergeGuestPlaygrounds(db, userId, [GUEST_PLAYGROUND]);
      await mergeGuestPlaygrounds(db, userId, [
        { ...GUEST_PLAYGROUND, files: { "pod.yaml": "kind: Pod\n" } },
      ]);

      const playgrounds = await readPlaygrounds(db, userId);
      expect(playgrounds).toHaveLength(1);
      expect(playgrounds[0]?.files).toEqual({ "pod.yaml": "kind: Pod\n" });
      expect(playgrounds[0]?.starred).toBe(true);

      const first = await createPlayground(db, userId, {
        clientId: "create-lab-client-0001",
        name: "created",
        templateId: "empty",
        files: {},
        description: "",
        starred: false,
        visibility: "private",
        activeFilePath: "",
        createdAt: 300,
        updatedAt: 300,
        lastOpenedAt: 300,
      });
      const retry = await createPlayground(db, userId, {
        clientId: "create-lab-client-0001",
        name: "created after retry",
        templateId: "empty",
        files: { "service.yaml": "kind: Service\n" },
        description: "",
        starred: false,
        visibility: "private",
        activeFilePath: "service.yaml",
        createdAt: 300,
        updatedAt: 400,
        lastOpenedAt: 400,
      });
      expect(retry.id).toBe(first.id);
      expect(await readPlaygrounds(db, userId)).toHaveLength(2);
    } finally {
      await client.close();
    }
  });

  it("scopes updates and deletes to the authenticated user", async () => {
    const { db, client } = await createTestDb();
    try {
      const a = await seedUser(db, "userA");
      const b = await seedUser(db, "userB");
      const playground = await createPlayground(db, a, {
        clientId: "owner-a-create-0001",
        name: "A only",
        templateId: "empty",
        files: {},
        description: "",
        starred: false,
        visibility: "private",
        activeFilePath: "",
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: 1,
      });

      expect(await updatePlayground(db, b, playground.id, { name: "stolen" })).toBeNull();
      expect(await openPlayground(db, b, playground.id)).toBeNull();
      expect(await duplicatePlayground(db, b, playground.id, "stolen-copy")).toBeNull();
      expect(await deletePlayground(db, b, playground.id)).toBe(false);
      expect((await readPlaygrounds(db, a))[0]?.name).toBe("A only");
    } finally {
      await client.close();
    }
  });

  it("duplicates a private independent copy and tracks recent opens", async () => {
    const { db, client } = await createTestDb();
    try {
      const userId = await seedUser(db);
      const source = await createPlayground(db, userId, {
        clientId: "duplicate-source-0001",
        name: "reference",
        templateId: "pod-service",
        files: { "pod.yaml": "kind: Pod\n" },
        description: "keep this context",
        starred: true,
        visibility: "link",
        activeFilePath: "pod.yaml",
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: 1,
      });

      const copy = await duplicatePlayground(db, userId, source.id, "duplicate-copy-0001");
      expect(copy).toMatchObject({
        name: "reference copy",
        files: source.files,
        description: "keep this context",
        starred: false,
        visibility: "private",
        activeFilePath: "pod.yaml",
      });
      expect(copy?.id).not.toBe(source.id);

      const opened = await openPlayground(db, userId, source.id);
      expect(opened?.lastOpenedAt).toBeGreaterThan(source.lastOpenedAt);
    } finally {
      await client.close();
    }
  });

  it("cascades playgrounds when the account is deleted", async () => {
    const { db, client } = await createTestDb();
    try {
      const userId = await seedUser(db);
      await mergeGuestPlaygrounds(db, userId, [GUEST_PLAYGROUND]);
      await db.delete(user).where(eq(user.id, userId));
      expect(await readPlaygrounds(db, userId)).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it("publishes a separate safe snapshot and forks it idempotently", async () => {
    const { db, client } = await createTestDb();
    try {
      const author = await seedUser(db, "author");
      const reader = await seedUser(db, "reader");
      const source = await createPlayground(db, author, {
        clientId: "publish-source-0001",
        name: "service selector repro",
        templateId: "pod-service",
        files: {
          "service.yaml": "apiVersion: v1\nkind: Service\nmetadata:\n  name: web\n",
        },
        description: "",
        starred: true,
        visibility: "private",
        activeFilePath: "service.yaml",
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: 1,
      });

      const result = await publishPlaygroundSnapshot(
        db,
        author,
        source.id,
        "Minimal broken selector reproduction",
      );
      expect(result.status).toBe("published");
      if (result.status !== "published") throw new Error("expected publication");
      expect(result.playground).toMatchObject({
        id: source.id,
        visibility: "private",
        description: "Minimal broken selector reproduction",
        forkCount: 0,
      });
      expect(result.playground.publishedCopyId).not.toBeNull();
      expect(await readPlaygrounds(db, author)).toHaveLength(1);
      expect(await readPublicPlaygrounds(db, 10)).toEqual([
        expect.objectContaining({
          id: result.playground.publishedCopyId,
          name: "service selector repro",
          fileCount: 1,
          forkCount: 0,
        }),
      ]);

      const publicationId = result.playground.publishedCopyId!;
      const firstFork = await forkPublicPlayground(db, reader, publicationId, "fork-request-0001");
      const retriedFork = await forkPublicPlayground(
        db,
        reader,
        publicationId,
        "fork-request-0001",
      );
      expect(firstFork?.id).toBe(retriedFork?.id);
      expect(firstFork).toMatchObject({ visibility: "private", forkedFromId: publicationId });
      expect((await readPublicPlaygrounds(db, 10))[0]?.forkCount).toBe(1);

      const unpublished = await unpublishPlaygroundSnapshot(db, author, source.id);
      expect(unpublished?.publishedCopyId).toBeNull();
      expect(await readPublicPlaygrounds(db, 10)).toEqual([]);
      expect(await forkPublicPlayground(db, reader, publicationId, "fork-request-0002")).toBeNull();
    } finally {
      await client.close();
    }
  });

  it("requires a public profile and blocks secret-bearing publications", async () => {
    const { db, client } = await createTestDb();
    try {
      const userId = await seedUser(db, "publisher");
      const source = await createPlayground(db, userId, {
        clientId: "unsafe-source-0001",
        name: "unsafe",
        templateId: "empty",
        files: {
          "secret.yaml":
            "apiVersion: v1\nkind: Secret\nmetadata:\n  name: credentials\nstringData:\n  token: real-token\n",
        },
        description: "",
        starred: false,
        visibility: "private",
        activeFilePath: "secret.yaml",
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: 1,
      });

      await db.update(user).set({ publicProfile: false }).where(eq(user.id, userId));
      expect(await publishPlaygroundSnapshot(db, userId, source.id, "")).toEqual({
        status: "profile-private",
      });
      await db.update(user).set({ publicProfile: true }).where(eq(user.id, userId));
      const unsafe = await publishPlaygroundSnapshot(db, userId, source.id, "");
      expect(unsafe.status).toBe("unsafe");
      if (unsafe.status === "unsafe") {
        expect(unsafe.issues[0]?.message).toContain("Secret");
      }
      expect(await readPublicPlaygrounds(db, 10)).toEqual([]);
    } finally {
      await client.close();
    }
  });
});
