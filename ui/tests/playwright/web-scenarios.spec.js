import { test } from "@playwright/test";
import { runScenarioAssertion } from "@aa/e2e";
test("settings scenario is executable through the shared Playwright helper", async ({ page }) => {
    await runScenarioAssertion(page, "settings-domain-wizard");
});
