import assert from "node:assert/strict";
import test from "node:test";
import { resolveRepoPath } from "../../../helpers/repo-root.js";

import {
  ChaosExperimentScheduler,
  SteadyStateHypothesis,
  BoundaryControl,
  InMemoryChaosExperimentSchedulerRepository,
} from "../../../../src/ops-maturity/chaos/chaos-experiment-scheduler.js";

/**
 * R17-62: Chaos experiment state is purely in-memory and lost on restart
 * R17-72: recordSteadyStateResult terminates after first round - no continuous monitoring
 * R17-63: Blast radius ExperimentTarget has labels but no actual range limiting
 * R17-64: auto-terminate only checks time - assumes violation without auto-rollback/compensation
 * R17-65: injectFault() returns config but doesn't execute actual injection - stub
 */

/**
 * R17-72: Tests for continuous monitoring loop
 */
test("ChaosExperimentScheduler: startContinuousMonitoring evaluates hypotheses on interval", async () => {
  const scheduler = new ChaosExperimentScheduler();
  const hypotheses: SteadyStateHypothesis[] = [
    { name: "latency_hypothesis", metricName: "latency", tolerance: 100, operator: "lt" },
  ];

  const experiment = scheduler.scheduleExperiment({
    name: "Continuous Monitoring Test",
    description: "Testing continuous monitoring",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: hypotheses,
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
  });

  scheduler.startExperiment(experiment.experimentId);

  let evalCount = 0;
  const evaluationResults: Array<{ passed: boolean; measuredValue: number | null; message: string }> = [];

  // Start continuous monitoring with fast interval for testing
  scheduler.startContinuousMonitoring(
    experiment.experimentId,
    100, // 100ms interval for fast test
    async () => {
      evalCount++;
      const result = { passed: true, measuredValue: 50, message: "OK" };
      evaluationResults.push(result);
      return result;
    },
  );

  // Wait for multiple evaluation cycles
  await new Promise((resolve) => setTimeout(resolve, 350));

  // Stop monitoring
  scheduler.stopContinuousMonitoring(experiment.experimentId);

  // Should have evaluated multiple times (at least 3 cycles in 350ms with 100ms interval)
  assert.ok(evalCount >= 3, `Expected at least 3 evaluations, got ${evalCount}`);
});

test("ChaosExperimentScheduler: continuous monitoring stops when experiment ends", async () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Stop Monitoring Test",
    description: "Testing stop on experiment end",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [{ name: "h1", metricName: "m", tolerance: 1, operator: "lt" }],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
  });

  scheduler.startExperiment(experiment.experimentId);

  let evalCount = 0;

  scheduler.startContinuousMonitoring(
    experiment.experimentId,
    50,
    async () => {
      evalCount++;
      // Complete the experiment immediately
      scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 0.5, true, "OK");
      return { passed: true, measuredValue: 0.5, message: "OK" };
    },
  );

  // Wait for at least one evaluation cycle
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Monitoring should have stopped automatically because experiment completed
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.ok(retrieved!.status === "completed" || retrieved!.status === "violated");
});

test("ChaosExperimentScheduler: stopContinuousMonitoring clears interval", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Clear Interval Test",
    description: "Testing interval cleanup",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
  });

  scheduler.startExperiment(experiment.experimentId);

  scheduler.startContinuousMonitoring(experiment.experimentId, 10000, async () => ({
    passed: true,
    measuredValue: null,
    message: "OK",
  }));

  // Stop should clear the interval
  scheduler.stopContinuousMonitoring(experiment.experimentId);

  // After stopping, calling stop again should be safe (no-op)
  scheduler.stopContinuousMonitoring(experiment.experimentId);

  // Verify experiment is still there
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved!.status, "running");
});

/**
 * R17-63: Tests for blast radius range limiting via boundary control
 */
test("ChaosExperimentScheduler: validateBoundaryControl rejects blocked targets", () => {
  const scheduler = new ChaosExperimentScheduler();
  const boundaryControl: Partial<BoundaryControl> = {
    blockedTargets: ["production", "primary"],
  };

  const experiment = scheduler.scheduleExperiment({
    name: "Blocked Target Test",
    description: "Testing blocked target rejection",
    target: { targetKind: "service", targetId: "production-api-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
    boundaryControl,
  });

  // Start should fail due to blocked target
  const result = scheduler.startExperiment(experiment.experimentId);
  assert.equal(result, false);

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "cancelled");
});

