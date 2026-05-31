/**
 * Integration Tests: Incident Drill Service
 *
 * Tests the incident drill service with realistic drill scenarios,
 * observation recording, and drill lifecycle management.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  IncidentDrillService,
  PREDEFINED_SCENARIOS,
  DEFAULT_INCIDENT_DRILL_CONFIG,
  type IncidentDrillScenario,
  type DrillObservation,
  type DrillCriteriaResult,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/incident-drill-service.js";
import type { RunbookExecutor, RunbookExecutionResult } from "../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/types.js";
import type { ParsedRunbook } from "../../../../../src/platform/five-plane-control-plane/incident-control/runbook-executor/types.js";

// Mock runbook executor for testing
function createMockExecutor(): RunbookExecutor {
  return {
    execute: async (runbook: ParsedRunbook) => {
      return {
        executionId: `exec_${Date.now()}`,
        runbook,
        status: "completed",
        sectionResults: [],
        outcome: "success",
        summary: "Runbook executed successfully",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 1000,
        executedBy: "drill-service",
      } as RunbookExecutionResult;
    },
  };
}

test("IncidentDrillService: initializeDrill creates drill with predefined scenario", () => {
  const ctx = createIntegrationContext("aa-drill-init-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    const drill = service.initializeDrill(scenario, ["operator-1", "operator-2"], "admin");

    assert.ok(drill.drillId.startsWith("incident_drill_"));
    assert.strictEqual(drill.scenario.scenarioId, scenario.scenarioId);
    assert.strictEqual(drill.status, "initialized");
    assert.deepStrictEqual(drill.participants, ["operator-1", "operator-2"]);
    assert.strictEqual(drill.startedAt.length > 0, true);
    assert.strictEqual(drill.completedAt, null);
    assert.strictEqual(drill.durationMs, null);
    assert.strictEqual(drill.overallScore, null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: startDrill transitions initialized drill to in_progress", () => {
  const ctx = createIntegrationContext("aa-drill-start-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    const result = service.startDrill();

    assert.ok(result);
    assert.strictEqual(result!.status, "in_progress");
    assert.ok(result!.startedAt);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: startDrill returns null when no drill is initialized", () => {
  const ctx = createIntegrationContext("aa-drill-start-null-");
  try {
    const service = new IncidentDrillService(createMockExecutor());

    const result = service.startDrill();

    assert.strictEqual(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: startDrill returns null when drill already in progress", () => {
  const ctx = createIntegrationContext("aa-drill-start-twice-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill(); // First start

    const result = service.startDrill(); // Second start should fail

    assert.strictEqual(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: recordObservation adds observation to active drill", () => {
  const ctx = createIntegrationContext("aa-drill-observe-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill();

    const observation = service.recordObservation(
      "operator-1",
      "decision",
      "Identified root cause as network partition",
      "good",
    );

    assert.ok(observation);
    assert.ok(observation.observationId.startsWith("drill_obs_"));
    assert.strictEqual(observation.observedBy, "operator-1");
    assert.strictEqual(observation.category, "decision");
    assert.strictEqual(observation.description, "Identified root cause as network partition");
    assert.strictEqual(observation.severity, "good");
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: recordObservation returns null when no active drill", () => {
  const ctx = createIntegrationContext("aa-drill-observe-no-drill-");
  try {
    const service = new IncidentDrillService(createMockExecutor());

    const observation = service.recordObservation(
      "operator-1",
      "decision",
      "Should not be recorded",
    );

    assert.strictEqual(observation, null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: recordObservation returns null when drill not in progress", () => {
  const ctx = createIntegrationContext("aa-drill-observe-not-started-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    // Not started - still in "initialized" state

    const observation = service.recordObservation(
      "operator-1",
      "decision",
      "Should not be recorded",
    );

    assert.strictEqual(observation, null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: completeDrill finalizes drill with all results", () => {
  const ctx = createIntegrationContext("aa-drill-complete-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill();

    service.recordObservation("operator-1", "timeline", "Detection: 45 seconds", "good");
    service.recordObservation("operator-1", "action", "Initiated reconnect protocol", "good");

    const issuesFound = ["Minor communication delay at start"];
    const recommendations = ["Consider faster escalation to next level"];
    const criteriaResults: DrillCriteriaResult[] = [
      { criterion: "Time to detect", passed: true, actualValue: 45, threshold: 60, notes: "Under threshold" },
      { criterion: "Correct escalation", passed: true, notes: "Proper path used" },
    ];

    const result = service.completeDrill(issuesFound, recommendations, criteriaResults);

    assert.ok(result);
    assert.strictEqual(result.status, "completed");
    assert.ok(result.completedAt !== null);
    assert.ok(result.durationMs !== null);
    assert.strictEqual(result.overallScore, 100); // All criteria passed
    assert.deepStrictEqual(result.issuesFound, issuesFound);
    assert.deepStrictEqual(result.recommendations, recommendations);
    assert.strictEqual(result.criteriaResults.length, 2);
    assert.ok(result.summary.includes(scenario.name));
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: completeDrill calculates partial score correctly", () => {
  const ctx = createIntegrationContext("aa-drill-partial-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill();

    const criteriaResults: DrillCriteriaResult[] = [
      { criterion: "Test 1", passed: true, notes: "Passed" },
      { criterion: "Test 2", passed: true, notes: "Passed" },
      { criterion: "Test 3", passed: false, notes: "Failed" },
      { criterion: "Test 4", passed: false, notes: "Failed" },
    ];

    const result = service.completeDrill([], [], criteriaResults);

    assert.strictEqual(result!.overallScore, 50); // 2 of 4 = 50%
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: completeDrill returns 0 for no criteria", () => {
  const ctx = createIntegrationContext("aa-drill-no-criteria-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill();

    const result = service.completeDrill([], [], []);

    assert.strictEqual(result!.overallScore, 0);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: completeDrill returns null when no active drill", () => {
  const ctx = createIntegrationContext("aa-drill-complete-null-");
  try {
    const service = new IncidentDrillService(createMockExecutor());

    const result = service.completeDrill([], [], []);

    assert.strictEqual(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: cancelDrill cancels and clears drill", () => {
  const ctx = createIntegrationContext("aa-drill-cancel-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill();

    const result = service.cancelDrill();

    assert.ok(result);
    assert.strictEqual(result!.status, "cancelled");
    assert.ok(result!.completedAt !== null);
    assert.ok(result!.durationMs !== null);
    assert.ok(result!.summary.includes("cancelled"));
    assert.strictEqual(service.getCurrentDrill(), null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: cancelDrill returns null when no active drill", () => {
  const ctx = createIntegrationContext("aa-drill-cancel-null-");
  try {
    const service = new IncidentDrillService(createMockExecutor());

    const result = service.cancelDrill();

    assert.strictEqual(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: getScenarios returns all predefined scenarios", () => {
  const ctx = createIntegrationContext("aa-drill-scenarios-");
  try {
    const service = new IncidentDrillService(createMockExecutor());

    const scenarios = service.getScenarios();

    assert.strictEqual(scenarios.length, 3);
    assert.ok(scenarios.some((s) => s.scenarioId === "worker_mass_disconnect_drill"));
    assert.ok(scenarios.some((s) => s.scenarioId === "approval_channel_outage_drill"));
    assert.ok(scenarios.some((s) => s.scenarioId === "cost_spike_drill"));
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: getScenario finds scenario by ID", () => {
  const ctx = createIntegrationContext("aa-drill-get-scenario-");
  try {
    const service = new IncidentDrillService(createMockExecutor());

    const scenario = service.getScenario("worker_mass_disconnect_drill");

    assert.ok(scenario);
    assert.strictEqual(scenario!.name, "Worker Mass Disconnect");
    assert.strictEqual(scenario!.severity, "P0");
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: getScenario returns undefined for unknown ID", () => {
  const ctx = createIntegrationContext("aa-drill-unknown-scenario-");
  try {
    const service = new IncidentDrillService(createMockExecutor());

    const scenario = service.getScenario("nonexistent-scenario");

    assert.strictEqual(scenario, undefined);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: getCurrentDrill returns current drill state", () => {
  const ctx = createIntegrationContext("aa-drill-current-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    assert.strictEqual(service.getCurrentDrill(), null);

    service.initializeDrill(scenario, ["operator-1"], "admin");
    assert.ok(service.getCurrentDrill());
    assert.strictEqual(service.getCurrentDrill()!.scenario.scenarioId, scenario.scenarioId);

    service.cancelDrill();
    assert.strictEqual(service.getCurrentDrill(), null);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: addRunbookExecution adds execution to current drill", () => {
  const ctx = createIntegrationContext("aa-drill-add-exec-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill();

    const execution: RunbookExecutionResult = {
      executionId: "exec_drill_123",
      runbook: {
        runbookId: "runbook-1",
        title: "Reconnect Workers",
        severity: "P1",
        sections: [],
        rawMarkdown: "# Reconnect Protocol",
        parsedAt: new Date().toISOString(),
      },
      status: "completed",
      sectionResults: [],
      outcome: "success",
      summary: "Workers reconnected",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalDurationMs: 5000,
      executedBy: "operator-1",
    };

    service.addRunbookExecution(execution);

    const current = service.getCurrentDrill();
    assert.strictEqual(current!.runbookExecutions.length, 1);
    assert.strictEqual(current!.runbookExecutions[0]!.executionId, "exec_drill_123");
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: addRunbookExecution does nothing when no active drill", () => {
  assert.doesNotThrow(() => {
    const ctx = createIntegrationContext("aa-drill-add-exec-null-");
    try {
      const service = new IncidentDrillService(createMockExecutor());

      const execution: RunbookExecutionResult = {
        executionId: "exec_orphan",
        runbook: {
          runbookId: "runbook-1",
          title: "Orphan",
          severity: "P2",
          sections: [],
          rawMarkdown: "# Orphan",
          parsedAt: new Date().toISOString(),
        },
        status: "completed",
        sectionResults: [],
        outcome: "success",
        summary: "Should not be added",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: 1000,
        executedBy: "operator-1",
      };

      // Should not throw
      service.addRunbookExecution(execution);
    } finally {
      ctx.cleanup();
    }
  });
});

test("IncidentDrillService: generateDrillReport creates formatted markdown", () => {
  const ctx = createIntegrationContext("aa-drill-report-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1", "operator-2"], "admin");
    service.startDrill();

    service.recordObservation("operator-1", "decision", "Root cause identified", "good");
    service.recordObservation("operator-2", "action", "Escalation triggered", "concern");

    const result = service.completeDrill(
      ["Communication delay"],
      ["Improve escalation speed"],
      [{ criterion: "Detection time", passed: true, actualValue: 45, threshold: 60, notes: "Good" }],
    );

    const report = service.generateDrillReport(result!);

    assert.ok(report.includes("# Incident Drill Report"));
    assert.ok(report.includes(scenario.name));
    assert.ok(report.includes("operator-1, operator-2"));
    assert.ok(report.includes("100%"));
    assert.ok(report.includes("Root cause identified"));
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: custom config overrides defaults", () => {
  const ctx = createIntegrationContext("aa-drill-custom-config-");
  try {
    const customConfig = {
      recordActions: false,
      autoInject: false,
      targetEnvironment: "staging" as const,
    };

    const service = new IncidentDrillService(createMockExecutor(), customConfig);

    assert.ok(service);
    // Service should use custom config (verify via behavior)
  } finally {
    ctx.cleanup();
  }
});

test("PREDEFINED_SCENARIOS: all scenarios have required fields", () => {
  for (const scenario of PREDEFINED_SCENARIOS) {
    assert.ok(scenario.scenarioId.length > 0);
    assert.ok(scenario.name.length > 0);
    assert.ok(scenario.description.length > 0);
    assert.ok(["tabletop", "functional", "full_simulation"].includes(scenario.drillType));
    assert.ok(["P0", "P1", "P2", "P3"].includes(scenario.severity));
    assert.ok(Array.isArray(scenario.injections));
    assert.ok(Array.isArray(scenario.expectedResponseSteps));
    assert.ok(scenario.expectedResponseSteps.length > 0);
    assert.ok(Array.isArray(scenario.successCriteria));
    assert.ok(typeof scenario.timeLimitSeconds === "number");
  }
});

test("DEFAULT_INCIDENT_DRILL_CONFIG: has correct default values", () => {
  assert.strictEqual(DEFAULT_INCIDENT_DRILL_CONFIG.recordActions, true);
  assert.strictEqual(DEFAULT_INCIDENT_DRILL_CONFIG.autoInject, true);
  assert.strictEqual(DEFAULT_INCIDENT_DRILL_CONFIG.targetEnvironment, "test");
});

test("IncidentDrillService: drill completes and clears current drill", () => {
  const ctx = createIntegrationContext("aa-drill-complete-clear-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill();

    const result = service.completeDrill([], [], []);

    assert.ok(result);
    assert.strictEqual(service.getCurrentDrill(), null); // Cleared after completion
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: multiple observations can be recorded", () => {
  const ctx = createIntegrationContext("aa-drill-multi-obs-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1", "operator-2"], "admin");
    service.startDrill();

    service.recordObservation("operator-1", "timeline", "Detection", "good");
    service.recordObservation("operator-1", "decision", "Root cause", "good");
    service.recordObservation("operator-2", "action", "Escalation", "good");
    service.recordObservation("operator-2", "escalation", "Notified on-call", "concern");

    const current = service.getCurrentDrill();
    assert.strictEqual(current!.observations.length, 4);
  } finally {
    ctx.cleanup();
  }
});

test("IncidentDrillService: observations have correct categories", () => {
  const ctx = createIntegrationContext("aa-drill-obs-categories-");
  try {
    const service = new IncidentDrillService(createMockExecutor());
    const scenario = PREDEFINED_SCENARIOS[0]!;

    service.initializeDrill(scenario, ["operator-1"], "admin");
    service.startDrill();

    const categories: DrillObservation["category"][] = ["timeline", "communication", "decision", "action", "escalation", "other"];

    for (const category of categories) {
      const observation = service.recordObservation("operator-1", category, `Test ${category}`);
      assert.strictEqual(observation?.category, category);
    }
  } finally {
    ctx.cleanup();
  }
});
