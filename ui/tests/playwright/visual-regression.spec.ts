import { expect, test } from "@playwright/test";

async function prepareStableUi(page: import("@playwright/test").Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test("dashboard shell keeps a stable visual baseline", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await prepareStableUi(page);
  await expect(page.getByRole("heading", { name: "Automatic Agent Platform UI" })).toBeVisible();
  await expect(page.getByTestId("system-status-bar")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-shell.png", { fullPage: true });
});

test("approval center keeps a stable visual baseline", async ({ page }) => {
  await page.goto("/mission-control/approvals", { waitUntil: "networkidle" });
  await prepareStableUi(page);
  await expect(page.getByRole("heading", { name: "Approval Center" })).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page).toHaveScreenshot("approval-center.png", { fullPage: true });
});
