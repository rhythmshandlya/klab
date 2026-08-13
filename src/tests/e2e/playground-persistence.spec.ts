import { expect, test } from "@playwright/test";

test("autosaves, restores, finds, duplicates, and deletes a guest playground", async ({ page }) => {
  await page.goto("/playground/empty");
  const newPlayground = page.getByRole("button", { name: "New playground" });
  await expect(newPlayground).toBeEnabled();
  const newPlaygroundBox = await newPlayground.boundingBox();
  const searchBox = await page.getByRole("searchbox", { name: "Search playgrounds" }).boundingBox();
  expect(newPlaygroundBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(Math.abs(newPlaygroundBox!.width - newPlaygroundBox!.height)).toBeLessThan(1);
  expect(Math.abs(newPlaygroundBox!.y - searchBox!.y)).toBeLessThan(1);
  await expect(page.getByRole("button", { name: "+ ConfigMap" })).toBeVisible();
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

  await test.step("the command palette uses keyboard-searchable command items", async () => {
    await page.keyboard.press("Control+K");
    const palette = page.getByRole("dialog", { name: "Supported k8s commands" });
    await expect(palette).toBeVisible();
    await palette.getByPlaceholder("Search commands… (e.g. scale, rollout, exec)").fill("rollout");
    await expect(palette.getByText(/kubectl rollout status/).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
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

  await test.step("delete offers a five-second undo instead of inline confirmation", async () => {
    await page.getByRole("button", { name: "Delete persistence devtools check copy" }).click();
    await expect(page.getByText("Playground deleted", { exact: true })).toBeVisible();
    await expect(page.getByText("Sure?", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(
      page.getByRole("link", { name: /persistence devtools check copy/ }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete persistence devtools check copy" }).click();
    await expect(page).toHaveURL(/\/playground$/, { timeout: 10_000 });
  });
});
