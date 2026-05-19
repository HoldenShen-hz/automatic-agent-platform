/**
 * E2E Incident Drill Flow Tests
 *
 * End-to-end tests covering incident drill service lifecycle:
 * - Drill initialization with scenarios
 * - Drill start and progression
 * - Observation recording during drills
 * - Drill completion with scoring
 * - Drill cancellation
 */
import assert from "node:assert/strict";
import test from "node:test";
import { IncidentDrillService, PREDEFINED_SCENARIOS, } from "../../src/platform/control-plane/incident-control/runbook-executor/incident-drill-service.js";
import { RunbookExecutor } from "../../src/platform/control-plane/incident-control/runbook-executor/runbook-executor.js";
function createDrillService() {
    // IncidentDrillService stores the executor but doesn't call its methods in the tested scenarios
    // We pass a real executor instance to satisfy TypeScript
    const executor = new RunbookExecutor({ autoExecute: true });
    return new IncidentDrillService(executor);
}
function createCustomScenario(overrides = {}) {
    return {
        scenarioId: "custom_scenario",
        name: "Custom Test Scenario",
        description: "A custom scenario for testing",
        drillType: "functional",
        severity: "P2",
        injections: [],
        expectedResponseSteps: ["step1", "step2"],
        successCriteria: [],
        timeLimitSeconds: 300,
        ...overrides,
    };
}
test("E2E: incident drill service returns all predefined scenarios", () => {
    const service = createDrillService();
    const scenarios = service.getScenarios();
    assert.ok(scenarios.length > 0, "Should have predefined scenarios");
    assert.equal(scenarios, PREDEFINED_SCENARIOS, "Should return PREDEFINED_SCENARIOS");
});
test("E2E: incident drill service can get scenario by ID", () => {
    const service = createDrillService();
    const scenario = service.getScenario("worker_mass_disconnect_drill");
    assert.ok(scenario, "Should find scenario by ID");
    assert.equal(scenario?.scenarioId, "worker_mass_disconnect_drill");
    assert.equal(scenario?.drillType, "full_simulation");
    assert.equal(scenario?.severity, "P0");
});
test("E2E: incident drill service returns undefined for unknown scenario", () => {
    const service = createDrillService();
    const scenario = service.getScenario("unknown_scenario");
    assert.equal(scenario, undefined, "Should return undefined for unknown scenario");
});
test("E2E: incident drill can be initialized with predefined scenario", () => {
    const service = createDrillService();
    const scenario = service.getScenario("worker_mass_disconnect_drill");
    const drill = service.initializeDrill(scenario, ["operator-1", "operator-2"], "drill_initiator");
    assert.ok(drill.drillId, "Should have drill ID");
    assert.equal(drill.scenario.scenarioId, "worker_mass_disconnect_drill");
    assert.equal(drill.status, "initialized", "Status should be initialized");
    assert.deepEqual(drill.participants, ["operator-1", "operator-2"]);
    assert.equal(drill.startedAt.length > 0, true, "Should have startedAt timestamp");
    assert.equal(drill.completedAt, null, "Should not have completedAt yet");
    assert.equal(drill.durationMs, null, "Should not have duration yet");
    assert.equal(drill.overallScore, null, "Should not have score yet");
});
test("E2E: incident drill can be initialized with custom scenario", () => {
    const service = createDrillService();
    const customScenario = createCustomScenario({
        scenarioId: "custom_e2e_scenario",
        name: "Custom E2E Scenario",
        severity: "P1",
        drillType: "full_simulation",
    });
    const drill = service.initializeDrill(customScenario, ["test-user"], "e2e_test");
    assert.ok(drill.drillId, "Should have drill ID");
    assert.equal(drill.scenario.scenarioId, "custom_e2e_scenario");
    assert.equal(drill.scenario.severity, "P1");
    assert.equal(drill.scenario.drillType, "full_simulation");
});
test("E2E: initialized drill can be started", () => {
    const service = createDrillService();
    const scenario = service.getScenario("approval_channel_outage_drill");
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    const started = service.startDrill();
    assert.ok(started, "startDrill should return result");
    assert.equal(started?.status, "in_progress", "Status should be in_progress after start");
});
test("E2E: starting without initialized drill returns null", () => {
    const service = createDrillService();
    const result = service.startDrill();
    assert.equal(result, null, "Should return null when no drill is initialized");
});
test("E2E: starting already started drill returns null", () => {
    const service = createDrillService();
    const scenario = service.getScenario("cost_spike_drill");
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    service.startDrill();
    const secondStart = service.startDrill();
    assert.equal(secondStart, null, "Should return null when drill is already started");
});
test("E2E: observations can be recorded during in_progress drill", () => {
    const service = createDrillService();
    const scenario = service.getScenario("worker_mass_disconnect_drill");
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    service.startDrill();
    const obs1 = service.recordObservation("operator-1", "decision", "Identified root cause as network partition");
    const obs2 = service.recordObservation("operator-1", "action", "Initiated worker reconnect protocol", "good");
    const obs3 = service.recordObservation("operator-2", "timeline", "Response initiated within 2 minutes", "concern");
    assert.ok(obs1, "Should return observation");
    assert.equal(obs1?.observedBy, "operator-1", "Observer should match");
    assert.equal(obs1?.category, "decision", "Category should match");
    assert.equal(obs1?.description, "Identified root cause as network partition");
    assert.ok(obs2, "Should return second observation");
    assert.equal(obs2?.severity, "good", "Severity should be recorded");
    assert.ok(obs3, "Should return third observation");
    assert.equal(obs3?.severity, "concern", "Severity should be recorded");
    const current = service.getCurrentDrill();
    assert.equal(current?.observations.length, 3, "Should have 3 observations");
});
test("E2E: observations cannot be recorded when drill is not in_progress", () => {
    const service = createDrillService();
    const scenario = service.getScenario("cost_spike_drill");
    // Don't start the drill
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    const obs = service.recordObservation("operator-1", "action", "This should not work");
    assert.equal(obs, null, "Should return null when drill is not in_progress");
});
test("E2E: drill can be completed with issues and recommendations", () => {
    const service = createDrillService();
    const scenario = service.getScenario("approval_channel_outage_drill");
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    service.startDrill();
    service.recordObservation("operator-1", "action", "Switched to fallback channel", "good");
    const issues = ["Fallback channel had 30s delay", "Notification backlog accumulated"];
    const recommendations = ["Implement redundant notification system", "Add monitoring for fallback channel"];
    const criteriaResults = [
        { criterion: "Backlog stable", passed: true, notes: "Backlog cleared within 5 minutes" },
        { criterion: "No policy bypass", passed: true, actualValue: 0, threshold: 0, notes: "No bypass detected" },
    ];
    const completed = service.completeDrill(issues, recommendations, criteriaResults);
    assert.ok(completed, "Should return completed drill");
    assert.equal(completed?.status, "completed", "Status should be completed");
    assert.ok(completed?.completedAt, "Should have completedAt");
    assert.ok(completed?.durationMs != null && completed?.durationMs >= 0, "Should have duration");
    assert.deepEqual(completed?.issuesFound, issues, "Issues should be recorded");
    assert.deepEqual(completed?.recommendations, recommendations, "Recommendations should be recorded");
    assert.equal(completed?.overallScore, 100, "Should score 100% (all criteria passed)");
    assert.equal(completed?.observations.length, 1, "Should preserve observations");
    // Current drill should be null after completion
    assert.equal(service.getCurrentDrill(), null, "Current drill should be null after completion");
});
test("E2E: drill completion calculates score correctly with partial pass", () => {
    const service = createDrillService();
    const scenario = createCustomScenario({ successCriteria: [] });
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    service.startDrill();
    const criteriaResults = [
        { criterion: "Criterion 1", passed: true, notes: "Passed" },
        { criterion: "Criterion 2", passed: true, notes: "Passed" },
        { criterion: "Criterion 3", passed: false, notes: "Failed" },
        { criterion: "Criterion 4", passed: false, notes: "Failed" },
    ];
    const completed = service.completeDrill([], [], criteriaResults);
    assert.equal(completed?.overallScore, 50, "Should score 50% (2 of 4 passed)");
});
test("E2E: drill completion calculates score correctly with all fail", () => {
    const service = createDrillService();
    const scenario = createCustomScenario();
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    service.startDrill();
    const criteriaResults = [
        { criterion: "Only criterion", passed: false, notes: "Failed" },
    ];
    const completed = service.completeDrill([], [], criteriaResults);
    assert.equal(completed?.overallScore, 0, "Should score 0% when all criteria fail");
});
test("E2E: drill can be cancelled", () => {
    const service = createDrillService();
    const scenario = service.getScenario("cost_spike_drill");
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    service.startDrill();
    service.recordObservation("operator-1", "action", "Started drill");
    const cancelled = service.cancelDrill();
    assert.ok(cancelled, "Should return cancelled drill");
    assert.equal(cancelled?.status, "cancelled", "Status should be cancelled");
    assert.ok(cancelled?.completedAt, "Should have completedAt");
    assert.ok(cancelled?.durationMs != null && cancelled?.durationMs >= 0, "Should have duration");
    assert.equal(cancelled?.summary.includes("cancelled"), true, "Summary should mention cancellation");
    // Current drill should be null after cancellation
    assert.equal(service.getCurrentDrill(), null, "Current drill should be null after cancellation");
});
test("E2E: cancelling without initialized drill returns null", () => {
    const service = createDrillService();
    const result = service.cancelDrill();
    assert.equal(result, null, "Should return null when no drill is initialized");
});
test("E2E: runbook execution can be added to drill", () => {
    const service = createDrillService();
    const scenario = createCustomScenario();
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    service.startDrill();
    // Use type assertion since IncidentDrillService doesn't access execution internals
    const execution = {
        executionId: "exec-001",
        runbook: { runbookId: "rb-001", title: "Test", severity: "P2", sections: [], rawMarkdown: "", parsedAt: "" },
        status: "completed",
        sectionResults: [],
        outcome: "success",
        summary: "Test execution",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 150,
        executedBy: "test",
    };
    service.addRunbookExecution(execution);
    const current = service.getCurrentDrill();
    assert.equal(current?.runbookExecutions.length, 1, "Should have 1 runbook execution");
    assert.equal(current?.runbookExecutions[0]?.executionId, "exec-001", "Execution ID should match");
});
test("E2E: runbook execution added to completed drill is ignored", () => {
    const service = createDrillService();
    const scenario = createCustomScenario();
    service.initializeDrill(scenario, ["operator-1"], "initiator");
    service.startDrill();
    service.completeDrill([], [], []);
    // Use type assertion since IncidentDrillService doesn't access execution internals
    const execution = {
        executionId: "exec-002",
        runbook: { runbookId: "rb-002", title: "Test2", severity: "P2", sections: [], rawMarkdown: "", parsedAt: "" },
        status: "completed",
        sectionResults: [],
        outcome: "success",
        summary: "Test execution 2",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 150,
        executedBy: "test",
    };
    service.addRunbookExecution(execution);
    // Should not throw, but also not added
    const current = service.getCurrentDrill();
    assert.equal(current, null, "Current drill should be null");
});
test("E2E: drill report is generated correctly", () => {
    const service = createDrillService();
    const scenario = createCustomScenario({
        name: "Test Report Scenario",
        severity: "P1",
        drillType: "functional",
    });
    service.initializeDrill(scenario, ["operator-1", "operator-2"], "test-initiator");
    service.startDrill();
    service.recordObservation("operator-1", "decision", "Made a decision");
    service.recordObservation("operator-2", "action", "Took an action", "good");
    const criteriaResults = [
        { criterion: "Test criterion", passed: true, notes: "Passed" },
    ];
    const completed = service.completeDrill(["Issue 1", "Issue 2"], ["Recommendation 1"], criteriaResults);
    assert.ok(completed, "Should complete drill");
    const report = service.generateDrillReport(completed);
    assert.ok(report.includes("Incident Drill Report"), "Should include header");
    assert.ok(report.includes("Test Report Scenario"), "Should include scenario name");
    assert.ok(report.includes("P1"), "Should include severity");
    assert.ok(report.includes("operator-1"), "Should include participants");
    assert.ok(report.includes("operator-2"), "Should include second participant");
    assert.ok(report.includes("decision"), "Should include observation category");
    assert.ok(report.includes("Issue 1"), "Should include issues");
    assert.ok(report.includes("Recommendation 1"), "Should include recommendations");
    assert.ok(report.includes("Test criterion"), "Should include criteria");
});
test("E2E: tabletop drill type scenario can be initialized", () => {
    const service = createDrillService();
    const tabletopScenario = createCustomScenario({
        scenarioId: "tabletop_test",
        drillType: "tabletop",
        severity: "P3",
    });
    const drill = service.initializeDrill(tabletopScenario, ["participant-1"], "initiator");
    assert.equal(drill.scenario.drillType, "tabletop", "Drill type should be tabletop");
    assert.equal(drill.scenario.severity, "P3", "Severity should be P3");
});
test("E2E: full_simulation drill type scenario can be initialized", () => {
    const service = createDrillService();
    const simScenario = createCustomScenario({
        scenarioId: "fullsim_test",
        drillType: "full_simulation",
        severity: "P0",
    });
    const drill = service.initializeDrill(simScenario, ["participant-1"], "initiator");
    assert.equal(drill.scenario.drillType, "full_simulation", "Drill type should be full_simulation");
    assert.equal(drill.scenario.severity, "P0", "Severity should be P0");
});
test("E2E: multiple sequential drills can be run", () => {
    const service = createDrillService();
    // First drill
    const scenario1 = createCustomScenario({ scenarioId: "drill_1", name: "First Drill" });
    service.initializeDrill(scenario1, ["op-1"], "initiator");
    service.startDrill();
    const completed1 = service.completeDrill([], [], []);
    // Second drill
    const scenario2 = createCustomScenario({ scenarioId: "drill_2", name: "Second Drill" });
    service.initializeDrill(scenario2, ["op-2"], "initiator");
    service.startDrill();
    const completed2 = service.completeDrill([], [], []);
    assert.equal(completed1?.scenario.name, "First Drill", "First drill should have correct name");
    assert.equal(completed2?.scenario.name, "Second Drill", "Second drill should have correct name");
    assert.notEqual(completed1?.drillId, completed2?.drillId, "Drill IDs should be unique");
});
//# sourceMappingURL=incident-drill-flow.test.js.map