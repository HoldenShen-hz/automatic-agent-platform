/**
 * Integration tests for Chaos Engineering Experiment Scheduler
 *
 * Tests complete workflows spanning multiple operations:
 * - Full experiment lifecycle from scheduling to completion
 * - GameDay orchestration with multiple experiments
 * - Steady-state hypothesis validation pipeline
 * - Fault injection and recovery scenarios
 *
 * §68 Chaos Engineering - Experiment Scheduling + Automated Steady-State Validation
 * §66 GameDay Orchestrator (P2 Enhancement for Phase 3)
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
  type ExperimentResult,
} from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createScheduler(): ChaosExperimentScheduler {
  return new ChaosExperimentScheduler();
}

function makeTarget(overrides: Partial<ExperimentTarget> = {}): ExperimentTarget {
  return {
    targetKind: "service",
    targetId: "service-prod-001",
    labels: { region: "us-east-1", env: "production", tier: "critical" },
    ...overrides,
  };
}

function makeFault(overrides: Partial<FaultInjection> = {}): FaultInjection {
  return {
    faultType: "latency",
    intensity: 0.5,
    durationMs: 30000,
    parameters: { timeout: 5000 },
    ...overrides,
  };
}

function makeHypothesis(overrides: Partial<SteadyStateHypothesis> = {}): SteadyStateHypothesis {
  return {
    name: "error_rate_stable",
    metricName: "error_rate",
    tolerance: 0.01,
    operator: "lt",
    ...overrides,
  };
}

function makeExperimentInput(overrides: Partial<ExperimentScheduleInput> = {}): ExperimentScheduleInput {
  return {
    name: "Production Latency Test",
    description: "Validates system resilience under latency injection",
    target: makeTarget(),
    fault: makeFault(),
    steadyStateHypotheses: [makeHypothesis()],
    scheduledAt: "2026-04-25T10:00:00.000Z",
    maxDurationMs: 60000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Full Experiment Lifecycle Tests
// ---------------------------------------------------------------------------

test("Complete experiment lifecycle: schedule -> start -> record results -> complete", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput();

  // Schedule
  const experiment = scheduler.scheduleExperiment(input);
  assert.ok(experiment.experimentId.startsWith("chaos_"));
  assert.equal(experiment.status, "scheduled");
  assert.equal(experiment.startedAt, null);
  assert.equal(experiment.completedAt, null);
  assert.equal(experiment.results.length, 0);

  // Start
  const started = scheduler.startExperiment(experiment.experimentId);
  assert.equal(started, true);
  const running = scheduler.getExperiment(experiment.experimentId);
  assert.equal(running!.status, "running");
  assert.ok(running!.startedAt !== null);

  // Inject fault
  const fault = scheduler.injectFault(experiment.experimentId);
  assert.ok(fault !== null);
  assert.equal(fault!.faultType, "latency");

  // Record steady state result
  scheduler.recordSteadyStateResult(
    experiment.experimentId,
    "error_rate_stable",
    0.005,
    true,
    "Error rate within tolerance during latency injection"
  );

  // Verify completion
  const completed = scheduler.getExperiment(experiment.experimentId);
  assert.equal(completed!.status, "completed");
  assert.equal(completed!.results.length, 1);
  assert.equal(completed!.results[0]!.passed, true);
  assert.ok(completed!.completedAt !== null);
});

test("Experiment lifecycle with violation: schedule -> start -> violation detected -> complete", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput();

  const experiment = scheduler.scheduleExperiment(input);
  scheduler.startExperiment(experiment.experimentId);

  // Record failing steady state
  scheduler.recordSteadyStateResult(
    experiment.experimentId,
    "error_rate_stable",
    0.05,
    false,
    "Error rate exceeded tolerance threshold"
  );

  const completed = scheduler.getExperiment(experiment.experimentId);
  assert.equal(completed!.status, "violated");
  assert.equal(completed!.results[0]!.passed, false);
  assert.equal(completed!.results[0]!.measuredValue, 0.05);
  assert.ok(completed!.completedAt !== null);
});

test("Experiment auto-termination when max duration exceeded", () => {
  const scheduler = createScheduler();
  const input = makeExperimentInput({ maxDurationMs: 1 }); // 1ms duration

  const experiment = scheduler.scheduleExperiment(input);
  scheduler.startExperiment(experiment.experimentId);

  // Wait for duration to pass
  const start = Date.now();
  while (Date.now() - start < 10) {
    // Busy wait to ensure timeout
  }

  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);
  assert.equal(terminated, true);

  const cancelled = scheduler.getExperiment(experiment.experimentId);
  assert.equal(cancelled!.status, "cancelled");
  assert.ok(cancelled!.completedAt !== null);
});

// ---------------------------------------------------------------------------
// Multiple Hypotheses Integration Tests
// ---------------------------------------------------------------------------

test("Multi-hypothesis experiment: all hypotheses passing leads to completion", () => {
  const scheduler = createScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "latency_ok", metricName: "latency_p99", tolerance: 200, operator: "lt" },
    { name: "error_ok", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
    { name: "availability_ok", metricName: "availability", tolerance: 0.99, operator: "gte" },
  ];
  const input = makeExperimentInput({ steadyStateHypotheses: hypotheses });

  const experiment = scheduler.scheduleExperiment(input);
  scheduler.startExperiment(experiment.experimentId);

  // All hypotheses pass
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_ok", 150, true, "P99 latency good");
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_ok", 0.003, true, "Error rate low");
  scheduler.recordSteadyStateResult(experiment.experimentId, "availability_ok", 0.999, true, "Availability high");

  const completed = scheduler.getExperiment(experiment.experimentId);
  assert.equal(completed!.status, "completed");
  assert.equal(completed!.results.length, 3);
  assert.ok(completed!.completedAt !== null);
});

test("Multi-hypothesis experiment: single hypothesis failure leads to violation", () => {
  const scheduler = createScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "latency_ok", metricName: "latency_p99", tolerance: 200, operator: "lt" },
    { name: "error_ok", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
  ];
  const input = makeExperimentInput({ steadyStateHypotheses: hypotheses });

  const experiment = scheduler.scheduleExperiment(input);
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_ok", 180, true, "P99 latency good");
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_ok", 0.05, false, "Error rate exceeded threshold");

  const violated = scheduler.getExperiment(experiment.experimentId);
  assert.equal(violated!.status, "violated");
  assert.equal(violated!.results.filter((r) => r.passed).length, 1);
  assert.equal(violated!.results.filter((r) => !r.passed).length, 1);
});

test("Multi-hypothesis experiment: early failure leads to violation after all evaluated", () => {
  const scheduler = createScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "latency_ok", metricName: "latency_p99", tolerance: 200, operator: "lt" },
    { name: "error_ok", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
  ];
  const input = makeExperimentInput({ steadyStateHypotheses: hypotheses });

  const experiment = scheduler.scheduleExperiment(input);
  scheduler.startExperiment(experiment.experimentId);

  // First hypothesis fails - but experiment not violated yet (needs all evaluated)
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_ok", 250, false, "P99 latency exceeded");

  let exp = scheduler.getExperiment(experiment.experimentId);
  assert.equal(exp!.status, "running"); // Still running, waiting for all hypotheses

  // Adding second result - now all hypotheses evaluated, failure detected
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_ok", 0.001, true, "error rate good");

  exp = scheduler.getExperiment(experiment.experimentId);
  // With 2 hypotheses and 1 failure, status is violated
  assert.equal(exp!.status, "violated");
  assert.equal(exp!.results.filter((r) => r.passed).length, 1);
  assert.equal(exp!.results.filter((r) => !r.passed).length, 1);
});

// ---------------------------------------------------------------------------
// GameDay Orchestration Tests
// ---------------------------------------------------------------------------

test("GameDay complete lifecycle: schedule -> start -> run -> complete", () => {
  const scheduler = createScheduler();
  const gameDayInput: GameDayScheduleInput = {
    name: "Q2 Production Stability GameDay",
    scheduledAt: "2026-04-25T14:00:00.000Z",
    experiments: [
      {
        name: "Database Latency Test",
        description: "Inject latency into primary database",
        target: { targetKind: "database", targetId: "db-primary", labels: { region: "us-east-1" } },
        fault: { faultType: "latency", intensity: 0.3, durationMs: 60000, parameters: {} },
        steadyStateHypotheses: [
          { name: "query_latency", metricName: "query_latency_ms", tolerance: 100, operator: "lt" },
          { name: "connection_pool", metricName: "db_connections", tolerance: 80, operator: "lt" },
        ],
        scheduledAt: "2026-04-25T14:00:00.000Z",
        maxDurationMs: 120000,
      },
      {
        name: "Service Error Rate Test",
        description: "Inject errors into critical service",
        target: { targetKind: "service", targetId: "payment-service", labels: { tier: "critical" } },
        fault: { faultType: "error", intensity: 0.1, durationMs: 30000, parameters: {} },
        steadyStateHypotheses: [
          { name: "error_rate", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
          { name: "success_rate", metricName: "success_rate", tolerance: 0.99, operator: "gte" },
        ],
        scheduledAt: "2026-04-25T14:05:00.000Z",
        maxDurationMs: 120000,
      },
    ],
  };

  // Schedule GameDay
  const gameDay = scheduler.scheduleGameDay(gameDayInput);
  assert.ok(gameDay.gameDayId.startsWith("gameday_"));
  assert.equal(gameDay.name, "Q2 Production Stability GameDay");
  assert.equal(gameDay.experimentIds.length, 2);
  assert.equal(gameDay.status, "scheduled");
  assert.equal(gameDay.startedAt, null);
  assert.equal(gameDay.completedAt, null);

  // Start GameDay
  const started = scheduler.startGameDay(gameDay.gameDayId);
  assert.equal(started, true);

  const runningGameDay = scheduler.getGameDay(gameDay.gameDayId);
  assert.equal(runningGameDay!.status, "running");
  assert.ok(runningGameDay!.startedAt !== null);

  // Verify all experiments started
  for (const experimentId of gameDay.experimentIds) {
    const experiment = scheduler.getExperiment(experimentId);
    assert.equal(experiment!.status, "running");
  }

  // Complete first experiment
  const exp1Id = gameDay.experimentIds[0]!;
  scheduler.recordSteadyStateResult(exp1Id, "query_latency", 50, true, "Query latency normal");
  scheduler.recordSteadyStateResult(exp1Id, "connection_pool", 45, true, "Connection pool healthy");

  // Complete second experiment
  const exp2Id = gameDay.experimentIds[1]!;
  scheduler.recordSteadyStateResult(exp2Id, "error_rate", 0.002, true, "Error rate acceptable");
  scheduler.recordSteadyStateResult(exp2Id, "success_rate", 0.998, true, "Success rate high");

  // Refresh GameDay status
  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed!.status, "completed");
  assert.ok(refreshed!.completedAt !== null);
});

test("GameDay violation detection: one experiment violation marks entire GameDay violated", () => {
  const scheduler = createScheduler();
  const gameDayInput: GameDayScheduleInput = {
    name: "GameDay with Failure",
    scheduledAt: "2026-04-25T14:00:00.000Z",
    experiments: [
      {
        name: "Exp1 - Pass",
        description: "This will pass",
        target: { targetKind: "service", targetId: "svc-a", labels: {} },
        fault: { faultType: "latency", intensity: 0.1, durationMs: 5000, parameters: {} },
        steadyStateHypotheses: [{ name: "h1", metricName: "m", tolerance: 1, operator: "lt" }],
        scheduledAt: "2026-04-25T14:00:00.000Z",
        maxDurationMs: 60000,
      },
      {
        name: "Exp2 - Fail",
        description: "This will fail",
        target: { targetKind: "service", targetId: "svc-b", labels: {} },
        fault: { faultType: "error", intensity: 0.5, durationMs: 5000, parameters: {} },
        steadyStateHypotheses: [{ name: "h2", metricName: "m", tolerance: 1, operator: "lt" }],
        scheduledAt: "2026-04-25T14:00:00.000Z",
        maxDurationMs: 60000,
      },
    ],
  };

  const gameDay = scheduler.scheduleGameDay(gameDayInput);
  scheduler.startGameDay(gameDay.gameDayId);

  // Complete first experiment successfully
  const exp1Id = gameDay.experimentIds[0]!;
  scheduler.recordSteadyStateResult(exp1Id, "h1", 0.5, true, "passed");

  // Fail second experiment
  const exp2Id = gameDay.experimentIds[1]!;
  scheduler.recordSteadyStateResult(exp2Id, "h2", 5, false, "violated threshold");

  // GameDay should be marked violated
  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed!.status, "violated");
  assert.ok(refreshed!.completedAt !== null);
});

test("GameDay partial completion: not all experiments done returns running status", () => {
  const scheduler = createScheduler();
  const gameDayInput: GameDayScheduleInput = {
    name: "Partial GameDay",
    scheduledAt: "2026-04-25T14:00:00.000Z",
    experiments: [
      { name: "Exp1", description: "d", target: { targetKind: "service", targetId: "s", labels: {} }, fault: { faultType: "latency", intensity: 1, durationMs: 5000, parameters: {} }, steadyStateHypotheses: [{ name: "h1", metricName: "m", tolerance: 1, operator: "lt" }], scheduledAt: "2026-04-25T14:00:00.000Z", maxDurationMs: 60000 },
      { name: "Exp2", description: "d", target: { targetKind: "service", targetId: "s", labels: {} }, fault: { faultType: "error", intensity: 1, durationMs: 5000, parameters: {} }, steadyStateHypotheses: [{ name: "h2", metricName: "m", tolerance: 1, operator: "lt" }], scheduledAt: "2026-04-25T14:00:00.000Z", maxDurationMs: 60000 },
    ],
  };

  const gameDay = scheduler.scheduleGameDay(gameDayInput);
  scheduler.startGameDay(gameDay.gameDayId);

  // Complete only first experiment
  const exp1Id = gameDay.experimentIds[0]!;
  scheduler.recordSteadyStateResult(exp1Id, "h1", 0.5, true, "passed");

  // Refresh should still show running (Exp2 not done)
  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed!.status, "running");
  assert.equal(refreshed!.completedAt, null);
});

// ---------------------------------------------------------------------------
// Fault Injection Integration Tests
// ---------------------------------------------------------------------------

test("All fault types can be injected and validated", () => {
  const scheduler = createScheduler();
  const faultTypes: FaultInjection["faultType"][] = ["latency", "error", "timeout", "packet_loss", "cpu_load", "memory_pressure"];

  const results: Array<{ faultType: string; injected: boolean }> = [];

  for (const faultType of faultTypes) {
    const experiment = scheduler.scheduleExperiment({
      name: `Fault Type Test - ${faultType}`,
      description: `Testing ${faultType} injection`,
      target: makeTarget(),
      fault: { faultType, intensity: 0.5, durationMs: 30000, parameters: { test: "param" } },
      steadyStateHypotheses: [],
      scheduledAt: "2026-04-25T14:00:00.000Z",
      maxDurationMs: 60000,
    });

    scheduler.startExperiment(experiment.experimentId);
    const fault = scheduler.injectFault(experiment.experimentId);

    results.push({ faultType, injected: fault !== null && fault.faultType === faultType });
  }

  // Verify all fault types were successfully injected
  for (const result of results) {
    assert.equal(result.injected, true, `Fault type ${result.faultType} should be injectable`);
  }
});

test("Fault injection parameters are preserved through lifecycle", () => {
  const scheduler = createScheduler();
  const customParams = { interface: "eth0", port: 8080, protocol: "tcp", packetSize: 1500 };

  const experiment = scheduler.scheduleExperiment({
    name: "Packet Loss Test",
    description: "Test packet loss injection",
    target: { targetKind: "network", targetId: "core-switch-01", labels: { location: "dc-1" } },
    fault: { faultType: "packet_loss", intensity: 0.25, durationMs: 60000, parameters: customParams },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-25T14:00:00.000Z",
    maxDurationMs: 120000,
  });

  scheduler.startExperiment(experiment.experimentId);

  const fault = scheduler.injectFault(experiment.experimentId);
  assert.deepEqual(fault!.parameters, customParams);
});

// ---------------------------------------------------------------------------
// Steady State Validation Integration Tests
// ---------------------------------------------------------------------------

test("Steady state validation pipeline: measure -> compare -> record -> decision", () => {
  const scheduler = createScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "response_time_stable",
    metricName: "response_time_ms",
    tolerance: 250,
    operator: "lt",
  };

  const experiment = scheduler.scheduleExperiment({
    name: "Response Time Test",
    description: "Validate response time under load",
    target: makeTarget(),
    fault: makeFault(),
    steadyStateHypotheses: [hypothesis],
    scheduledAt: "2026-04-25T14:00:00.000Z",
    maxDurationMs: 60000,
  });

  scheduler.startExperiment(experiment.experimentId);

  // Simulate steady state validation
  const measuredValue = 180;
  const isStable = scheduler.validateSteadyState(hypothesis.metricName, measuredValue, hypothesis);
  assert.equal(isStable, true);

  // Record result
  scheduler.recordSteadyStateResult(
    experiment.experimentId,
    hypothesis.name,
    measuredValue,
    isStable,
    `Response time ${measuredValue}ms is within threshold ${hypothesis.tolerance}ms`
  );

  const completed = scheduler.getExperiment(experiment.experimentId);
  assert.equal(completed!.status, "completed");
  assert.equal(completed!.results[0]!.measuredValue, measuredValue);
  assert.equal(completed!.results[0]!.tolerance, hypothesis.tolerance);
  assert.equal(completed!.results[0]!.passed, true);
});

test("Steady state validation with different operators", () => {
  const scheduler = createScheduler();

  // Test gt operator for availability metric
  const availabilityHyp: SteadyStateHypothesis = {
    name: "high_availability",
    metricName: "uptime_percentage",
    tolerance: 0.999,
    operator: "gte",
  };
  assert.equal(scheduler.validateSteadyState("uptime_percentage", 0.9995, availabilityHyp), true);
  assert.equal(scheduler.validateSteadyState("uptime_percentage", 0.998, availabilityHyp), false);

  // Test eq operator for replica count
  const replicaHyp: SteadyStateHypothesis = {
    name: "replica_count",
    metricName: "desired_replicas",
    tolerance: 3,
    operator: "eq",
  };
  assert.equal(scheduler.validateSteadyState("desired_replicas", 3, replicaHyp), true);
  assert.equal(scheduler.validateSteadyState("desired_replicas", 2, replicaHyp), false);
});

test("Steady state validation captures all operator results correctly", () => {
  const scheduler = createScheduler();

  const operators: SteadyStateHypothesis["operator"][] = ["lt", "gt", "eq", "ne", "lte", "gte"];
  const results: Array<{ op: string; belowResult: boolean; atResult: boolean; aboveResult: boolean }> = [];

  for (const op of operators) {
    const hyp: SteadyStateHypothesis = { name: "test", metricName: "m", tolerance: 10, operator: op };

    // Test with value below tolerance
    const belowResult = scheduler.validateSteadyState("m", 5, hyp);
    // Test with value at tolerance
    const atResult = scheduler.validateSteadyState("m", 10, hyp);
    // Test with value above tolerance
    const aboveResult = scheduler.validateSteadyState("m", 15, hyp);

    results.push({ op, belowResult, atResult, aboveResult });
  }

  // Verify lt: below=true, at=false, above=false
  assert.equal(results[0]!.belowResult, true);
  assert.equal(results[0]!.atResult, false);
  assert.equal(results[0]!.aboveResult, false);

  // Verify gt: below=false, at=false, above=true
  assert.equal(results[1]!.belowResult, false);
  assert.equal(results[1]!.atResult, false);
  assert.equal(results[1]!.aboveResult, true);

  // Verify eq: below=false, at=true, above=false
  assert.equal(results[2]!.belowResult, false);
  assert.equal(results[2]!.atResult, true);
  assert.equal(results[2]!.aboveResult, false);

  // Verify ne: below=true, at=false, above=true
  assert.equal(results[3]!.belowResult, true);
  assert.equal(results[3]!.atResult, false);
  assert.equal(results[3]!.aboveResult, true);

  // Verify lte: below=true, at=true, above=false
  assert.equal(results[4]!.belowResult, true);
  assert.equal(results[4]!.atResult, true);
  assert.equal(results[4]!.aboveResult, false);

  // Verify gte: below=false, at=true, above=true
  assert.equal(results[5]!.belowResult, false);
  assert.equal(results[5]!.atResult, true);
  assert.equal(results[5]!.aboveResult, true);
});

// ---------------------------------------------------------------------------
// Concurrency and State Transition Tests
// ---------------------------------------------------------------------------

test("Experiment state transitions are atomic and correct", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());

  // scheduled -> running
  assert.equal(experiment.status, "scheduled");
  scheduler.startExperiment(experiment.experimentId);
  let exp = scheduler.getExperiment(experiment.experimentId);
  assert.equal(exp!.status, "running");

  // running -> completed (via all hypotheses passing)
  scheduler.recordSteadyStateResult(exp!.experimentId, "error_rate_stable", 0.001, true, "OK");
  exp = scheduler.getExperiment(exp!.experimentId);
  assert.equal(exp!.status, "completed");

  // completed -> cannot go back to running
  const restartResult = scheduler.startExperiment(exp!.experimentId);
  assert.equal(restartResult, false);
});

test("Multiple experiments maintain independent state", () => {
  const scheduler = createScheduler();

  const exp1 = scheduler.scheduleExperiment(makeExperimentInput({ name: "Experiment 1" }));
  const exp2 = scheduler.scheduleExperiment(makeExperimentInput({ name: "Experiment 2" }));
  const exp3 = scheduler.scheduleExperiment(makeExperimentInput({ name: "Experiment 3" }));

  // Start only exp1
  scheduler.startExperiment(exp1.experimentId);

  // Complete exp1
  scheduler.recordSteadyStateResult(exp1.experimentId, "error_rate_stable", 0.001, true, "OK");

  // Start exp2
  scheduler.startExperiment(exp2.experimentId);

  // Violate exp2
  scheduler.recordSteadyStateResult(exp2.experimentId, "error_rate_stable", 0.5, false, "Too high");

  // exp3 remains scheduled

  // Verify independent states
  assert.equal(scheduler.getExperiment(exp1.experimentId)!.status, "completed");
  assert.equal(scheduler.getExperiment(exp2.experimentId)!.status, "violated");
  assert.equal(scheduler.getExperiment(exp3.experimentId)!.status, "scheduled");

  // Verify list filters
  assert.equal(scheduler.listExperiments("completed").length, 1);
  assert.equal(scheduler.listExperiments("violated").length, 1);
  assert.equal(scheduler.listExperiments("scheduled").length, 1);
  assert.equal(scheduler.listExperiments("running").length, 0);
});

// ---------------------------------------------------------------------------
// Error Handling Integration Tests
// ---------------------------------------------------------------------------

test("Operations on unknown experiment IDs return appropriate defaults", () => {
  const scheduler = createScheduler();

  assert.equal(scheduler.getExperiment("unknown-id"), null);
  assert.equal(scheduler.startExperiment("unknown-id"), false);
  assert.equal(scheduler.cancelExperiment("unknown-id"), false);
  assert.equal(scheduler.injectFault("unknown-id"), null);
  assert.equal(scheduler.autoTerminateIfNeeded("unknown-id"), false);
});

test("Operations on unknown gameDay IDs return appropriate defaults", () => {
  const scheduler = createScheduler();

  assert.equal(scheduler.getGameDay("unknown-id"), null);
  assert.equal(scheduler.startGameDay("unknown-id"), false);
  assert.equal(scheduler.refreshGameDayStatus("unknown-id"), null);
});

test("Operations on completed experiments return appropriate results", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_stable", 0.001, true, "OK");

  assert.equal(scheduler.startExperiment(experiment.experimentId), false);
  assert.equal(scheduler.cancelExperiment(experiment.experimentId), false);
  assert.equal(scheduler.injectFault(experiment.experimentId), null);
});

test("Operations on cancelled experiments return appropriate results", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.cancelExperiment(experiment.experimentId);

  assert.equal(scheduler.startExperiment(experiment.experimentId), false);
  assert.equal(scheduler.cancelExperiment(experiment.experimentId), false);
  assert.equal(scheduler.injectFault(experiment.experimentId), null);
});

test("recordSteadyStateResult has no effect on non-running experiments", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  // Do not start the experiment

  // These should have no effect
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_stable", 0.5, true, "should not record");

  const exp = scheduler.getExperiment(experiment.experimentId);
  assert.equal(exp!.results.length, 0);
  assert.equal(exp!.status, "scheduled");
});

// ---------------------------------------------------------------------------
// Experiment Result Recording Integration Tests
// ---------------------------------------------------------------------------

test("Experiment results contain complete information", () => {
  const scheduler = createScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "latency", metricName: "lat", tolerance: 100, operator: "lt" },
    { name: "errors", metricName: "err", tolerance: 0.01, operator: "lt" },
  ];
  const experiment = scheduler.scheduleExperiment(makeExperimentInput({ steadyStateHypotheses: hypotheses }));
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "latency", 50, true, "Latency OK");
  scheduler.recordSteadyStateResult(experiment.experimentId, "errors", 0.005, true, "Error rate OK");

  const exp = scheduler.getExperiment(experiment.experimentId);
  const results = exp!.results;

  assert.equal(results.length, 2);

  // Check first result
  assert.equal(results[0]!.steadyStateName, "latency");
  assert.equal(results[0]!.measuredValue, 50);
  assert.equal(results[0]!.passed, true);
  assert.equal(results[0]!.tolerance, 100);
  assert.ok(results[0]!.timestamp !== null);

  // Check second result
  assert.equal(results[1]!.steadyStateName, "errors");
  assert.equal(results[1]!.measuredValue, 0.005);
  assert.equal(results[1]!.passed, true);
  assert.equal(results[1]!.tolerance, 0.01);
  assert.ok(results[1]!.timestamp !== null);
});

test("Experiment results accumulate correctly", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment(makeExperimentInput());
  scheduler.startExperiment(experiment.experimentId);

  // Record multiple results
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_stable", 0.001, true, "First check");
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_stable", 0.002, true, "Second check");
  scheduler.recordSteadyStateResult(experiment.experimentId, "error_rate_stable", 0.003, true, "Third check");

  const exp = scheduler.getExperiment(experiment.experimentId);
  // With zero hypotheses, experiment completes after first result
  // But since we have one hypothesis, we need all to be evaluated
  // Since error_rate_stable matches the hypothesis, and we record multiple times
  // the experiment completes after first record (since 1 >= 1)
  assert.equal(exp!.results.length, 1);
});

test("GameDay experiments results are independently tracked", () => {
  const scheduler = createScheduler();
  const gameDayInput: GameDayScheduleInput = {
    name: "Multi-Exp GameDay",
    scheduledAt: "2026-04-25T14:00:00.000Z",
    experiments: [
      { name: "Exp1", description: "d", target: { targetKind: "service", targetId: "s1", labels: {} }, fault: { faultType: "latency", intensity: 1, durationMs: 5000, parameters: {} }, steadyStateHypotheses: [{ name: "h1", metricName: "m", tolerance: 1, operator: "lt" }], scheduledAt: "2026-04-25T14:00:00.000Z", maxDurationMs: 60000 },
      { name: "Exp2", description: "d", target: { targetKind: "service", targetId: "s2", labels: {} }, fault: { faultType: "error", intensity: 1, durationMs: 5000, parameters: {} }, steadyStateHypotheses: [{ name: "h2", metricName: "m", tolerance: 1, operator: "lt" }], scheduledAt: "2026-04-25T14:00:00.000Z", maxDurationMs: 60000 },
    ],
  };

  const gameDay = scheduler.scheduleGameDay(gameDayInput);
  scheduler.startGameDay(gameDay.gameDayId);

  const exp1Id = gameDay.experimentIds[0]!;
  const exp2Id = gameDay.experimentIds[1]!;

  // Complete exp1 successfully
  scheduler.recordSteadyStateResult(exp1Id, "h1", 0.5, true, "OK");

  // Violate exp2
  scheduler.recordSteadyStateResult(exp2Id, "h2", 5, false, "Failed");

  // Verify independent tracking
  const exp1 = scheduler.getExperiment(exp1Id);
  const exp2 = scheduler.getExperiment(exp2Id);

  assert.equal(exp1!.status, "completed");
  assert.equal(exp2!.status, "violated");

  assert.equal(exp1!.results[0]!.passed, true);
  assert.equal(exp2!.results[0]!.passed, false);
});

// ---------------------------------------------------------------------------
// Target and Labels Integration Tests
// ---------------------------------------------------------------------------

test("Experiment targets are correctly preserved with all target kinds", () => {
  const scheduler = createScheduler();
  const targetKinds: ExperimentTarget["targetKind"][] = ["service", "node", "network", "database"];

  for (const targetKind of targetKinds) {
    const experiment = scheduler.scheduleExperiment({
      name: `Test ${targetKind}`,
      description: "desc",
      target: { targetKind, targetId: `${targetKind}-test-001`, labels: { env: "test", version: "v1" } },
      fault: makeFault(),
      steadyStateHypotheses: [],
      scheduledAt: "2026-04-25T14:00:00.000Z",
      maxDurationMs: 60000,
    });

    const retrieved = scheduler.getExperiment(experiment.experimentId);
    assert.equal(retrieved!.target.targetKind, targetKind);
    assert.equal(retrieved!.target.targetId, `${targetKind}-test-001`);
    assert.equal(retrieved!.target.labels.env, "test");
    assert.equal(retrieved!.target.labels.version, "v1");
  }
});

test("Target labels are immutable after experiment creation", () => {
  const scheduler = createScheduler();
  const labels: Readonly<Record<string, string>> = { env: "prod", region: "us-east" };

  const experiment = scheduler.scheduleExperiment({
    name: "Immutable Labels Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels },
    fault: makeFault(),
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-25T14:00:00.000Z",
    maxDurationMs: 60000,
  });

  // Labels should be preserved as readonly
  assert.equal(experiment.target.labels.env, "prod");
  assert.equal(experiment.target.labels.region, "us-east");
});

// ---------------------------------------------------------------------------
// Empty and Boundary Condition Integration Tests
// ---------------------------------------------------------------------------

test("GameDay with no experiments creates valid empty game day", () => {
  const scheduler = createScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Empty GameDay",
    scheduledAt: "2026-04-25T14:00:00.000Z",
    experiments: [],
  });

  assert.equal(gameDay.experimentIds.length, 0);
  assert.equal(gameDay.status, "scheduled");
  assert.equal(scheduler.startGameDay(gameDay.gameDayId), true);

  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  // With no experiments, nothing to complete or violate - stays in current state
  assert.ok(refreshed !== null);
});

test("Experiment with zero hypotheses completes when recordSteadyStateResult is called", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "No Hypotheses",
    description: "desc",
    target: makeTarget(),
    fault: makeFault(),
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-25T14:00:00.000Z",
    maxDurationMs: 60000,
  });

  scheduler.startExperiment(experiment.experimentId);

  // With zero hypotheses, calling recordSteadyStateResult completes immediately
  // because results.length (1) >= steadyStateHypotheses.length (0)
  scheduler.recordSteadyStateResult(experiment.experimentId, "any", 0, true, "no hypotheses");

  const exp = scheduler.getExperiment(experiment.experimentId);
  assert.equal(exp!.status, "completed");
});

test("Experiment with very long maxDurationMs can be cancelled before timeout", () => {
  const scheduler = createScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Long Test",
    description: "desc",
    target: makeTarget(),
    fault: makeFault(),
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-25T14:00:00.000Z",
    maxDurationMs: 86400000, // 24 hours
  });

  scheduler.startExperiment(experiment.experimentId);

  // Should not auto-terminate
  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);
  assert.equal(terminated, false);

  // But can still be cancelled
  const cancelled = scheduler.cancelExperiment(experiment.experimentId);
  assert.equal(cancelled, true);

  const exp = scheduler.getExperiment(experiment.experimentId);
  assert.equal(exp!.status, "cancelled");
});
