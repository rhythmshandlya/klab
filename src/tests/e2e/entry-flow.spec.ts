import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("visitors explicitly enter as a guest before opening the product", async ({ page }) => {
  await page.goto("/playground");

  await expect(page).toHaveURL(/\/?next=%2Fplayground$/);
  await expect(
    page.getByRole("heading", { name: "Learn production Kubernetes by fixing what breaks." }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try as guest" })).toBeVisible();
  const landingNav = page.getByRole("navigation", { name: "Landing page" });
  await expect(landingNav.getByText("Blogs", { exact: true })).toHaveAttribute(
    "title",
    "Blogs coming soon",
  );
  await expect(landingNav.getByRole("link", { name: "Product" })).toHaveCount(0);
  await expect(landingNav.getByRole("link", { name: "Simulator" })).toHaveCount(0);
  await expect(landingNav.getByRole("link", { name: "Community" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Everything connects." })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kubernetes behavior, simulated in your browser." }),
  ).toBeVisible();
  await expect(page.getByText(/not a hidden remote cluster/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Break a cluster. Fix it. Remember why." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue as guest" })).toBeVisible();
  await expect(page.getByText("Pick your path")).toHaveCount(0);

  await page.getByRole("button", { name: "Try as guest" }).click();
  await expect(page).toHaveURL(/\/playground$/);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/problems$/);

  await page.getByRole("button", { name: "Guest menu" }).click();
  await page.getByRole("menuitem", { name: "Exit guest mode" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Learn production Kubernetes by fixing what breaks." }),
  ).toBeVisible();
});
