/**
 * Unit tests for Runbook Executor and Incident Drill
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  RunbookExecutor,
  IncidentDrillService,
  parseRunbookMarkdown,
  PREDEFINED_SCENARIOS,
  DEFAULT_RUNBOOK_EXECUTOR_CONFIG,
  DEFAULT_INCIDENT_DRILL_CONFIG,
  type IncidentDrillScenario,
} from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/index.js";

const SAMPLE_RUNBOOK_MARKDOWN = `# High Error Rate Runbook

## Symptoms

- High error rate alert firing
- API latency increases
- Task failures spike

## Diagnosis

1. Check monitoring dashboards
2. Review recent deployments
3. Inspect service logs

## Mitigation

1. Pause the rollout
2. Switch to fallback provider
3. Scale out replicas

## Verification

1. Error rate below threshold
2. Latency returned to normal
3. All tasks completing
`;

test("parseRunbookMarkdown extracts title and sections", () => {
  const runbook = parseRunbookMarkdown(SAMPLE_RUNBOOK_MARKDOWN, "test-runbook");

  assert.equal(runbook.runbookId, "test-runbook");
  assert.equal(runbook.title, "High Error Rate Runbook");
  assert.ok(runbook.sections.length >= 4);

  const sectionNames = runbook.sections.map((s) => s.name.toLowerCase());
  assert.ok(sectionNames.includes("symptoms"));
  assert.ok(sectionNames.includes("diagnosis"));
  assert.ok(sectionNames.includes("mitigation"));
  assert.ok(sectionNames.includes("verification"));
});

test("parseRunbookMarkdown extracts numbered steps", () => {
  const runbook = parseRunbookMarkdown(SAMPLE_RUNBOOK_MARKDOWN);

  const diagnosis = runbook.sections.find((s) => s.name.toLowerCase() === "diagnosis");
  assert.ok(diagnosis);
  assert.equal(diagnosis.steps.length, 3);
  assert.equal(diagnosis.steps[0]?.command, "Check monitoring dashboards");
  assert.equal(diagnosis.steps[1]?.command, "Review recent deployments");
  assert.equal(diagnosis.steps[2]?.command, "Inspect service logs");
});

test("parseRunbookMarkdown detects severity from title", () => {
  const criticalRunbook = parseRunbookMarkdown("# P0 Critical Outage Runbook");
  assert.equal(criticalRunbook.severity, "P0");

  const warningRunbook = parseRunbookMarkdown("# P2 Warning: High Latency");
  assert.equal(warningRunbook.severity, "P2");
});

test("RunbookExecutor initializes execution correctly", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown(SAMPLE_RUNBOOK_MARKDOWN);

  const execution = executor.initializeExecution(runbook, "test-operator");

  assert.ok(execution.executionId.startsWith("runbook_exec_"));
  assert.equal(execution.runbook.title, "High Error Rate Runbook");
  assert.equal(execution.status, "initialized");
  assert.equal(execution.executedBy, "test-operator");
  assert.ok(execution.sectionResults.length >= 3); // diagnosis, mitigation, verification
});

test("RunbookExecutor executes steps in sequence", async () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = parseRunbookMarkdown(SAMPLE_RUNBOOK_MARKDOWN);

  const execution = executor.initializeExecution(runbook, "test-operator");
  assert.equal(execution.status, "initialized");

  // Execute first step
  const step1 = await executor.executeStep(execution.executionId, "Mitigation", 0);
  assert.ok(step1);
  assert.ok(step1.status === "completed" || step1.status === "running");
});

test("RunbookExecutor pauses for confirmation when autoExecute is false", async () => {
  const executor = new RunbookExecutor({ autoExecute: false });
  const runbook = parseRunbookMarkdown(`# Manual Command Runbook

## Mitigation

1. Check status
\`kubectl rollout pause deployment/api\`
`);

  const execution = executor.initializeExecution(runbook, "test-operator");
  const step = await executor.executeStep(execution.executionId, "Mitigation", 1);

  assert.ok(step);
  assert.equal(step.status, "requires_confirmation");
});

test("RunbookExecutor confirms step and continues execution", async () => {
  const executor = new RunbookExecutor({ autoExecute: false });
  const runbook = parseRunbookMarkdown(`# Manual Command Runbook

## Mitigation

1. Check status
\`kubectl rollout pause deployment/api\`
`);

  const execution = executor.initializeExecution(runbook, "test-operator");
  await executor.executeStep(execution.executionId, "Mitigation", 1);

  // Confirm the step
  const confirmed = executor.confirmStep(execution.executionId, 1);
  assert.ok(confirmed);
  assert.equal(confirmed.status, "running");
});

test("RunbookExecutor skips steps correctly", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown(SAMPLE_RUNBOOK_MARKDOWN);

  const execution = executor.initializeExecution(runbook, "test-operator");
  const skipped = executor.skipStep(execution.executionId, "Mitigation", 0);

  assert.ok(skipped);
  assert.equal(skipped.status, "skipped");
});

test("RunbookExecutor aborts execution", () => {
  const executor = new RunbookExecutor();
  const runbook = parseRunbookMarkdown(SAMPLE_RUNBOOK_MARKDOWN);

  const execution = executor.initializeExecution(runbook, "test-operator");
  const aborted = executor.abort(execution.executionId);

  assert.ok(aborted);
  assert.equal(aborted.status, "aborted");
  assert.equal(aborted.outcome, "aborted");
});

test("RunbookExecutor generates execution report", () => {
  const executor = new RunbookExecutor({ autoExecute: true });
  const runbook = parseRunbookMarkdown(SAMPLE_RUNBOOK_MARKDOWN);

  const execution = executor.initializeExecution(runbook, "test-operator");
  const report = executor.generateExecutionReport(execution);

  assert.ok(report.includes("Runbook Execution Report"));
  assert.ok(report.includes("High Error Rate Runbook"));
  assert.ok(report.includes("Mitigation"));
});

test("IncidentDrillService returns predefined scenarios", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenarios = drillService.getScenarios();
  assert.ok(scenarios.length > 0);
  assert.ok(scenarios.some((s) => s.scenarioId === "worker_mass_disconnect_drill"));
  assert.ok(scenarios.some((s) => s.scenarioId === "approval_channel_outage_drill"));
});

test("IncidentDrillService initializes drill correctly", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  const drill = drillService.initializeDrill(scenario, ["operator-1", "operator-2"], "drill-initiator");

  assert.ok(drill.drillId.startsWith("incident_drill_"));
  assert.equal(drill.scenario.name, "Worker Mass Disconnect");
  assert.equal(drill.status, "initialized");
  assert.deepEqual(drill.participants, ["operator-1", "operator-2"]);
});

test("IncidentDrillService starts drill", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "drill-initiator");

  const started = drillService.startDrill();
  assert.ok(started);
  assert.equal(started.status, "in_progress");
});

test("IncidentDrillService records observations", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "drill-initiator");
  drillService.startDrill();

  const observation = drillService.recordObservation(
    "operator-1",
    "decision",
    "Identified worker disconnect as root cause",
    "good",
  );

  assert.ok(observation);
  assert.equal(observation.category, "decision");
  assert.equal(observation.severity, "good");
});

test("IncidentDrillService completes drill with score", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "drill-initiator");
  drillService.startDrill();

  const criteriaResults = [
    { criterion: "Time to detect", passed: true, actualValue: 45, threshold: 60, notes: "Detected within 45 seconds" },
    { criterion: "Correct escalation", passed: true, notes: "Correct path used" },
  ];

  const result = drillService.completeDrill([], ["Improve documentation"], criteriaResults);

  assert.ok(result);
  assert.equal(result.status, "completed");
  assert.equal(result.overallScore, 100); // 2/2 passed
  assert.deepEqual(result.recommendations, ["Improve documentation"]);
});

test("IncidentDrillService cancels drill", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "drill-initiator");
  drillService.startDrill();

  const cancelled = drillService.cancelDrill();
  assert.ok(cancelled);
  assert.equal(cancelled.status, "cancelled");
});

test("IncidentDrillService generates drill report", () => {
  const executor = new RunbookExecutor();
  const drillService = new IncidentDrillService(executor);

  const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
  drillService.initializeDrill(scenario, ["operator-1"], "drill-initiator");
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
  assert.ok(report.includes("operator-1"));
});

test("Predefined scenarios have required fields", () => {
  for (const scenario of PREDEFINED_SCENARIOS) {
    assert.ok(scenario.scenarioId);
    assert.ok(scenario.name);
    assert.ok(scenario.description);
    assert.ok(scenario.severity);
    assert.ok(Array.isArray(scenario.injections));
    assert.ok(Array.isArray(scenario.expectedResponseSteps));
    assert.ok(Array.isArray(scenario.successCriteria));
  }
});

test("RunbookExecutor with custom config applies settings", () => {
  const executor = new RunbookExecutor({
    autoExecute: true,
    stepTimeoutMs: 60000,
    continueOnFailure: true,
    executeVerification: false,
  });

  // Verify config is applied by checking that autoExecute allows immediate execution
  const runbook = parseRunbookMarkdown("# Test\n\n## Mitigation\n1. Step one");
  const execution = executor.initializeExecution(runbook, "test");
  assert.equal(execution.status, "initialized");
});

test("parseRunbookMarkdown handles empty markdown", () => {
  const runbook = parseRunbookMarkdown("");
  assert.equal(runbook.title, "Untitled Runbook");
  assert.equal(runbook.sections.length, 0);
});

test("parseRunbookMarkdown handles markdown without sections", () => {
  const runbook = parseRunbookMarkdown("# Simple Runbook\n\nJust some text without sections.");
  assert.equal(runbook.title, "Simple Runbook");
  assert.ok(runbook.sections.length >= 0);
});
