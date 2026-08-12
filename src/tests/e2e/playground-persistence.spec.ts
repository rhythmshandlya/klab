import { expect, test } from "@playwright/test";

test("autosaves, restores, finds, duplicates, and deletes a guest playground", async ({ page }) => {
  await page.goto("/playground/empty");
  await expect(page.getByRole("button", { name: "New Playground" })).toBeEnabled();
  await expect(page.getByText("Simulator ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  });

  await test.step("the first edit creates an autosaved playground", async () => {
    await page.getByRole("button", { name: "+ Pod" }).click();
    await expect(page).toHaveURL(/\/playground\/p\/[a-z0-9-]+$/);
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  });

  await test.step("publishing is gated behind an account", async () => {
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  });

  await test.step("inline rename and star persist", async () => {
    const title = page.getByRole("textbox", { name: "Playground name" });
    await title.fill("persistence devtools check");
    await title.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.getByRole("button", { name: "Star", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unstar", exact: true })).toBeVisible();
    await expect(page.getByText("Starred", { exact: true })).toBeVisible();
  });

  await test.step("reload restores files and their simulated cluster state", async () => {
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Playground name" })).toHaveValue(
      "persistence devtools check",
    );
    await expect(page.getByText("Simulator ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    const terminal = page.locator(".xterm-helper-textarea");
    await terminal.click();
    await page.keyboard.type("kubectl get pods");
    await page.keyboard.press("Enter");
    await expect(page.locator(".xterm")).toContainText("my-pod", { timeout: 30_000 });
  });

  await test.step("search finds it and duplicate creates an independent copy", async () => {
    const search = page.getByRole("searchbox", { name: "Search playgrounds" });
    await search.fill("devtools");
    await expect(page.getByRole("link", { name: /persistence devtools check/ })).toBeVisible();
    await search.fill("");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Playground name" })).toHaveValue(
      "persistence devtools check copy",
    );
  });

  await test.step("delete removes the current copy and returns to a clean workspace", async () => {
    await page.getByRole("button", { name: "Delete persistence devtools check copy" }).click();
    await page
      .getByRole("button", { name: "Confirm delete persistence devtools check copy" })
      .click();
    await expect(page).toHaveURL(/\/playground$/);
  });
});
