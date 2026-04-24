/**
 * Unit tests for chaos experiment scheduler
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ChaosExperimentScheduler,
  type SteadyStateHypothesis,
  type ExperimentTarget,
  type FaultInjection,
  type ExperimentScheduleInput,
  type GameDayScheduleInput,
  type ChaosExperiment,
  type ChaosGameDay,
} from "../../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createScheduler(): ChaosExperimentScheduler {
  return new ChaosExperimentScheduler();
}

function makeTarget(overrides: Partial<ExperimentTarget> = {}): ExperimentTarget {
  return {
    targetKind: "service",
    targetId: "service-001",
    labels: { env: "test" },
    ...overrides,
  };
}

function makeFault(overrides: Partial<FaultInjection> = {}): FaultInjection {
  return {
    faultType: "latency",
    intensity: 0.5,
    durationMs: 1000,
    parameters: {},
    ...overrides,
  };
}

function makeHypothesis(overrides: Partial<SteadyStateHypothesis> = {}): SteadyStateHypothesis {
  return {
    name: "error_rate_low",
    metricName: "error_rate",
    tolerance: 0.01,
    operator: "lt",
    ...overrides,
  };
}

function makeExperimentInput(overrides: Partial<ExperimentScheduleInput> = {}): ExperimentScheduleInput {
  return {
    name: "Test Experiment",
    description: "Test description",
    target: makeTarget(),
    fault: makeFault(),
    steadyStateHypotheses: [makeHypothesis()],
    scheduledAt: "2026-04-24T10:00:00.000Z",
    maxDurationMs: 60000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constructor tests
// ---------------------------------------------------------------------------

test("ChaosExperimentScheduler can be instantiated", () => {
  const scheduler = createScheduler();
  assert.ok(scheduler != null);
});

test("ChaosExperimentScheduler starts with no experiments", () => {
  const scheduler = createScheduler();
  const experiments = scheduler.listExperiments();
  assert.equal(experiments.length, 0);
});

// ---------------------------------------------------------------------------
// scheduleExperiment tests
// ---------------------------------------------------------------------------

test("scheduleExperiment creates experiment with generated ID", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput();

  const experiment = scheduler.scheduleExperiment(input);

  assert.ok(experiment.experimentId.startsWith("chaos_"));
  assert.equal(experiment.name, "Test Experiment");
  assert.equal(experiment.description, "Test description");
  assert.equal(experiment.status, "scheduled");
});

test("scheduleExperiment stores experiment in scheduler", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput();

  const experiment = scheduler.scheduleExperiment(input);
  const retrieved = scheduler.getExperiment(experiment.experimentId);

  assert.ok(retrieved != null);
  assert.equal(retrieved!.experimentId, experiment.experimentId);
});

test("scheduleExperiment preserves target configuration", () => {
  const scheduler = createScheduler();
  const target: ExperimentTarget = {
    targetKind: "database",
    targetId: "db-primary",
    labels: { region: "us-east-1" },
  };
  const input = makeExperimentInput({ target });

  const experiment = scheduler.scheduleExperiment(input);

  assert.equal(experiment.target.targetKind, "database");
  assert.equal(experiment.target.targetId, "db-primary");
  assert.equal(experiment.target.labels.region, "us-east-1");
});

test("scheduleExperiment preserves fault configuration", () => {
  const scheduler = createScheduler();
  const fault: FaultInjection = {
    faultType: "cpu_load",
    intensity: 0.9,
    durationMs: 30000,
    parameters: { cores: 4 },
  };
  const input = makeExperimentInput({ fault });

  const experiment = scheduler.scheduleExperiment(input);

  assert.equal(experiment.fault.faultType, "cpu_load");
  assert.equal(experiment.fault.intensity, 0.9);
  assert.equal(experiment.fault.durationMs, 30000);
});

test("scheduleExperiment preserves steady state hypotheses", () => {
  const scheduler = createScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    makeHypothesis({ name: "hypothesis_1" }),
    makeHypothesis({ name: "hypothesis_2" }),
  ];
  const input = makeExperimentInput({ steadyStateHypotheses: hypotheses });

  const experiment = scheduler.scheduleExperiment(input);

  assert.equal(experiment.steadyStateHypotheses.length, 2);
  assert.equal(experiment.steadyStateHypotheses[0]!.name, "hypothesis_1");
  assert.equal(experiment.steadyStateHypotheses[1]!.name, "hypothesis_2");
});

test("scheduleExperiment sets scheduledAt and null for startedAt/completedAt", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput({ scheduledAt: "2026-04-24T12:00:00.000Z" });

  const experiment = scheduler.scheduleExperiment(input);

  assert.equal(experiment.scheduledAt, "2026-04-24T12:00:00.000Z");
  assert.equal(experiment.startedAt, null);
  assert.equal(experiment.completedAt, null);
});

test("scheduleExperiment preserves maxDurationMs", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput({ maxDurationMs: 120000 });

  const experiment = scheduler.scheduleExperiment(input);

  assert.equal(experiment.maxDurationMs, 120000);
});

test("scheduleExperiment initializes empty results", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput();

  const experiment = scheduler.scheduleExperiment(input);

  assert.ok(Array.isArray(experiment.results));
  assert.equal(experiment.results.length, 0);
});

// ---------------------------------------------------------------------------
// startExperiment tests
// ---------------------------------------------------------------------------

test("startExperiment transitions scheduled experiment to running", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());

  const result = scheduler.startExperiment(experiment.experimentId);

  assert.equal(result, true);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "running");
  assert.ok(retrieved!.startedAt != null);
});

test("startExperiment returns false for unknown experiment", () => {
  const scheduler = createScheduler();

  const result = scheduler.startExperiment("unknown_id");

  assert.equal(result, false);
});

test("startExperiment returns false for already running experiment", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);

  const result = scheduler.startExperiment(experiment.experimentId);

  assert.equal(result, false);
});

test("startExperiment returns false for completed experiment", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_low", 0.001, true, "passed");

  const result = scheduler.startExperiment(experiment.experimentId);

  assert.equal(result, false);
});

// ---------------------------------------------------------------------------
// recordSteadyStateResult tests
// ---------------------------------------------------------------------------

test("recordSteadyStateResult adds result to experiment", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_low", 0.005, true, "within tolerance");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.results.length, 1);
  assert.equal(retrieved!.results[0]!.steadyStateName, "error_rate_low");
  assert.equal(retrieved!.results[0]!.measuredValue, 0.005);
  assert.equal(retrieved!.results[0]!.passed, true);
});

test("recordSteadyStateResult marks experiment completed when all hypotheses pass", () => {
  const scheduler = createScheduler();
  const hypotheses = [
    makeHypothesis({ name: "h1" }),
    makeHypothesis({ name: "h2" }),
  ];
  const experiment = scheduler.scheduleExperiment(makeExperimentInput({ steadyStateHypotheses: hypotheses }));
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 0.001, true, "h1 passed");
  scheduler.recordSteadyStateResult(experiment.experimentId, "h2", 0.002, true, "h2 passed");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "completed");
  assert.ok(retrieved!.completedAt != null);
});

test("recordSteadyStateResult marks experiment violated when any hypothesis fails", () => {
  const scheduler = createScheduler();
  const hypotheses = [
    makeHypothesis({ name: "h1" }),
    makeHypothesis({ name: "h2" }),
  ];
  const experiment = scheduler.scheduleExperiment(makeExperimentInput({ steadyStateHypotheses: hypotheses }));
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 0.001, true, "h1 passed");
  scheduler.recordSteadyStateResult(experiment.experimentId, "h2", 0.05, false, "h2 violated");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "violated");
  assert.ok(retrieved!.completedAt != null);
});

test("recordSteadyStateResult uses tolerance from hypothesis", () => {
  const scheduler = createScheduler();
  const hypotheses = [makeHypothesis({ name: "h1", tolerance: 0.05 })];
  const experiment = scheduler.scheduleExperiment(makeExperimentInput({ steadyStateHypotheses: hypotheses }));
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 0.03, true, "within tolerance");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.results[0]!.tolerance, 0.05);
});

test("recordSteadyStateResult does nothing for unknown experiment", () => {
  const scheduler = createScheduler();
  scheduler.scheduleExperiment(makeExperimentInput());

  // Should not throw
  scheduler.recordSteadyStateResult("unknown_id", "h1", 0.01, true, "test");
});

test("recordSteadyStateResult does nothing for non-running experiment", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  // Not started

  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_low", 0.01, true, "test");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.results.length, 0);
});

// ---------------------------------------------------------------------------
// injectFault tests
// ---------------------------------------------------------------------------

test("injectFault returns fault for running experiment", () => {
  const scheduler = createScheduler();
  const fault: FaultInjection = { faultType: "timeout", intensity: 0.8, durationMs: 5000, parameters: {} };
  const experiment = scheduler.scheduleExperiment(makeExperimentInput({ fault }));
  scheduler.startExperiment(experiment.experimentId);

  const result = scheduler.injectFault(experiment.experimentId);

  assert.ok(result != null);
  assert.equal(result!.faultType, "timeout");
});

test("injectFault returns null for unknown experiment", () => {
  const scheduler = createScheduler();

  const result = scheduler.injectFault("unknown");

  assert.equal(result, null);
});

test("injectFault returns null for scheduled experiment", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());

  const result = scheduler.injectFault(experiment.experimentId);

  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// autoTerminateIfNeeded tests
// ---------------------------------------------------------------------------

test("autoTerminateIfNeeded returns false for running experiment within duration", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput({ maxDurationMs: 60000 }));
  scheduler.startExperiment(experiment.experimentId);

  const result = scheduler.autoTerminateIfNeeded(experiment.experimentId);

  assert.equal(result, false);
});

test("autoTerminateIfNeeded returns true and cancels when max duration exceeded", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput({ maxDurationMs: 1 })); // 1ms max
  scheduler.startExperiment(experiment.experimentId);

  // Wait for duration to pass
  const start = Date.now();
  while (Date.now() - start < 10) {
    // Busy wait
  }

  const result = scheduler.autoTerminateIfNeeded(experiment.experimentId);

  assert.equal(result, true);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "cancelled");
});

test("autoTerminateIfNeeded returns false for unknown experiment", () => {
  const scheduler = createScheduler();

  const result = scheduler.autoTerminateIfNeeded("unknown");

  assert.equal(result, false);
});

// ---------------------------------------------------------------------------
// validateSteadyState tests
// ---------------------------------------------------------------------------

test("validateSteadyState handles lt operator", () => {
  const scheduler = createScheduler();
  const hypothesis = makeHypothesis({ operator: "lt", tolerance: 0.01 });

  assert.equal(scheduler.validateSteadyState("error_rate", 0.005, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("error_rate", 0.015, hypothesis), false);
});

test("validateSteadyState handles gt operator", () => {
  const scheduler = createScheduler();
  const hypothesis = makeHypothesis({ operator: "gt", tolerance: 100 });

  assert.equal(scheduler.validateSteadyState("latency", 150, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("latency", 50, hypothesis), false);
});

test("validateSteadyState handles eq operator", () => {
  const scheduler = createScheduler();
  const hypothesis = makeHypothesis({ operator: "eq", tolerance: 0 });

  assert.equal(scheduler.validateSteadyState("errors", 0, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("errors", 1, hypothesis), false);
});

test("validateSteadyState handles ne operator", () => {
  const scheduler = createScheduler();
  const hypothesis = makeHypothesis({ operator: "ne", tolerance: 0 });

  assert.equal(scheduler.validateSteadyState("errors", 1, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("errors", 0, hypothesis), false);
});

test("validateSteadyState handles lte operator", () => {
  const scheduler = createScheduler();
  const hypothesis = makeHypothesis({ operator: "lte", tolerance: 0.5 });

  assert.equal(scheduler.validateSteadyState("error_rate", 0.5, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("error_rate", 0.51, hypothesis), false);
});

test("validateSteadyState handles gte operator", () => {
  const scheduler = createScheduler();
  const hypothesis = makeHypothesis({ operator: "gte", tolerance: 0.5 });

  assert.equal(scheduler.validateSteadyState("saturation", 0.5, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("saturation", 0.49, hypothesis), false);
});

// ---------------------------------------------------------------------------
// getExperiment tests
// ---------------------------------------------------------------------------

test("getExperiment returns null for unknown ID", () => {
  const scheduler = createScheduler();

  const result = scheduler.getExperiment("unknown");

  assert.equal(result, null);
});

test("getExperiment returns experiment when exists", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());

  const result = scheduler.getExperiment(experiment.experimentId);

  assert.ok(result != null);
  assert.equal(result!.experimentId, experiment.experimentId);
});

// ---------------------------------------------------------------------------
// listExperiments tests
// ---------------------------------------------------------------------------

test("listExperiments returns all experiments when no status filter", () => {
  const scheduler = createScheduler();
  scheduler.scheduleExperiment(makeExperimentInput({ name: "exp1" }));
  scheduler.scheduleExperiment(makeExperimentInput({ name: "exp2" }));

  const results = scheduler.listExperiments();

  assert.equal(results.length, 2);
});

test("listExperiments filters by status", () => {
  const scheduler = createScheduler();
  const exp1 = scheduler.scheduleExperiment(makeExperimentInput({ name: "exp1" }));
  const exp2 = scheduler.scheduleExperiment(makeExperimentInput({ name: "exp2" }));
  scheduler.startExperiment(exp1.experimentId);

  const running = scheduler.listExperiments("running");
  const scheduled = scheduler.listExperiments("scheduled");

  assert.equal(running.length, 1);
  assert.equal(running[0]!.name, "exp1");
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]!.name, "exp2");
});

// ---------------------------------------------------------------------------
// cancelExperiment tests
// ---------------------------------------------------------------------------

test("cancelExperiment cancels scheduled experiment", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());

  const result = scheduler.cancelExperiment(experiment.experimentId);

  assert.equal(result, true);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "cancelled");
});

test("cancelExperiment cancels running experiment", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);

  const result = scheduler.cancelExperiment(experiment.experimentId);

  assert.equal(result, true);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "cancelled");
});

test("cancelExperiment returns false for completed experiment", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_low", 0.001, true, "passed");

  const result = scheduler.cancelExperiment(experiment.experimentId);

  assert.equal(result, false);
});

test("cancelExperiment returns false for unknown experiment", () => {
  const scheduler = createScheduler();

  const result = scheduler.cancelExperiment("unknown");

  assert.equal(result, false);
});

// ---------------------------------------------------------------------------
// GameDay tests
// ---------------------------------------------------------------------------

test("scheduleGameDay creates game day with experiments", () => {
  const scheduler = createScheduler();
  const input: GameDayScheduleInput = {
    name: "Test GameDay",
    scheduledAt: "2026-04-24T10:00:00.000Z",
    experiments: [makeExperimentInput({ name: "exp1" }), makeExperimentInput({ name: "exp2" })],
  };

  const gameDay = scheduler.scheduleGameDay(input);

  assert.ok(gameDay.gameDayId.startsWith("gameday_"));
  assert.equal(gameDay.name, "Test GameDay");
  assert.equal(gameDay.experimentIds.length, 2);
  assert.equal(gameDay.status, "scheduled");
});

test("startGameDay transitions game day to running and starts all experiments", () => {
  const scheduler = createScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-24T10:00:00.000Z",
    experiments: [makeExperimentInput(), makeExperimentInput()],
  });

  const result = scheduler.startGameDay(gameDay.gameDayId);

  assert.equal(result, true);
  const retrieved = scheduler.getGameDay(gameDay.gameDayId);
  assert.equal(retrieved!.status, "running");
  assert.ok(retrieved!.startedAt != null);
});

test("startGameDay returns false for unknown game day", () => {
  const scheduler = createScheduler();

  const result = scheduler.startGameDay("unknown");

  assert.equal(result, false);
});

test("startGameDay returns false for non-scheduled game day", () => {
  const scheduler = createScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-24T10:00:00.000Z",
    experiments: [makeExperimentInput()],
  });
  scheduler.startGameDay(gameDay.gameDayId);

  const result = scheduler.startGameDay(gameDay.gameDayId);

  assert.equal(result, false);
});

test("refreshGameDayStatus returns null for unknown game day", () => {
  const scheduler = createScheduler();

  const result = scheduler.refreshGameDayStatus("unknown");

  assert.equal(result, null);
});

test("refreshGameDayStatus sets violated when any experiment is violated", () => {
  const scheduler = createScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-24T10:00:00.000Z",
    experiments: [makeExperimentInput()],
  });
  scheduler.startGameDay(gameDay.gameDayId);
  const expId = gameDay.experimentIds[0]!;
  scheduler.recordSteadyStateResult(expId, "error_rate_low", 0.1, false, "failed");

  const result = scheduler.refreshGameDayStatus(gameDay.gameDayId);

  assert.equal(result!.status, "violated");
});

test("refreshGameDayStatus sets completed when all experiments complete", () => {
  const scheduler = createScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-24T10:00:00.000Z",
    experiments: [makeExperimentInput()],
  });
  scheduler.startGameDay(gameDay.gameDayId);
  const expId = gameDay.experimentIds[0]!;
  scheduler.recordSteadyStateResult(expId, "error_rate_low", 0.001, true, "passed");

  const result = scheduler.refreshGameDayStatus(gameDay.gameDayId);

  assert.equal(result!.status, "completed");
});

test("getGameDay returns null for unknown ID", () => {
  const scheduler = createScheduler();

  const result = scheduler.getGameDay("unknown");

  assert.equal(result, null);
});

test("getGameDay returns game day when exists", () => {
  const scheduler = createScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Test GameDay",
    scheduledAt: "2026-04-24T10:00:00.000Z",
    experiments: [makeExperimentInput()],
  });

  const result = scheduler.getGameDay(gameDay.gameDayId);

  assert.ok(result != null);
  assert.equal(result!.gameDayId, gameDay.gameDayId);
});

// ---------------------------------------------------------------------------
// Type tests
// ---------------------------------------------------------------------------

test("SteadyStateHypothesis type accepts valid structure", () => {
  const hypothesis: SteadyStateHypothesis = {
    name: "test_hypothesis",
    metricName: "latency",
    tolerance: 100,
    operator: "lt",
  };

  assert.equal(hypothesis.name, "test_hypothesis");
  assert.equal(hypothesis.operator, "lt");
});

test("ExperimentTarget type accepts all target kinds", () => {
  const targetService: ExperimentTarget = { targetKind: "service", targetId: "s1", labels: {} };
  const targetNode: ExperimentTarget = { targetKind: "node", targetId: "n1", labels: {} };
  const targetNetwork: ExperimentTarget = { targetKind: "network", targetId: "net1", labels: {} };
  const targetDb: ExperimentTarget = { targetKind: "database", targetId: "db1", labels: {} };

  assert.equal(targetService.targetKind, "service");
  assert.equal(targetNode.targetKind, "node");
  assert.equal(targetNetwork.targetKind, "network");
  assert.equal(targetDb.targetKind, "database");
});

test("FaultInjection type accepts all fault types", () => {
  const faultTypes: FaultInjection["faultType"][] = ["latency", "error", "timeout", "packet_loss", "cpu_load", "memory_pressure"];

  for (const ft of faultTypes) {
    const fault: FaultInjection = {
      faultType: ft,
      intensity: 0.5,
      durationMs: 1000,
      parameters: {},
    };
    assert.equal(fault.faultType, ft);
  }
});

test("ChaosExperiment status type accepts all valid statuses", () => {
  const statuses: ChaosExperiment["status"][] = ["scheduled", "running", "completed", "cancelled", "violated"];

  for (const status of statuses) {
    const experiment: ChaosExperiment = {
      experimentId: "test",
      name: "test",
      description: "test",
      target: makeTarget(),
      fault: makeFault(),
      steadyStateHypotheses: [],
      status,
      scheduledAt: "2026-04-24T10:00:00.000Z",
      startedAt: null,
      completedAt: null,
      maxDurationMs: 60000,
      results: [],
    };
    assert.equal(experiment.status, status);
  }
});

test("ChaosGameDay status type accepts all valid statuses", () => {
  const statuses: ChaosGameDay["status"][] = ["scheduled", "running", "completed", "violated"];

  for (const status of statuses) {
    const gameDay: ChaosGameDay = {
      gameDayId: "test",
      name: "test",
      scheduledAt: "2026-04-24T10:00:00.000Z",
      experimentIds: [],
      status,
      startedAt: null,
      completedAt: null,
    };
    assert.equal(gameDay.status, status);
  }
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("scheduleExperiment handles empty description", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput({ description: "" });

  const experiment = scheduler.scheduleExperiment(input);

  assert.equal(experiment.description, "");
});

test("scheduleExperiment handles experiment with no hypotheses", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput({ steadyStateHypotheses: [] });

  const experiment = scheduler.scheduleExperiment(input);

  assert.equal(experiment.steadyStateHypotheses.length, 0);
});

test("recordSteadyStateResult with unknown hypothesis name uses zero tolerance", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "unknown_hypothesis", 0.01, true, "test");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.results[0]!.tolerance, 0);
});

test("listExperiments with status that has no experiments returns empty array", () => {
  const scheduler = createScheduler();
  scheduler.scheduleExperiment(makeExperimentInput());

  const results = scheduler.listExperiments("completed");

  assert.equal(results.length, 0);
});

test("scheduleGameDay with zero experiments creates game day with empty experimentIds", () => {
  const scheduler = createScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Empty GameDay",
    scheduledAt: "2026-04-24T10:00:00.000Z",
    experiments: [],
  });

  assert.equal(gameDay.experimentIds.length, 0);
});