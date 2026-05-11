import { expect, test } from "@playwright/test";

test("dashboard shell keeps a stable visual baseline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Automatic Agent Platform UI")).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-shell.png", { fullPage: true });
});

test("approval center keeps a stable visual baseline", async ({ page }) => {
  await page.goto("/governance/approvals");
  await expect(page.getByText("Approval Center")).toBeVisible();
  await expect(page).toHaveScreenshot("approval-center.png", { fullPage: true });
});
