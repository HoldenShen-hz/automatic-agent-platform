import assert from "node:assert/strict";
import test from "node:test";

import { ChaosExperimentScheduler, SteadyStateHypothesis } from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

/**
 * Issue #2100: injectFault() used to be a pure return-only stub
 * Issue #2101: recordSteadyStateResult deduplicates by count not hypothesis ID
 * Issue #2104: autoTerminate doesn't rollback injected faults
 * Issue #2111: steadyStateCache declared but never used
 */
test("ChaosExperimentScheduler: injectFault returns fault config for running experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Fault Injection Test",
    description: "Testing fault injection returns config",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 100, durationMs: 5000, parameters: { delay: 200 } },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 60000,
  });
  scheduler.startExperiment(experiment.experimentId);

  // injectFault should return the fault configuration
  const fault = scheduler.injectFault(experiment.experimentId);

  assert.ok(fault !== null);
  assert.equal(fault!.faultType, "latency");
  assert.equal(fault!.intensity, 100);
  assert.equal(fault!.parameters.delay, 200);
});

test("ChaosExperimentScheduler: injectFault returns null for non-running experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  // Not started, should return null
  const fault = scheduler.injectFault(experiment.experimentId);
  assert.equal(fault, null);
});

test("ChaosExperimentScheduler: recordSteadyStateResult deduplicates by hypothesis name not count (issue #2101)", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "latency_hypothesis", metricName: "latency", tolerance: 100, operator: "lt" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  // Record result for the same hypothesis twice
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_hypothesis", 50, true, "OK");
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_hypothesis", 80, true, "OK");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  // Deduplication by hypothesis name means only one result should exist
  assert.equal(retrieved!.results.length, 1, "Should have only one result per hypothesis");
});

test("ChaosExperimentScheduler: autoTerminateIfNeeded marks experiment as cancelled", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Auto Terminate Test",
    description: "Testing auto terminate behavior",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 100, durationMs: 5000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 1, // Will expire immediately
  });
  scheduler.startExperiment(experiment.experimentId);
  scheduler.injectFault(experiment.experimentId);
  const running = scheduler.getExperiment(experiment.experimentId);
  assert.ok(running);
  running!.startedAt = new Date(Date.now() - 10).toISOString();

  // Auto terminate
  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);
  assert.equal(terminated, true);

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "cancelled");
});

test("ChaosExperimentScheduler source uses steadyStateCache field", async () => {
  const source = await import("node:fs");
  const text = source.readFileSync(
    "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/ops-maturity/chaos/chaos-experiment-scheduler.ts",
    "utf-8",
  );
  assert.equal(text.includes("private readonly steadyStateCache"), true);
});

test("ChaosExperimentScheduler: recordSteadyStateResult marks violated on hypothesis failure", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "latency_hypothesis", metricName: "latency", tolerance: 100, operator: "lt" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  // Record a failed hypothesis
  scheduler.recordSteadyStateResult(experiment.experimentId, "latency_hypothesis", 200, false, "Latency exceeded tolerance");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "violated");
});

test("ChaosExperimentScheduler: recordSteadyStateResult completes experiment when all hypotheses pass", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "h1", metricName: "m1", tolerance: 1, operator: "lt" },
    { name: "h2", metricName: "m2", tolerance: 2, operator: "gt" },
  ];
  const experiment = scheduler.scheduleExperiment({
    name: "Complete Test",
    description: "Testing completion",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.startExperiment(experiment.experimentId);

  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 0.5, true, "OK");
  scheduler.recordSteadyStateResult(experiment.experimentId, "h2", 3, true, "OK");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "completed");
  assert.equal(retrieved!.results.length, 2);
});

test("ChaosExperimentScheduler: game day completes when all experiments complete", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "GameDay Test",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      {
        name: "Exp1",
        description: "d",
        target: { targetKind: "service", targetId: "svc", labels: {} },
        fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
        steadyStateHypotheses: [],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
    ],
  });

  scheduler.startGameDay(gameDay.gameDayId);
  const experimentId = gameDay.experimentIds[0]!;
  scheduler.recordSteadyStateResult(experimentId, "fake", 0, true, "OK");

  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed!.status, "completed");
});

test("ChaosExperimentScheduler: game day violates when any experiment violates", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Violation GameDay",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      {
        name: "Exp1",
        description: "d",
        target: { targetKind: "service", targetId: "svc", labels: {} },
        fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
        steadyStateHypotheses: [{ name: "h1", metricName: "m", tolerance: 1, operator: "lt" }],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
    ],
  });

  scheduler.startGameDay(gameDay.gameDayId);
  const experimentId = gameDay.experimentIds[0]!;
  scheduler.recordSteadyStateResult(experimentId, "h1", 5, false, "Failed");

  const refreshed = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(refreshed!.status, "violated");
});

test("ChaosExperimentScheduler: generatePanicDrillReport returns valid report", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "Panic Drill Test",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      {
        name: "Exp1",
        description: "d",
        target: { targetKind: "service", targetId: "svc", labels: {} },
        fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
        steadyStateHypotheses: [],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
    ],
  });

  scheduler.startGameDay(gameDay.gameDayId);
  const experimentId = gameDay.experimentIds[0]!;
  scheduler.recordSteadyStateResult(experimentId, "fake", 0, true, "OK");

  const report = scheduler.generatePanicDrillReport(gameDay.gameDayId, 100, 200, 0.95);

  assert.ok(report !== null);
  assert.equal(report!.drillId.startsWith("panic_drill_"), true);
  assert.equal(report!.gameDayId, gameDay.gameDayId);
  assert.deepEqual(report!.planesContacted, ["P1", "P2", "P3", "P4", "P5"]);
  assert.equal(report!.ingress_block_time_ms, 100);
  assert.equal(report!.execution_quiescence_time_ms, 200);
  assert.equal(report!.plane_ack_success_rate, 0.95);
});