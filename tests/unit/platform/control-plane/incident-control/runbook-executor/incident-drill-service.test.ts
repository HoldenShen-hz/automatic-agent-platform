/**
 * Unit tests for Incident Drill Service Types
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  IncidentDrillType,
  IncidentDrillStatus,
  IncidentDrillScenario,
  IncidentInjection,
  DrillSuccessCriterion,
  IncidentDrillResult,
  DrillObservation,
  DrillCriteriaResult,
  IncidentDrillConfig,
} from "../../../../../../src/platform/control-plane/incident-control/runbook-executor/incident-drill-service.js";

test("IncidentDrillType is a string union type", () => {
  const tabletop: IncidentDrillType = "tabletop";
  const functional: IncidentDrillType = "functional";
  const fullSimulation: IncidentDrillType = "full_simulation";

  assert.equal(tabletop, "tabletop");
  assert.equal(functional, "functional");
  assert.equal(fullSimulation, "full_simulation");
});

test("IncidentDrillStatus is a string union type", () => {
  const statuses: IncidentDrillStatus[] = [
    "initialized",
    "in_progress",
    "paused",
    "completed",
    "cancelled",
  ];

  assert.equal(statuses.length, 5);
  assert.ok(statuses.includes("initialized"));
  assert.ok(statuses.includes("in_progress"));
  assert.ok(statuses.includes("completed"));
});

test("IncidentInjection injectionType is a string union type", () => {
  const types: IncidentInjection["injectionType"][] = [
    "metric_spike",
    "service_failure",
    "latency_injection",
    "error_rate_increase",
    "resource_exhaustion",
  ];

  assert.equal(types.length, 5);
  assert.ok(types.includes("metric_spike"));
  assert.ok(types.includes("service_failure"));
});

test("DrillObservation category is a string union type", () => {
  const categories: DrillObservation["category"][] = [
    "timeline",
    "communication",
    "decision",
    "action",
    "escalation",
    "other",
  ];

  assert.equal(categories.length, 6);
  assert.ok(categories.includes("timeline"));
  assert.ok(categories.includes("decision"));
  assert.ok(categories.includes("escalation"));
});

test("DrillObservation severity is optional string union", () => {
  const good: DrillObservation["severity"] = "good";
  const concern: DrillObservation["severity"] = "concern";
  const critical: DrillObservation["severity"] = "critical";

  assert.equal(good, "good");
  assert.equal(concern, "concern");
  assert.equal(critical, "critical");
});

test("IncidentDrillScenario can be used as a type", () => {
  const scenario: IncidentDrillScenario = {
    scenarioId: "test-scenario",
    name: "Test Scenario",
    description: "A test scenario for unit testing",
    drillType: "functional",
    severity: "P2",
    injections: [],
    expectedResponseSteps: ["Step 1", "Step 2"],
    successCriteria: [],
    timeLimitSeconds: 300,
  };

  assert.equal(scenario.scenarioId, "test-scenario");
  assert.equal(scenario.severity, "P2");
  assert.equal(scenario.drillType, "functional");
});

test("IncidentDrillScenario severity accepts P0-P3", () => {
  const p0: IncidentDrillScenario["severity"] = "P0";
  const p1: IncidentDrillScenario["severity"] = "P1";
  const p2: IncidentDrillScenario["severity"] = "P2";
  const p3: IncidentDrillScenario["severity"] = "P3";

  assert.equal(p0, "P0");
  assert.equal(p1, "P1");
  assert.equal(p2, "P2");
  assert.equal(p3, "P3");
});

test("IncidentInjection can be used as a type", () => {
  const injection: IncidentInjection = {
    injectionType: "service_failure",
    target: "worker_coordinator",
    parameters: { reason: "test" },
    injectAtSeconds: 30,
    durationSeconds: 60,
  };

  assert.equal(injection.injectionType, "service_failure");
  assert.equal(injection.target, "worker_coordinator");
  assert.deepEqual(injection.parameters, { reason: "test" });
  assert.equal(injection.injectAtSeconds, 30);
  assert.equal(injection.durationSeconds, 60);
});

test("DrillSuccessCriterion can be used as a type", () => {
  const criterion: DrillSuccessCriterion = {
    description: "Time to detect incident",
    evaluationMethod: "drill.observation.timeline.detect_time",
    passThreshold: 60,
  };

  assert.equal(criterion.description, "Time to detect incident");
  assert.equal(criterion.passThreshold, 60);
});

test("DrillSuccessCriterion passThreshold is optional", () => {
  const criterion: DrillSuccessCriterion = {
    description: "Correct path used",
    evaluationMethod: "drill.escalation.correct_path_used",
    // No passThreshold - it's optional
  };

  assert.ok(criterion.passThreshold === undefined);
});

test("IncidentDrillResult can be used as a type", () => {
  const result: IncidentDrillResult = {
    drillId: "drill-123",
    scenario: {
      scenarioId: "test-scenario",
      name: "Test",
      description: "Test scenario",
      drillType: "functional",
      severity: "P2",
      injections: [],
      expectedResponseSteps: [],
      successCriteria: [],
      timeLimitSeconds: 300,
    },
    status: "completed",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:10:00.000Z",
    durationMs: 600000,
    participants: ["operator-1", "operator-2"],
    observations: [],
    runbookExecutions: [],
    criteriaResults: [],
    overallScore: 85,
    summary: "Drill completed successfully",
    issuesFound: [],
    recommendations: ["Consider faster escalation"],
  };

  assert.equal(result.drillId, "drill-123");
  assert.equal(result.status, "completed");
  assert.equal(result.overallScore, 85);
  assert.equal(result.participants.length, 2);
});

test("DrillObservation can be used as a type", () => {
  const observation: DrillObservation = {
    observationId: "obs-123",
    timestamp: "2026-01-01T00:05:00.000Z",
    observedBy: "operator-1",
    category: "decision",
    description: "Correct root cause identified",
    severity: "good",
  };

  assert.equal(observation.observationId, "obs-123");
  assert.equal(observation.category, "decision");
  assert.equal(observation.severity, "good");
});

test("DrillCriteriaResult can be used as a type", () => {
  const result: DrillCriteriaResult = {
    criterion: "Time to detect incident",
    passed: true,
    actualValue: 45,
    threshold: 60,
    notes: "Detected within threshold",
  };

  assert.equal(result.passed, true);
  assert.equal(result.actualValue, 45);
  assert.equal(result.threshold, 60);
});

test("IncidentDrillConfig targetEnvironment is a string union", () => {
  const configs: IncidentDrillConfig["targetEnvironment"][] = [
    "test",
    "staging",
    "production_simulation",
  ];

  assert.equal(configs.length, 3);
  assert.ok(configs.includes("test"));
  assert.ok(configs.includes("staging"));
  assert.ok(configs.includes("production_simulation"));
});

test("IncidentDrillResult overallScore can be null", () => {
  const result: IncidentDrillResult = {
    drillId: "drill-123",
    scenario: {
      scenarioId: "test",
      name: "Test",
      description: "Test",
      drillType: "functional",
      severity: "P3",
      injections: [],
      expectedResponseSteps: [],
      successCriteria: [],
      timeLimitSeconds: 300,
    },
    status: "in_progress",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    durationMs: null,
    participants: [],
    observations: [],
    runbookExecutions: [],
    criteriaResults: [],
    overallScore: null, // Not yet calculated
    summary: "Drill in progress",
    issuesFound: [],
    recommendations: [],
  };

  assert.equal(result.overallScore, null);
  assert.equal(result.status, "in_progress");
});

test("IncidentDrillResult completedAt can be null", () => {
  const result: IncidentDrillResult = {
    drillId: "drill-123",
    scenario: {
      scenarioId: "test",
      name: "Test",
      description: "Test",
      drillType: "functional",
      severity: "P3",
      injections: [],
      expectedResponseSteps: [],
      successCriteria: [],
      timeLimitSeconds: 300,
    },
    status: "in_progress",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    durationMs: null,
    participants: [],
    observations: [],
    runbookExecutions: [],
    criteriaResults: [],
    overallScore: null,
    summary: "Drill in progress",
    issuesFound: [],
    recommendations: [],
  };

  assert.equal(result.completedAt, null);
});

test("IncidentInjection parameters can contain arbitrary data", () => {
  const injection: IncidentInjection = {
    injectionType: "metric_spike",
    target: "cost_tracking",
    parameters: {
      spikePercent: 200,
      affectedTasks: ["task-1", "task-2"],
      nested: { value: 42 },
    },
    injectAtSeconds: 10,
    durationSeconds: 0,
  };

  assert.equal(injection.parameters.spikePercent, 200);
  assert.deepEqual(injection.parameters.affectedTasks, ["task-1", "task-2"]);
  assert.deepEqual(injection.parameters.nested, { value: 42 });
});