test("ChaosExperimentScheduler: validateBoundaryControl rejects target not in allowed list", () => {
  const scheduler = new ChaosExperimentScheduler();
  const boundaryControl: Partial<BoundaryControl> = {
    allowedTargets: ["staging", "development"],
  };

  const experiment = scheduler.scheduleExperiment({
    name: "Allowed Target Test",
    description: "Testing allowed target validation",
    target: { targetKind: "service", targetId: "production-api-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
    boundaryControl,
  });

  // Start should fail because production-api-1 is not in allowed list
  const result = scheduler.startExperiment(experiment.experimentId);
  assert.equal(result, false);

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "cancelled");
});

test("ChaosExperimentScheduler: validateBoundaryControl accepts target in allowed list", () => {
  const scheduler = new ChaosExperimentScheduler();
  const boundaryControl: Partial<BoundaryControl> = {
    allowedTargets: ["staging", "development"],
  };

  const experiment = scheduler.scheduleExperiment({
    name: "Allowed Target Test",
    description: "Testing allowed target acceptance",
    target: { targetKind: "service", targetId: "staging-service-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
    boundaryControl,
  });

  // Start should succeed
  const result = scheduler.startExperiment(experiment.experimentId);
  assert.equal(result, true);

  const retrieved = scheduler.getExperiment(experiment.experimentId);
  assert.equal(retrieved!.status, "running");
});

/**
 * R17-64: Tests for auto-terminate behavior with rollback consideration
 */
test("ChaosExperimentScheduler: autoTerminateIfNeeded cancels expired experiment without rollback", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Auto Terminate Test",
    description: "Testing auto terminate",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 1, // Will expire immediately
  });

  scheduler.startExperiment(experiment.experimentId);

  // Manually set startedAt to the past to trigger expiration
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  retrieved!.startedAt = new Date(Date.now() - 10).toISOString();

  // Auto terminate should trigger
  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);
  assert.equal(terminated, true);

  const finalExp = scheduler.getExperiment(experiment.experimentId);
  assert.equal(finalExp!.status, "cancelled");
});

test("ChaosExperimentScheduler: autoTerminateIfNeeded does not cancel running experiment within duration", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "No Terminate Test",
    description: "Testing no terminate within duration",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 100000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 100000,
  });

  scheduler.startExperiment(experiment.experimentId);

  // Auto terminate should not trigger
  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);
  assert.equal(terminated, false);

  const finalExp = scheduler.getExperiment(experiment.experimentId);
  assert.equal(finalExp!.status, "running");
});

test("ChaosExperimentScheduler: autoTerminateIfNeeded initiates rollback when an applied fault overruns its max duration", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Rollback On Timeout",
    description: "Testing rollback on timeout",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10_000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 1,
  });

  scheduler.startExperiment(experiment.experimentId);
  scheduler.injectFault(experiment.experimentId);
  const retrieved = scheduler.getExperiment(experiment.experimentId);
  retrieved!.startedAt = new Date(Date.now() - 10).toISOString();

  const terminated = scheduler.autoTerminateIfNeeded(experiment.experimentId);
  assert.equal(terminated, true);
  assert.equal(scheduler.getExperiment(experiment.experimentId)?.status, "rollback");
});

/**
 * R17-65: Tests for injectFault behavior
 */
test("ChaosExperimentScheduler: injectFault returns fault config for running experiment", () => {
  let injected = false;
  const scheduler = new ChaosExperimentScheduler({
    faultExecutor: () => {
      injected = true;
      return { applied: true, message: "fault applied" };
    },
  });
  const experiment = scheduler.scheduleExperiment({
    name: "Inject Fault Test",
    description: "Testing injectFault returns config",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 100, durationMs: 5000, parameters: { delay: 200 } },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 60000,
  });

  scheduler.startExperiment(experiment.experimentId);

  const fault = scheduler.injectFault(experiment.experimentId);

  assert.ok(fault !== null);
  assert.equal(injected, true);
  assert.equal(fault!.faultType, "latency");
  assert.equal(fault!.intensity, 100);
  assert.deepEqual(fault!.parameters, { delay: 200 });
  const persisted = scheduler.getExperiment(experiment.experimentId);
  assert.equal(persisted?.faultExecutionStatus, "applied");
  assert.equal(persisted?.faultExecutionMessage, "fault applied");
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

  // Not started
  const fault = scheduler.injectFault(experiment.experimentId);
  assert.equal(fault, null);
});

test("ChaosExperimentScheduler: injectFault returns null for completed experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Completed Test",
    description: "Testing completed experiment",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 100, durationMs: 5000, parameters: {} },
    steadyStateHypotheses: [{ name: "h1", metricName: "m", tolerance: 1, operator: "lt" }],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 60000,
  });

  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 0.5, true, "OK");

  const fault = scheduler.injectFault(experiment.experimentId);
  assert.equal(fault, null);
});

