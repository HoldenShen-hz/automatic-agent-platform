import { type Page } from "@playwright/test";
export declare const e2eScenarioCatalog: readonly [{
    readonly id: "login-callback";
    readonly route: "/mission-control/dashboard";
    readonly expectedTitle: "Dashboard";
}, {
    readonly id: "dashboard-home";
    readonly route: "/mission-control/dashboard";
    readonly expectedTitle: "Dashboard";
}, {
    readonly id: "task-five-level-drill";
    readonly route: "/mission-control/tasks";
    readonly expectedTitle: "Task Cockpit";
}, {
    readonly id: "approval-review";
    readonly route: "/mission-control/approvals";
    readonly expectedTitle: "Approval Center";
}, {
    readonly id: "hitl-intervention";
    readonly route: "/extended/hitl";
    readonly expectedTitle: "HITL";
}, {
    readonly id: "nl-conversation";
    readonly route: "/extended/conversation";
    readonly expectedTitle: "NL Conversation";
}, {
    readonly id: "settings-domain-wizard";
    readonly route: "/shared/settings";
    readonly expectedTitle: "Settings";
}];
export type E2EScenarioId = (typeof e2eScenarioCatalog)[number]["id"];
export declare function createScenarioChecklist(): {
    scenario: "login-callback" | "dashboard-home" | "task-five-level-drill" | "approval-review" | "hitl-intervention" | "nl-conversation" | "settings-domain-wizard";
    route: "/mission-control/dashboard" | "/mission-control/approvals" | "/extended/hitl" | "/shared/settings" | "/mission-control/tasks" | "/extended/conversation";
    expectedTitle: "Dashboard" | "Settings" | "Approval Center" | "NL Conversation" | "HITL" | "Task Cockpit";
    status: "ready";
}[];
export declare function findScenarioById(id: E2EScenarioId): {
    readonly id: "login-callback";
    readonly route: "/mission-control/dashboard";
    readonly expectedTitle: "Dashboard";
} | {
    readonly id: "dashboard-home";
    readonly route: "/mission-control/dashboard";
    readonly expectedTitle: "Dashboard";
} | {
    readonly id: "task-five-level-drill";
    readonly route: "/mission-control/tasks";
    readonly expectedTitle: "Task Cockpit";
} | {
    readonly id: "approval-review";
    readonly route: "/mission-control/approvals";
    readonly expectedTitle: "Approval Center";
} | {
    readonly id: "hitl-intervention";
    readonly route: "/extended/hitl";
    readonly expectedTitle: "HITL";
} | {
    readonly id: "nl-conversation";
    readonly route: "/extended/conversation";
    readonly expectedTitle: "NL Conversation";
} | {
    readonly id: "settings-domain-wizard";
    readonly route: "/shared/settings";
    readonly expectedTitle: "Settings";
} | null;
export interface PlaywrightScenarioDefinition {
    readonly id: E2EScenarioId;
    readonly url: string;
    readonly expectedTitle: string;
}
export declare function createPlaywrightScenarioDefinitions(baseUrl: string): readonly PlaywrightScenarioDefinition[];
export declare function runScenario(page: Page, scenario: PlaywrightScenarioDefinition): Promise<void>;
export declare function runScenarioAssertion(page: Page, id: E2EScenarioId): Promise<void>;
export declare function registerSmokeSuite(baseUrl: string): void;
