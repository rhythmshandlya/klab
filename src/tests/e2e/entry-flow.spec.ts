import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("visitors explicitly enter as a guest before opening the product", async ({ page }) => {
  await page.goto("/playground");

  await expect(page).toHaveURL(/\/?next=%2Fplayground$/);
  await expect(
    page.getByRole("heading", { name: "Learn Kubernetes by debugging real clusters, not slides." }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue as guest" })).toBeVisible();

  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL(/\/playground$/);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/problems$/);
});