/**
 * R17-62: Tests for steadyStateCache usage (in-memory persistence verification)
 */
test("ChaosExperimentScheduler: cacheSteadyStateMetric stores metric with timestamp", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Cache Test",
    description: "Testing steady state cache",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
  });

  scheduler.cacheSteadyStateMetric(experiment.experimentId, "latency_hypothesis", 42.5);

  const cached = scheduler.getSteadyStateMetric(experiment.experimentId, "latency_hypothesis");
  assert.ok(cached !== null);
  assert.equal(cached!.value, 42.5);
  assert.ok(cached!.timestamp > 0);
});

test("ChaosExperimentScheduler: repository-backed scheduler reloads experiments after restart", () => {
  const repository = new InMemoryChaosExperimentSchedulerRepository();
  const scheduler = new ChaosExperimentScheduler({ repository });
  const experiment = scheduler.scheduleExperiment({
    name: "Persisted",
    description: "Testing snapshot persistence",
    target: { targetKind: "service", targetId: "svc-1", labels: { affected_instances: "1" } },
    fault: { faultType: "latency", intensity: 10, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30_000,
  });

  scheduler.startExperiment(experiment.experimentId);

  const reloaded = new ChaosExperimentScheduler({ repository });
  assert.equal(reloaded.getExperiment(experiment.experimentId)?.status, "running");
});

test("ChaosExperimentScheduler: validateBoundaryControl enforces label-derived blast radius caps", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Blast Radius Cap",
    description: "Testing affected instance cap",
    target: {
      targetKind: "service",
      targetId: "staging-api-1",
      labels: { affected_instances: "3", affected_percent: "15", environment: "staging" },
    },
    fault: { faultType: "latency", intensity: 10, durationMs: 1000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30_000,
    boundaryControl: { maxAffectedInstances: 1, maxAffectedPercent: 5 },
  });

  assert.equal(scheduler.startExperiment(experiment.experimentId), false);
  assert.equal(scheduler.getExperiment(experiment.experimentId)?.status, "cancelled");
});

test("ChaosExperimentScheduler: getSteadyStateMetric returns null for non-existent metric", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Cache Test",
    description: "Testing missing metric",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
  });

  const cached = scheduler.getSteadyStateMetric(experiment.experimentId, "nonexistent");
  assert.equal(cached, null);
});

test("ChaosExperimentScheduler: clearSteadyStateCache removes all metrics for experiment", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Clear Cache Test",
    description: "Testing cache clearing",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
  });

  scheduler.cacheSteadyStateMetric(experiment.experimentId, "h1", 10);
  scheduler.cacheSteadyStateMetric(experiment.experimentId, "h2", 20);

  scheduler.clearSteadyStateCache(experiment.experimentId);

  const cached1 = scheduler.getSteadyStateMetric(experiment.experimentId, "h1");
  const cached2 = scheduler.getSteadyStateMetric(experiment.experimentId, "h2");
  assert.equal(cached1, null);
  assert.equal(cached2, null);
});

test("ChaosExperimentScheduler: clearSteadyStateCache also clears evaluated hypothesis dedupe keys", () => {
  const scheduler = new ChaosExperimentScheduler();
  const experiment = scheduler.scheduleExperiment({
    name: "Clear Dedupe Test",
    description: "Testing evaluated hypothesis reset",
    target: { targetKind: "service", targetId: "svc-1", labels: {} },
    fault: { faultType: "latency", intensity: 50, durationMs: 10000, parameters: {} },
    steadyStateHypotheses: [
      { name: "h1", metric: "latency", expectedRange: { max: 100 }, tolerance: 5 },
      { name: "h2", metric: "errors", expectedRange: { max: 1 }, tolerance: 0 },
    ],
    scheduledAt: "2026-04-20T00:00:00.000Z",
    maxDurationMs: 30000,
  });

  scheduler.startExperiment(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 10, true, "first evaluation");
  scheduler.clearSteadyStateCache(experiment.experimentId);
  scheduler.recordSteadyStateResult(experiment.experimentId, "h1", 12, true, "second evaluation");

  const snapshot = scheduler.getExperiment(experiment.experimentId);
  assert.equal(snapshot?.results.filter((result) => result.steadyStateName === "h1").length, 2);
});

test("ChaosExperimentScheduler: steadyStateCache has richer type with timestamp", async () => {
  const scheduler = new ChaosExperimentScheduler();
  const source = await import("node:fs");
  const text = source.readFileSync(
    resolveRepoPath("src/ops-maturity/chaos/chaos-experiment-scheduler.ts"),
    "utf-8",
  );
  // Verify the cache stores objects with value and timestamp
  assert.ok(text.includes("Map<string, { value: number; timestamp: number }>"));
});
