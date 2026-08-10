import { expect, test } from "@playwright/test";

test("advanced problems are available without completing prerequisites", async ({ page }) => {
  await page.goto("/problems/zombie-replicaset");

  await expect(page.getByRole("heading", { name: "Zombie ReplicaSet" })).toBeVisible();
  await expect(page.getByText("Zombie ReplicaSet is locked", { exact: true })).toHaveCount(0);
});
