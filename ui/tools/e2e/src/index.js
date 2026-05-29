import { test, expect } from "@playwright/test";
export const e2eScenarioCatalog = [
    {
        id: "login-callback",
        route: "/mission-control/dashboard",
        expectedTitle: "Dashboard",
    },
    {
        id: "dashboard-home",
        route: "/mission-control/dashboard",
        expectedTitle: "Dashboard",
    },
    {
        id: "task-five-level-drill",
        route: "/mission-control/tasks",
        expectedTitle: "Task Cockpit",
    },
    {
        id: "approval-review",
        route: "/mission-control/approvals",
        expectedTitle: "Approval Center",
    },
    {
        id: "hitl-intervention",
        route: "/extended/hitl",
        expectedTitle: "HITL",
    },
    {
        id: "nl-conversation",
        route: "/extended/conversation",
        expectedTitle: "NL Conversation",
    },
    {
        id: "settings-domain-wizard",
        route: "/shared/settings",
        expectedTitle: "Settings",
    },
];
export function createScenarioChecklist() {
    return e2eScenarioCatalog.map((scenario) => ({
        scenario: scenario.id,
        route: scenario.route,
        expectedTitle: scenario.expectedTitle,
        status: "ready",
    }));
}
export function findScenarioById(id) {
    return e2eScenarioCatalog.find((scenario) => scenario.id === id) ?? null;
}
export function createPlaywrightScenarioDefinitions(baseUrl) {
    return e2eScenarioCatalog.map((scenario) => ({
        id: scenario.id,
        url: new URL(scenario.route, baseUrl).toString(),
        expectedTitle: scenario.expectedTitle,
    }));
}
export async function runScenario(page, scenario) {
    await page.goto(scenario.url);
    await expect(page.getByRole("heading", { name: scenario.expectedTitle }).first()).toBeVisible();
}
export async function runScenarioAssertion(page, id) {
    const scenario = findScenarioById(id);
    if (scenario == null) {
        throw new Error(`Unknown E2E scenario: ${id}`);
    }
    await page.goto(scenario.route);
    await expect(page.getByRole("heading", { name: scenario.expectedTitle }).first()).toBeVisible();
}
export function registerSmokeSuite(baseUrl) {
    const definitions = createPlaywrightScenarioDefinitions(baseUrl);
    test.describe("ui smoke scenarios", () => {
        for (const definition of definitions) {
            test(definition.id, async ({ page }) => {
                await runScenario(page, definition);
            });
        }
    });
}
