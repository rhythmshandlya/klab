import { expect, test } from "@playwright/test";

/**
 * Playground apply → observe E2E: open the Deployment + Service template, confirm its
 * pods appear, then add a Pod via the object shortcut, Apply, and observe it appear.
 * Asserts on stable facts (workload names in `kubectl get pods`) rather than the
 * ready-count, which reports with some lag in-browser. (Monaco text-editing → apply
 * is separately covered by the Problems E2E.)
 */
test("apply a manifest in the playground and observe the new pod", async ({ page }) => {
  await page.goto("/playground/deployment-service");

  await test.step("sandbox boots and the template's pods appear", async () => {
    await expect(page.getByText("Simulator ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    const terminal = page.locator(".xterm-helper-textarea");
    await terminal.click();
    await expect(async () => {
      await page.keyboard.type("kubectl get pods");
      await page.keyboard.press("Enter");
      await expect(page.locator(".xterm")).toContainText("webapp", { timeout: 4_000 });
    }).toPass({ timeout: 30_000 });
  });

  await test.step("add a Pod via the shortcut, apply, and observe it", async () => {
    await page.getByRole("button", { name: "+ Pod" }).click();
    await page.getByRole("button", { name: "Apply Manifests" }).click();

    const terminal = page.locator(".xterm-helper-textarea");
    await terminal.click();
    await expect(async () => {
      await page.keyboard.type("kubectl get pods");
      await page.keyboard.press("Enter");
      await expect(page.locator(".xterm")).toContainText("my-pod", { timeout: 4_000 });
    }).toPass({ timeout: 45_000 });
  });
});

test("many manifest tabs keep the add control pinned without vertical overflow", async ({
  page,
}) => {
  await page.goto("/playground/deployment-service");

  const addFile = page.getByRole("button", { name: "Add file" });
  const tabs = page.getByRole("tablist", { name: "Manifest files" });
  const manifestTabs = tabs.getByRole("tab");
  await expect(addFile).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "deployment.yaml" })).toBeVisible();

  // Let the first edit finish turning the template into an autosaved Playground before
  // stress-testing the tab strip; otherwise route replacement can race synthetic clicks.
  await addFile.click();
  await expect(page).toHaveURL(/\/playground\/p\/[a-z0-9-]+$/);
  await expect(tabs.getByRole("tab", { name: "resource-3.yaml" })).toBeVisible();

  let tabCount = await manifestTabs.count();
  for (let index = 0; index < 8; index += 1) {
    await addFile.click();
    tabCount += 1;
    await expect(manifestTabs).toHaveCount(tabCount);
  }

  await expect(page.getByRole("tab", { name: "resource-11.yaml" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(addFile).toBeVisible();
  await expect
    .poll(() => tabs.evaluate((element) => getComputedStyle(element).overflowY))
    .toBe("hidden");
  expect(await tabs.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  expect(
    await tabs.evaluate((element) => element.querySelector('[aria-label="Add file"]') === null),
  ).toBe(true);

  await page.getByRole("tab", { name: "resource-11.yaml" }).dblclick();
  const renameInput = page.getByRole("textbox", { name: "New name for resource-11.yaml" });
  await renameInput.fill("config-map.yaml");
  await renameInput.press("Enter");
  await expect(page.getByRole("tab", { name: "config-map.yaml" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByRole("button", { name: "Close config-map.yaml" }).click();
  await expect(page.getByText("Deleted config-map.yaml", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("tab", { name: "config-map.yaml" })).toBeVisible();
});

test("playground header reflows without hiding identity or primary actions", async ({ page }) => {
  await page.setViewportSize({ width: 2200, height: 1000 });
  await page.goto("/playground/deployment-service");

  await page.getByRole("button", { name: "Add file" }).click();
  await expect(page).toHaveURL(/\/playground\/p\/[a-z0-9-]+$/);

  const title = page.getByRole("textbox", { name: "Playground name" });
  const saved = page.getByRole("status").filter({ hasText: "Saved" }).first();
  const secondary = page.getByRole("toolbar", { name: "Secondary playground actions" });
  const primary = page.getByRole("toolbar", { name: "Primary playground actions" });
  const header = page.getByTestId("playground-editor-header");

  await expect(saved).toBeVisible();
  await expect(primary.getByRole("button", { name: "Apply manifests" })).toBeVisible();
  await expect(primary.getByRole("button", { name: /Star|Unstar/ })).toBeVisible();

  const centerY = async (locator: typeof title) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    return box!.y + box!.height / 2;
  };

  const wideRows = await Promise.all([title, saved, secondary, primary].map(centerY));
  expect(Math.max(...wideRows) - Math.min(...wideRows)).toBeLessThan(6);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => (await header.boundingBox())?.height ?? 0).toBeGreaterThan(55);

  const narrowTitleRow = await Promise.all([title, saved].map(centerY));
  const narrowActionRow = await Promise.all([secondary, primary].map(centerY));
  expect(Math.abs(narrowTitleRow[0]! - narrowTitleRow[1]!)).toBeLessThan(6);
  expect(Math.abs(narrowActionRow[0]! - narrowActionRow[1]!)).toBeLessThan(6);
  expect(narrowActionRow[0]!).toBeGreaterThan(narrowTitleRow[0]! + 12);

  const topologyHandle = page.getByRole("separator", { name: "Resize topology" });
  await expect(topologyHandle).toBeVisible();
  const beforeDrag = await topologyHandle.boundingBox();
  expect(beforeDrag).not.toBeNull();
  await page.mouse.move(beforeDrag!.x + beforeDrag!.width / 2, beforeDrag!.y + 2);
  await page.mouse.down();
  await page.mouse.move(beforeDrag!.x + beforeDrag!.width / 2, beforeDrag!.y - 70, {
    steps: 5,
  });
  await page.mouse.up();
  const afterDrag = await topologyHandle.boundingBox();
  expect(afterDrag).not.toBeNull();
  expect(beforeDrag!.y - afterDrag!.y).toBeGreaterThan(40);

  const topologyBody = await page.getByTestId("playground-topology-body").boundingBox();
  const topologyCanvas = await page.locator(".react-flow").first().boundingBox();
  expect(topologyBody).not.toBeNull();
  expect(topologyCanvas).not.toBeNull();
  expect(Math.abs(topologyBody!.x - topologyCanvas!.x)).toBeLessThan(2);
  expect(Math.abs(topologyBody!.width - topologyCanvas!.width)).toBeLessThan(2);
});
