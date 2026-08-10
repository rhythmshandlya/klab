import { describe, expect, it } from "vitest";

import { createLab, deleteLab, mergeGuestLabs, readLabs, updateLab } from "@/lib/db/labs-repo";
import { user } from "@/lib/db/schema";
import type { SavedLab } from "@/lib/labs/contracts";
import { eq } from "drizzle-orm";

import { createTestDb, seedUser } from "./pglite";

const GUEST_LAB: SavedLab = {
  id: "guest-lab-1",
  name: "guest work",
  templateId: "deployment-service",
  files: { "deployment.yaml": "kind: Deployment\n" },
  createdAt: 100,
  updatedAt: 200,
};

describe("labs repository over pglite", () => {
  it("claims guest labs idempotently and updates a retried client mutation", async () => {
    const { db, client } = await createTestDb();
    try {
      const userId = await seedUser(db);
      await mergeGuestLabs(db, userId, [GUEST_LAB]);
      await mergeGuestLabs(db, userId, [{ ...GUEST_LAB, files: { "pod.yaml": "kind: Pod\n" } }]);

      const labs = await readLabs(db, userId);
      expect(labs).toHaveLength(1);
      expect(labs[0]?.files).toEqual({ "pod.yaml": "kind: Pod\n" });

      const first = await createLab(db, userId, {
        clientId: "create-lab-client-0001",
        name: "created",
        templateId: "empty",
        files: {},
        createdAt: 300,
        updatedAt: 300,
      });
      const retry = await createLab(db, userId, {
        clientId: "create-lab-client-0001",
        name: "created after retry",
        templateId: "empty",
        files: { "service.yaml": "kind: Service\n" },
        createdAt: 300,
        updatedAt: 400,
      });
      expect(retry.id).toBe(first.id);
      expect(await readLabs(db, userId)).toHaveLength(2);
    } finally {
      await client.close();
    }
  });

  it("scopes updates and deletes to the authenticated user", async () => {
    const { db, client } = await createTestDb();
    try {
      const a = await seedUser(db, "userA");
      const b = await seedUser(db, "userB");
      const lab = await createLab(db, a, {
        clientId: "owner-a-create-0001",
        name: "A only",
        templateId: "empty",
        files: {},
        createdAt: 1,
        updatedAt: 1,
      });

      expect(await updateLab(db, b, lab.id, { name: "stolen" })).toBeNull();
      expect(await deleteLab(db, b, lab.id)).toBe(false);
      expect((await readLabs(db, a))[0]?.name).toBe("A only");
    } finally {
      await client.close();
    }
  });

  it("cascades labs when the account is deleted", async () => {
    const { db, client } = await createTestDb();
    try {
      const userId = await seedUser(db);
      await mergeGuestLabs(db, userId, [GUEST_LAB]);
      await db.delete(user).where(eq(user.id, userId));
      expect(await readLabs(db, userId)).toEqual([]);
    } finally {
      await client.close();
    }
  });
});
