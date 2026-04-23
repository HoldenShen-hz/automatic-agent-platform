import assert from "node:assert/strict";
import test from "node:test";

import { ChaosExperimentScheduler, SteadyStateHypothesis } from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

test("ChaosExperimentScheduler.getExperiment returns null for unknown id", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.getExperiment("unknown-id");
  assert.equal(result, null);
});

test("ChaosExperimentScheduler.getGameDay returns null for unknown id", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.getGameDay("unknown-id");
  assert.equal(result, null);
});

test("ChaosExperimentScheduler.validateSteadyState evaluates eq correctly", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "replicas",
    metricName: "replica_count",
    tolerance: 3,
    operator: "eq",
  };

  assert.equal(scheduler.validateSteadyState("replica_count", 3, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("replica_count", 2, hypothesis), false);
  assert.equal(scheduler.validateSteadyState("replica_count", 4, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState evaluates ne correctly", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "state",
    metricName: "connection_count",
    tolerance: 0,
    operator: "ne",
  };

  assert.equal(scheduler.validateSteadyState("connection_count", 1, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("connection_count", 0, hypothesis), false);
});

test("ChaosExperimentScheduler.validateSteadyState evaluates gte correctly", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypothesis: SteadyStateHypothesis = {
    name: "availability",
    metricName: "uptime_ratio",
    tolerance: 0.999,
    operator: "gte",
  };

  assert.equal(scheduler.validateSteadyState("uptime_ratio", 0.999, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("uptime_ratio", 1.0, hypothesis), true);
  assert.equal(scheduler.validateSteadyState("uptime_ratio", 0.998, hypothesis), false);
});

test("ChaosExperimentScheduler.startGameDay returns false for unknown gameDayId", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.startGameDay("unknown-gameday-id");
  assert.equal(result, false);
});

test("ChaosExperimentScheduler.startGameDay returns false for non-scheduled gameDay", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "test-gameday",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [],
  });
  scheduler.startGameDay(gameDay.gameDayId);

  const result = scheduler.startGameDay(gameDay.gameDayId);
  assert.equal(result, false);
});

test("ChaosExperimentScheduler.refreshGameDayStatus returns null for unknown gameDayId", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.refreshGameDayStatus("unknown-id");
  assert.equal(result, null);
});

test("ChaosExperimentScheduler.refreshGameDayStatus marks violated when any experiment violates", () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "h1", metricName: "m1", tolerance: 1, operator: "lt" },
  ];
  const gameDay = scheduler.scheduleGameDay({
    name: "test-gameday",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      {
        name: "exp1",
        description: "desc",
        target: { targetKind: "service", targetId: "svc", labels: {} },
        fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
        steadyStateHypotheses: hypotheses,
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
    ],
  });

  scheduler.startGameDay(gameDay.gameDayId);
  const running = scheduler.getGameDay(gameDay.gameDayId)!;
  scheduler.recordSteadyStateResult(running.experimentIds[0]!, "h1", 5, false, "Breached");

  const result = scheduler.refreshGameDayStatus(gameDay.gameDayId);
  assert.equal(result?.status, "violated");
  assert.ok(result?.completedAt !== null);
});

test("ChaosExperimentScheduler.scheduleGameDay with multiple experiments each with multiple hypotheses", () => {
  const scheduler = new ChaosExperimentScheduler();
  const gameDay = scheduler.scheduleGameDay({
    name: "multi-experiment-gameday",
    scheduledAt: "2026-04-20T00:00:00.000Z",
    experiments: [
      {
        name: "latency-exp",
        description: "latency test",
        target: { targetKind: "service", targetId: "svc-a", labels: {} },
        fault: { faultType: "latency", intensity: 50, durationMs: 3000, parameters: {} },
        steadyStateHypotheses: [
          { name: "latency_ok", metricName: "latency_p99", tolerance: 200, operator: "lt" },
          { name: "error_ok", metricName: "error_rate", tolerance: 0.01, operator: "lt" },
        ],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
      {
        name: "error-exp",
        description: "error test",
        target: { targetKind: "service", targetId: "svc-b", labels: {} },
        fault: { faultType: "error", intensity: 10, durationMs: 2000, parameters: {} },
        steadyStateHypotheses: [
          { name: "error_rate_ok", metricName: "error_rate", tolerance: 0.05, operator: "lt" },
          { name: "availability_ok", metricName: "availability", tolerance: 0.99, operator: "gte" },
        ],
        scheduledAt: "2026-04-20T00:00:00.000Z",
        maxDurationMs: 5000,
      },
    ],
  });

  assert.equal(gameDay.experimentIds.length, 2);
  assert.equal(gameDay.status, "scheduled");

  const exp1 = scheduler.getExperiment(gameDay.experimentIds[0]!)!;
  const exp2 = scheduler.getExperiment(gameDay.experimentIds[1]!)!;
  assert.equal(exp1.steadyStateHypotheses.length, 2);
  assert.equal(exp2.steadyStateHypotheses.length, 2);
});

test("ChaosExperimentScheduler.cancelExperiment returns false for unknown experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.cancelExperiment("unknown-id");
  assert.equal(result, false);
});

test("ChaosExperimentScheduler.listExperiments returns all when no status filter", () => {
  const scheduler = new ChaosExperimentScheduler();
  scheduler.scheduleExperiment({
    name: "Exp1",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });
  scheduler.scheduleExperiment({
    name: "Exp2",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "error", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  const all = scheduler.listExperiments();
  const scheduled = scheduler.listExperiments("scheduled");
  const running = scheduler.listExperiments("running");
  const completed = scheduler.listExperiments("completed");

  assert.equal(all.length, 2);
  assert.equal(scheduled.length, 2);
  assert.equal(running.length, 0);
  assert.equal(completed.length, 0);
});

test("ChaosExperimentScheduler.recordSteadyStateResult ignores non-running experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Test",
    description: "desc",
    target: { targetKind: "service", targetId: "svc", labels: {} },
    fault: { faultType: "latency", intensity: 1, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [{ name: "h", metricName: "m", tolerance: 1, operator: "lt" }],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 5000,
  });

  // Don't start the experiment, try to record result
  scheduler.recordSteadyStateResult(experiment.experimentId, "h", 0.5, true, "OK");

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.deepEqual(retrieved?.results, []);
});

test("ChaosExperimentScheduler.injectFault returns null for unknown experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.injectFault("unknown-id");
  assert.equal(result, null);
});

test("ChaosExperimentScheduler.autoTerminateIfNeeded returns false for unknown experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const result = scheduler.autoTerminateIfNeeded("unknown-id");
  assert.equal(result, false);
});

test("ChaosExperimentScheduler.autoTerminateIfNeeded returns false for non-running experiment", () => {
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

  const result = scheduler.autoTerminateIfNeeded(experiment.experimentId);
  assert.equal(result, false);
});

test("ChaosExperimentScheduler.cancelExperiment cancels running experiment", () => {
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
  scheduler.startExperiment(experiment.experimentId);

  const result = scheduler.cancelExperiment(experiment.experimentId);

  assert.equal(result, true);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved?.status, "cancelled");
});
