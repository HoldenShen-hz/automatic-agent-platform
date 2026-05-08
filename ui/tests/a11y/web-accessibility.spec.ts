import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("web shell has no WCAG A/AA axe violations on the landing route", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Automatic Agent Platform UI" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
