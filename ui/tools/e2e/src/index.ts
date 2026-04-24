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
