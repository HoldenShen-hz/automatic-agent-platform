/**
 * Unit tests for Runbook Executor - State Transitions and Edge Cases
 * Tests runbook execution state machine, step handling, and edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RunbookExecutor,
  IncidentDrillService,
  parseRunbookMarkdown,
} from "../../../../../../src/platform/control-plane/incident-control/runbook-executor/index.js";
import type { RunbookSection, RunbookStep, RunbookExecutionResult } from "../../../../../../src/platform/control-plane/incident-control/runbook-executor/index.js";

test("RunbookExecutor parse handles backtick commands as requiring confirmation", () => {
  const markdown = `# Test Runbook

## Mitigation

1. Check status
\`kubectl rollout status\`
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);

  const backtickStep = mitigation.steps.find((s: RunbookStep) => s.command.includes("kubectl"));
  assert.ok(backtickStep);
  assert.equal(backtickStep.requiresConfirmation, true);
});

test("RunbookExecutor parse handles CLI commands as requiring confirmation", () => {
  const markdown = `# Test Runbook

## Mitigation

1. Check status
kubectl rollout status
`;
  const runbook = parseRunbookMarkdown(markdown);

  const mitigation = runbook.sections.find((s: RunbookSection) => s.name === "Mitigation");
  assert.ok(mitigation);

  const cliStep = mitigation.steps.find((s: RunbookStep) => s.command.includes("kubectl"));
  assert.ok(cliStep);
  assert.equal(cliStep.requiresConfirmation, true);
});

test("RunbookExecutor parse handles bullet points with fallback numbering", () => {
  const markdown = `# Test Runbook

## Symptoms

- First symptom
- Second symptom
- Third symptom
`;
  const runbook = parseRunbookMarkdown(markdown);

  const symptoms = runbook.sections.find((s: RunbookSection) => s.name === "Symptoms");
  assert.ok(symptoms);
  assert.equal(symptoms.steps.length, 3);
  assert.equal(symptoms.steps[0]!.stepNumber, 1);
  assert.equal(symptoms.steps[1]!.stepNumber, 2);
  assert.equal(symptoms.steps[2]!.stepNumber, 3);
});

test("RunbookExecutor parse handles checkbox items", () => {
  const markdown = `# Test Runbook

## Verification

[ ] Verify system is up
[x] Verify service is running
[ ] Verify no errors
`;
  const runbook = parseRunbookMarkdown(markdown);

  const verification = runbook.sections.find((s: RunbookSection) => s.name === "Verification");
  assert.ok(verification);
  assert.equal(verification.steps.length, 3);
});

test("RunbookExecutor parse handles non-executable sections", () => {
  const markdown = `# Test Runbook

## Background

Some background information.

## Diagnosis

1. Check something
`;
  const runbook = parseRunbookMarkdown(markdown);

  const background = runbook.sections.find((s: RunbookSection) => s.name === "Background");
  assert.ok(background);
  assert.equal(background.isExecutable, false);

  const diagnosis = runbook.sections.find((s: RunbookSection) => s.name === "Diagnosis");
  assert.ok(diagnosis);
  assert.equal(diagnosis.isExecutable, true);
});

test("RunbookExecutor initializeExecution creates correct section results", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown(`# Test Runbook

## Diagnosis

1. Step one
2. Step two

## Mitigation

1. Mitigate one

## Background

Some text
`);

  const execution = executor.initializeExecution(runbook, "test-user");

  // Only executable sections should have results
  assert.ok(execution.sectionResults.length >= 2);

  const diagnosis = execution.sectionResults.find((s) => s.sectionName === "Diagnosis");
  assert.ok(diagnosis);
  assert.equal(diagnosis.status, "initialized");

  const background = execution.sectionResults.find((s) => s.sectionName === "Background");
  assert.equal(background, undefined); // Not executable, no result
});

test("RunbookExecutor getCurrentExecution returns current execution", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. Test");

  executor.initializeExecution(runbook, "test-user");

  const current = executor.getCurrentExecution();
  assert.ok(current);
  assert.equal(current.status, "initialized");
});

test("RunbookExecutor getCurrentExecution returns null when no execution", () => {
  const executor = new RunbookExecutor();

  const current = executor.getCurrentExecution();
  assert.equal(current, null);
});

test("RunbookExecutor getPendingConfirmations returns empty when no pending", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. kubectl status");

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  await executor.executeStep(execution.executionId, "Mitigation", 0);

  const pending = executor.getPendingConfirmations();
  assert.deepEqual(pending, []);
});

test("RunbookExecutor executeStep returns null for wrong executionId", async () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. Step");

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  const result = await executor.executeStep("wrong-execution-id", "Mitigation", 0);
  assert.equal(result, null);
});

test("RunbookExecutor executeStep returns null for wrong section name", async () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. Step");

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  const result = await executor.executeStep(execution.executionId, "WrongSection", 0);
  assert.equal(result, null);
});

test("RunbookExecutor executeStep returns null for out of bounds step index", async () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. Step");

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  const result = await executor.executeStep(execution.executionId, "Mitigation", 99);
  assert.equal(result, null);
});

test("RunbookExecutor confirmStep returns null when not in requires_confirmation status", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. kubectl status");

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  // Execute the step - it should complete since autoExecute is true
  executor.executeStep(execution.executionId, "Mitigation", 0);

  // Confirm should return null since step is already completed
  const result = executor.confirmStep(execution.executionId, 0);
  assert.equal(result, null);
});

test("RunbookExecutor skipStep returns null for wrong executionId", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. Step");

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  const result = executor.skipStep("wrong-id", "Mitigation", 0);
  assert.equal(result, null);
});

test("RunbookExecutor skipStep returns null for wrong section", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. Step");

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  const result = executor.skipStep(execution.executionId, "WrongSection", 0);
  assert.equal(result, null);
});

test("RunbookExecutor abort returns null for wrong executionId", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. Step");

  executor.initializeExecution(runbook, "test-user");

  const result = executor.abort("wrong-id");
  assert.equal(result, null);
});

test("RunbookExecutor abort marks execution as aborted", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n\n1. Step");

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  const result = executor.abort(execution.executionId);

  assert.ok(result);
  assert.equal(result.status, "aborted");
  assert.equal(result.outcome, "aborted");
  assert.ok(result.completedAt);
  assert.ok(result.totalDurationMs !== null);
});

test("RunbookExecutor completes execution when all sections done", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = parseRunbookMarkdown(`# Test Runbook

## Mitigation

1. First step
2. Second step
`);

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  // Execute all steps
  await executor.executeStep(execution.executionId, "Mitigation", 0);
  await executor.executeStep(execution.executionId, "Mitigation", 1);

  const completed = executor.getCurrentExecution();
  assert.ok(completed);
  assert.equal(completed.status, "completed");
  assert.equal(completed.outcome, "success");
});

test("RunbookExecutor handles failed outcome when continueOnFailure is false", async () => {
  const executor = new RunbookExecutor({ autoExecute: true, continueOnFailure: false });
  const runbook = parseRunbookMarkdown(`# Test Runbook

## Mitigation

1. Step one
2. kubectl fail-command
3. Step three
`);

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  // Execute first step - should succeed
  await executor.executeStep(execution.executionId, "Mitigation", 0);

  // Execute second step - simulated failure
  const failedStep = await executor.executeStep(execution.executionId, "Mitigation", 1, { success: false, output: "Command failed" });

  // Check the execution is now failed
  const current = executor.getCurrentExecution();
  assert.ok(current);
  assert.equal(current.status, "failed");
  assert.ok(failedStep !== null);
  assert.equal(failedStep!.status, "failed");
});

test("RunbookExecutor handles partial outcome when continueOnFailure is true", async () => {
  const executor = new RunbookExecutor({ autoExecute: true, continueOnFailure: true });
  const runbook = parseRunbookMarkdown(`# Test Runbook

## Mitigation

1. First step
2. kubectl fail-command
`);

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  // Execute first step - should succeed
  await executor.executeStep(execution.executionId, "Mitigation", 0);

  // Execute second step - simulated failure
  await executor.executeStep(execution.executionId, "Mitigation", 1, { success: false, output: "Command failed" });

  const current = executor.getCurrentExecution();
  assert.ok(current);
  assert.equal(current.status, "failed");
  assert.equal(current.outcome, "partial");
});

test("RunbookExecutor generateExecutionReport formats report correctly", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = parseRunbookMarkdown(`# Critical P0 Runbook

## Mitigation

1. kubectl rollout undo
`);

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;
  await executor.executeStep(execution.executionId, "Mitigation", 0);

  const report = executor.generateExecutionReport(execution);

  assert.ok(report.includes("Runbook Execution Report"));
  assert.ok(report.includes("Critical P0 Runbook"));
  assert.ok(report.includes("P0"));
  assert.ok(report.includes("Mitigation"));
  assert.ok(report.includes("test-user"));
});

test("RunbookExecutor generateExecutionReport shows step results", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = parseRunbookMarkdown(`# Test Runbook

## Mitigation

1. Check status
2. Apply fix
`);

  executor.initializeExecution(runbook, "test-user");
  const execution = executor.getCurrentExecution()!;

  await executor.executeStep(execution.executionId, "Mitigation", 0);
  await executor.executeStep(execution.executionId, "Mitigation", 1);

  const report = executor.generateExecutionReport(execution);

  assert.ok(report.includes("Check status"));
  assert.ok(report.includes("Apply fix"));
  assert.ok(report.includes("2/2")); // Completed steps count
});

test("parseRunbookMarkdown handles lines without recognized step patterns", () => {
  const markdown = `# Test Runbook

## Notes

This is just some freeform text that should not be treated as a step.
Some more descriptive text here.

## Mitigation

1. Real step
`;
  const runbook = parseRunbookMarkdown(markdown);

  const notes = runbook.sections.find((s: RunbookSection) => s.name === "Notes");
  assert.ok(notes);
  assert.equal(notes.steps.length, 0);
});

test("parseRunbookMarkdown handles numbered steps with parentheses", () => {
  const markdown = `# Test Runbook

## Diagnosis

1) Check first item
2) Check second item
`;
  const runbook = parseRunbookMarkdown(markdown);

  const diagnosis = runbook.sections.find((s: RunbookSection) => s.name === "Diagnosis");
  assert.ok(diagnosis);
  assert.equal(diagnosis.steps.length, 2);
  assert.equal(diagnosis.steps[0]!.command, "Check first item");
  assert.equal(diagnosis.steps[1]!.command, "Check second item");
});

test("IncidentDrillService getScenario returns undefined for unknown", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("unknown-scenario-id");

  assert.equal(scenario, undefined);
});

test("IncidentDrillService startDrill returns null when no drill initialized", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const result = drillService.startDrill();

  assert.equal(result, null);
});

test("IncidentDrillService startDrill returns null when drill not in initialized state", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "initiator");
  drillService.startDrill();

  // Try to start again
  const result = drillService.startDrill();

  assert.equal(result, null);
});

test("IncidentDrillService recordObservation returns null when no drill", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const result = drillService.recordObservation("operator-1", "decision", "Some observation");

  assert.equal(result, null);
});

test("IncidentDrillService recordObservation returns null when drill not in progress", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "initiator");
  // Not started

  const result = drillService.recordObservation("operator-1", "decision", "Some observation");

  assert.equal(result, null);
});

test("IncidentDrillService recordObservation creates observation with all fields", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "initiator");
  drillService.startDrill();

  const observation = drillService.recordObservation(
    "operator-1",
    "decision",
    "Correct root cause identified",
    "good",
  );

  assert.ok(observation);
  assert.equal(observation!.observedBy, "operator-1");
  assert.equal(observation!.category, "decision");
  assert.equal(observation!.description, "Correct root cause identified");
  assert.equal(observation!.severity, "good");
  assert.ok(observation!.observationId);
  assert.ok(observation!.timestamp);
});

test("IncidentDrillService completeDrill returns null when no drill", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const result = drillService.completeDrill([], [], []);

  assert.equal(result, null);
});

test("IncidentDrillService completeDrill generates score from criteria", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "initiator");
  drillService.startDrill();

  const criteriaResults = [
    { criterion: "Test 1", passed: true, notes: "Passed" },
    { criterion: "Test 2", passed: true, notes: "Passed" },
    { criterion: "Test 3", passed: false, notes: "Failed" },
    { criterion: "Test 4", passed: false, notes: "Failed" },
  ];

  const result = drillService.completeDrill([], [], criteriaResults);

  assert.ok(result);
  assert.equal(result!.overallScore, 50); // 2/4 = 50%
});

test("IncidentDrillService completeDrill with no criteria returns 0 score", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "initiator");
  drillService.startDrill();

  const result = drillService.completeDrill([], [], []);

  assert.ok(result);
  assert.equal(result!.overallScore, 0);
});

test("IncidentDrillService cancelDrill returns null when no drill", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const result = drillService.cancelDrill();

  assert.equal(result, null);
});

test("IncidentDrillService cancelDrill clears current drill", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "initiator");
  drillService.startDrill();

  const result = drillService.cancelDrill();

  assert.ok(result);
  assert.equal(result!.status, "cancelled");
  assert.ok(result!.durationMs !== null);

  // Current drill should be null
  assert.equal(drillService.getCurrentDrill(), null);
});

test("IncidentDrillService addRunbookExecution adds to current drill", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "initiator");

  const runbook = parseRunbookMarkdown("# Test Runbook\n\n## Mitigation\n\n1. Step");
  const execution = executor.initializeExecution(runbook, "test-user");

  drillService.addRunbookExecution(execution);

  const current = drillService.getCurrentDrill();
  assert.ok(current);
  assert.equal(current!.runbookExecutions.length, 1);
});

test("IncidentDrillService generateDrillReport formats correctly", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1", "operator-2"], "initiator");
  drillService.startDrill();
  drillService.recordObservation("operator-1", "timeline", "Alert received", "good");

  const result = drillService.completeDrill(
    ["Detection time could be improved"],
    ["Add more monitoring alerts"],
    [{ criterion: "Detection", passed: true, notes: "OK" }],
  );

  const report = drillService.generateDrillReport(result!);

  assert.ok(report.includes("Incident Drill Report"));
  assert.ok(report.includes("Worker Mass Disconnect"));
  assert.ok(report.includes("P0"));
  assert.ok(report.includes("full_simulation"));
  assert.ok(report.includes("operator-1"));
  assert.ok(report.includes("operator-2"));
  assert.ok(report.includes("Alert received"));
  assert.ok(report.includes("Detection time could be improved"));
  assert.ok(report.includes("Add more monitoring alerts"));
});

test("IncidentDrillService generateDrillReport handles observations with different severities", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "initiator");
  drillService.startDrill();
  drillService.recordObservation("operator-1", "decision", "Good decision", "good");
  drillService.recordObservation("operator-1", "action", "Could have been better", "concern");
  drillService.recordObservation("operator-1", "escalation", "Missed escalation", "critical");

  const result = drillService.completeDrill([], [], []);

  const report = drillService.generateDrillReport(result!);

  assert.ok(report.includes("Good decision"));
  assert.ok(report.includes("Could have been better"));
  assert.ok(report.includes("Missed escalation"));
});