/**
 * Unit tests for IncidentDrillService - business logic
 * Tests drill lifecycle, observation recording, and report generation
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  IncidentDrillService,
  PREDEFINED_SCENARIOS,
  DEFAULT_INCIDENT_DRILL_CONFIG,
  type IncidentDrillScenario,
} from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/incident-drill-service.js";
import type { RunbookExecutionResult } from "../../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/types.js";

// Mock runbook executor
const createMockExecutor = () => ({
  execute: async () => ({ success: true } as RunbookExecutionResult),
});

test("IncidentDrillService initializes with default config", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  assert.ok(service);
});

test("IncidentDrillService initializes with custom config", () => {
  const config = {
    recordActions: false,
    autoInject: false,
    targetEnvironment: "staging" as const,
  };
  const service = new IncidentDrillService(createMockExecutor() as any, config);
  assert.ok(service);
});

test("IncidentDrillService.getScenarios returns all predefined scenarios", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenarios = service.getScenarios();

  assert.ok(Array.isArray(scenarios));
  assert.equal(scenarios.length, 3);
  assert.ok(scenarios.some((s) => s.scenarioId === "worker_mass_disconnect_drill"));
  assert.ok(scenarios.some((s) => s.scenarioId === "approval_channel_outage_drill"));
  assert.ok(scenarios.some((s) => s.scenarioId === "cost_spike_drill"));
});

test("IncidentDrillService.getScenario finds scenario by ID", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);

  const scenario = service.getScenario("worker_mass_disconnect_drill");

  assert.ok(scenario);
  assert.equal(scenario!.name, "Worker Mass Disconnect");
});

test("IncidentDrillService.getScenario returns undefined for unknown ID", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);

  const scenario = service.getScenario("nonexistent-scenario");

  assert.equal(scenario, undefined);
});

test("IncidentDrillService.initializeDrill creates new drill with correct structure", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  const drill = service.initializeDrill(scenario, ["operator-1", "operator-2"], "admin");

  assert.ok(drill.drillId.startsWith("incident_drill_"));
  assert.equal(drill.scenario.scenarioId, scenario.scenarioId);
  assert.equal(drill.status, "initialized");
  assert.deepEqual(drill.participants, ["operator-1", "operator-2"]);
  assert.equal(drill.completedAt, null);
  assert.equal(drill.durationMs, null);
  assert.equal(drill.overallScore, null);
});

test("IncidentDrillService.startDrill transitions initialized drill to in_progress", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  const result = service.startDrill();

  assert.ok(result);
  assert.equal(result!.status, "in_progress");
});

test("IncidentDrillService.startDrill returns null when no drill initialized", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);

  const result = service.startDrill();

  assert.equal(result, null);
});

test("IncidentDrillService.startDrill returns null when drill not in initialized state", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill(); // Now in_progress

  const result = service.startDrill();

  assert.equal(result, null);
});

test("IncidentDrillService.recordObservation adds observation to in_progress drill", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill();

  const observation = service.recordObservation(
    "operator-1",
    "decision",
    "Correct root cause identified",
    "good",
  );

  assert.ok(observation);
  assert.ok(observation.observationId.startsWith("drill_obs_"));
  assert.equal(observation.observedBy, "operator-1");
  assert.equal(observation.category, "decision");
  assert.equal(observation.severity, "good");
});

test("IncidentDrillService.recordObservation returns null when no active drill", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);

  const observation = service.recordObservation(
    "operator-1",
    "decision",
    "Should not be recorded",
  );

  assert.equal(observation, null);
});

test("IncidentDrillService.recordObservation returns null for non-in_progress drill", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  // Not started - still initialized

  const observation = service.recordObservation(
    "operator-1",
    "decision",
    "Should not be recorded",
  );

  assert.equal(observation, null);
});

test("IncidentDrillService.completeDrill finalizes drill with results", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill();

  service.recordObservation("operator-1", "timeline", "Detection time recorded", "good");

  const criteriaResults = [
    { criterion: "Time to detect incident", passed: true, actualValue: 45, threshold: 60, notes: "Within threshold" },
    { criterion: "Correct path used", passed: true, notes: "Proper escalation" },
  ];

  const result = service.completeDrill(
    ["Minor communication delay"],
    ["Consider faster escalation"],
    criteriaResults,
  );

  assert.ok(result);
  assert.equal(result!.status, "completed");
  assert.ok(result!.completedAt !== null);
  assert.ok(result!.durationMs !== null);
  assert.equal(result!.issuesFound.length, 1);
  assert.equal(result!.recommendations.length, 1);
  assert.equal(result!.criteriaResults.length, 2);
  assert.equal(result!.overallScore, 100); // Both passed = 100%
});

test("IncidentDrillService.completeDrill calculates score correctly with partial pass", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill();

  const criteriaResults = [
    { criterion: "Criterion 1", passed: true, notes: "Passed" },
    { criterion: "Criterion 2", passed: false, notes: "Failed" },
    { criterion: "Criterion 3", passed: true, notes: "Passed" },
    { criterion: "Criterion 4", passed: false, notes: "Failed" },
  ];

  const result = service.completeDrill([], [], criteriaResults);

  assert.equal(result!.overallScore, 50); // 2 of 4 passed = 50%
});

test("IncidentDrillService.completeDrill returns 0 score for no criteria", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill();

  const result = service.completeDrill([], [], []);

  assert.equal(result!.overallScore, 0);
});

test("IncidentDrillService.completeDrill returns null when no active drill", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);

  const result = service.completeDrill([], [], []);

  assert.equal(result, null);
});

test("IncidentDrillService.cancelDrill cancels and clears drill", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill();

  const result = service.cancelDrill();

  assert.ok(result);
  assert.equal(result!.status, "cancelled");
  assert.ok(result!.completedAt !== null);
  assert.ok(result!.durationMs !== null);
  assert.ok(result!.summary.includes("cancelled"));
  assert.equal(service.getCurrentDrill(), null);
});

test("IncidentDrillService.cancelDrill returns null when no active drill", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);

  const result = service.cancelDrill();

  assert.equal(result, null);
});

test("IncidentDrillService.getCurrentDrill returns current drill state", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  assert.equal(service.getCurrentDrill(), null);

  service.initializeDrill(scenario, ["operator-1"], "admin");

  const current = service.getCurrentDrill();
  assert.ok(current);
  assert.equal(current!.scenario.scenarioId, scenario.scenarioId);

  service.cancelDrill();

  assert.equal(service.getCurrentDrill(), null);
});

test("IncidentDrillService.addRunbookExecution adds execution to current drill", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill();

  const execution: RunbookExecutionResult = {
    executionId: "exec-123",
    runbook: {
      runbookId: "runbook-1",
      title: "Test Runbook",
      severity: "P2",
      sections: [],
      rawMarkdown: "# Test",
      parsedAt: new Date().toISOString(),
    },
    status: "completed",
    sectionResults: [],
    outcome: "success",
    summary: "Completed",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    totalDurationMs: 30000,
    executedBy: "operator-1",
  };

  service.addRunbookExecution(execution);

  const current = service.getCurrentDrill();
  assert.equal(current!.runbookExecutions.length, 1);
  assert.equal(current!.runbookExecutions[0]!.executionId, "exec-123");
});

test("IncidentDrillService.addRunbookExecution does nothing when no active drill", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);

  const execution: RunbookExecutionResult = {
    executionId: "exec-123",
    runbook: {
      runbookId: "runbook-1",
      title: "Test",
      severity: "P2",
      sections: [],
      rawMarkdown: "# Test",
      parsedAt: new Date().toISOString(),
    },
    status: "completed",
    sectionResults: [],
    outcome: "success",
    summary: "Test",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    totalDurationMs: 1000,
    executedBy: "operator-1",
  };

  // Should not throw
  service.addRunbookExecution(execution);
});

test("IncidentDrillService.generateDrillReport creates formatted markdown report", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1", "operator-2"], "admin");
  service.startDrill();

  service.recordObservation("operator-1", "decision", "Correct root cause identified", "good");
  service.recordObservation("operator-2", "action", "Escalation triggered properly", "concern");

  const criteriaResults = [
    { criterion: "Time to detect", passed: true, actualValue: 45, threshold: 60, notes: "Within threshold" },
  ];

  const result = service.completeDrill(["Communication delay"], ["Faster escalation"], criteriaResults);

  const report = service.generateDrillReport(result!);

  assert.ok(report.includes("# Incident Drill Report"));
  assert.ok(report.includes(scenario.name));
  assert.ok(report.includes("operator-1, operator-2"));
  assert.ok(report.includes("100%")); // Overall score
  assert.ok(report.includes("Time to detect"));
});

test("IncidentDrillService generates summary correctly", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[1]!; // P1 drill

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill();

  const criteriaResults = [
    { criterion: "Test 1", passed: true, notes: "Pass" },
    { criterion: "Test 2", passed: false, notes: "Fail" },
  ];

  const result = service.completeDrill([], [], criteriaResults);

  // Summary should contain drill name, severity, score, and metrics
  assert.ok(result!.summary.includes(scenario.name));
  assert.ok(result!.summary.includes("P1"));
  assert.ok(result!.summary.includes("50%")); // 1 of 2 passed
});

test("PREDEFINED_SCENARIOS have correct structure for all drill types", () => {
  for (const scenario of PREDEFINED_SCENARIOS) {
    assert.ok(scenario.scenarioId);
    assert.ok(scenario.name);
    assert.ok(scenario.description);
    assert.ok(scenario.injections.length >= 0);
    assert.ok(scenario.expectedResponseSteps.length > 0);
    assert.ok(scenario.successCriteria.length >= 0);
    assert.ok(scenario.timeLimitSeconds > 0);
  }
});

test("DEFAULT_INCIDENT_DRILL_CONFIG has correct values", () => {
  assert.equal(DEFAULT_INCIDENT_DRILL_CONFIG.recordActions, true);
  assert.equal(DEFAULT_INCIDENT_DRILL_CONFIG.autoInject, true);
  assert.equal(DEFAULT_INCIDENT_DRILL_CONFIG.targetEnvironment, "test");
});

test("IncidentDrillService calculates duration correctly", () => {
  const service = new IncidentDrillService(createMockExecutor() as any);
  const scenario = PREDEFINED_SCENARIOS[0]!;

  service.initializeDrill(scenario, ["operator-1"], "admin");
  service.startDrill();

  // Simulate some time passing
  const result = service.completeDrill([], [], []);

  assert.ok(result!.durationMs! >= 0);
});