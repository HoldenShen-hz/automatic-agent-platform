import { test, expect, type Page } from "@playwright/test";

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
] as const;

export type E2EScenarioId = (typeof e2eScenarioCatalog)[number]["id"];

export function createScenarioChecklist() {
  return e2eScenarioCatalog.map((scenario) => ({
    scenario: scenario.id,
    route: scenario.route,
    expectedTitle: scenario.expectedTitle,
    status: "ready" as const,
  }));
}

export function findScenarioById(id: E2EScenarioId) {
  return e2eScenarioCatalog.find((scenario) => scenario.id === id) ?? null;
}

export interface PlaywrightScenarioDefinition {
  readonly id: E2EScenarioId;
  readonly url: string;
  readonly expectedTitle: string;
}

export function createPlaywrightScenarioDefinitions(baseUrl: string): readonly PlaywrightScenarioDefinition[] {
  return e2eScenarioCatalog.map((scenario) => ({
    id: scenario.id,
    url: new URL(scenario.route, baseUrl).toString(),
    expectedTitle: scenario.expectedTitle,
  }));
}

export async function runScenario(page: Page, scenario: PlaywrightScenarioDefinition): Promise<void> {
  await page.goto(scenario.url);
  await expect(page.getByRole("heading", { name: scenario.expectedTitle }).first()).toBeVisible();
}

export async function runScenarioAssertion(page: Page, id: E2EScenarioId): Promise<void> {
  const scenario = findScenarioById(id);
  if (scenario == null) {
    throw new Error(`Unknown E2E scenario: ${id}`);
  }
  await page.goto(scenario.route);
  await expect(page.getByRole("heading", { name: scenario.expectedTitle }).first()).toBeVisible();
}

export function registerSmokeSuite(baseUrl: string): void {
  const definitions = createPlaywrightScenarioDefinitions(baseUrl);
  test.describe("ui smoke scenarios", () => {
    for (const definition of definitions) {
      test(definition.id, async ({ page }) => {
        await runScenario(page, definition);
      });
    }
  });
}
