import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateScalingAction,
  HorizontalScalingController,
  type WorkerPoolMetrics,
  type ScalingPolicy,
} from "../../../../../src/platform/shared/scaling/horizontal-scaling-controller.js";
import type { QueueStats } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";

test("evaluateScalingAction scales out when queue depth > threshold and utilization > target", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 80,
    queueDepth: 15,
    avgLatencyMs: 100,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  assert.equal(action.direction, "out");
  assert.equal(action.desiredWorkers, 15); // ceil(10 * 1.5)
});

test("evaluateScalingAction scales out when utilization > 80% with backlog", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 85,
    queueDepth: 8,
    avgLatencyMs: 200,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  assert.equal(action.direction, "out");
  assert.equal(action.desiredWorkers, 12); // 10 + 2
});

test("evaluateScalingAction scales in when utilization < 30% and queue nearly empty", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 3,
    utilizationPercent: 25,
    queueDepth: 2,
    avgLatencyMs: 50,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  assert.equal(action.direction, "in");
  assert.equal(action.desiredWorkers, 7); // floor(10 * 0.7)
});

test("evaluateScalingAction returns none when metrics are acceptable", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 7,
    utilizationPercent: 70,
    queueDepth: 5,
    avgLatencyMs: 100,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  assert.equal(action.direction, "none");
  assert.equal(action.desiredWorkers, 10);
});

test("evaluateScalingAction respects maxWorkers limit on scale out", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 80,
    busyWorkers: 78,
    utilizationPercent: 95,
    queueDepth: 100,
    avgLatencyMs: 500,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  assert.equal(action.direction, "out");
  assert.equal(action.desiredWorkers, 100); // capped at maxWorkers
});

test("HorizontalScalingController emits scale_out event when thresholds exceeded", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test-queue",
    waiting: 20,
    delayed: 5,
    active: 3,
    completed: 100,
    failed: 2,
    deadLetter: 1,
  };
  const workerMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 25,
    avgLatencyMs: 200,
  };
  const event = controller.processMetrics(queueStats, workerMetrics);
  assert.notEqual(event, null);
  assert.equal(event!.eventType, "scale_out");
  assert.equal(event!.action.direction, "out");
});

test("HorizontalScalingController returns null when no scaling needed", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test-queue",
    waiting: 2,
    delayed: 0,
    active: 1,
    completed: 100,
    failed: 0,
    deadLetter: 0,
  };
  const idleMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 3,
    utilizationPercent: 30,
    queueDepth: 2,
    avgLatencyMs: 50,
  };
  const event = controller.processMetrics(queueStats, idleMetrics);
  assert.equal(event, null);
});

test("HorizontalScalingController computes worker count correctly", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test-queue",
    waiting: 20,
    delayed: 5,
    active: 3,
    completed: 100,
    failed: 2,
    deadLetter: 1,
  };
  const count = controller.computeWorkerCount(queueStats, 5);
  assert.equal(count, 6); // ceil((20 + 3) / 5)
});

test("HorizontalScalingController respects minimum worker count", () => {
  const controller = new HorizontalScalingController("test-pool");
  const emptyQueueStats: QueueStats = {
    queueName: "empty",
    waiting: 0,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };
  const count = controller.computeWorkerCount(emptyQueueStats, 5);
  assert.equal(count, 1); // at least 1 worker
});

test("evaluateScalingAction scales in respecting minWorkers", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 3,
    busyWorkers: 1,
    utilizationPercent: 25,
    queueDepth: 1,
    avgLatencyMs: 50,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 2,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  assert.equal(action.direction, "in");
  // floor(3 * 0.7) = 2, but minWorkers is 2
  assert.equal(action.desiredWorkers, 2);
});

test("evaluateScalingAction returns none when queue depth equals threshold", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 7,
    utilizationPercent: 70,
    queueDepth: 10, // exactly at threshold
    avgLatencyMs: 100,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  assert.equal(action.direction, "none");
});

test("HorizontalScalingController processMetrics triggers cooldown on consecutive same-direction scaling", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 5000, // 5 second cooldown
  });

  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 20,
    delayed: 5,
    active: 3,
    completed: 100,
    failed: 2,
    deadLetter: 1,
  };

  const highLoadMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 25,
    avgLatencyMs: 200,
  };

  // First scale out
  const firstEvent = controller.processMetrics(queueStats, highLoadMetrics);
  assert.notEqual(firstEvent, null);
  assert.equal(firstEvent!.eventType, "scale_out");

  // Immediate second scale out should be cooldown
  const secondEvent = controller.processMetrics(queueStats, highLoadMetrics);
  assert.notEqual(secondEvent, null);
  assert.equal(secondEvent!.eventType, "cooldown_active");
  assert.ok(secondEvent!.cooldownRemainingMs !== undefined);
  assert.ok(secondEvent!.cooldownRemainingMs! > 0);
});

test("HorizontalScalingController getScalingState returns correct state", () => {
  const controller = new HorizontalScalingController("test-pool");

  const state = controller.getScalingState();
  assert.equal(state.lastAction, null);
  assert.equal(state.cooldownRemainingMs, 0);

  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 20,
    delayed: 5,
    active: 3,
    completed: 100,
    failed: 2,
    deadLetter: 1,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 25,
    avgLatencyMs: 200,
  };

  controller.processMetrics(queueStats, metrics);

  const stateAfter = controller.getScalingState();
  assert.notEqual(stateAfter.lastAction, null);
  assert.equal(stateAfter.lastAction!.direction, "out");
});

test("evaluateScalingAction high utilization alone does not trigger scale out without backlog", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 3, // below scaleOutThreshold * 0.5
    avgLatencyMs: 200,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  // High utilization alone without backlog should not scale out
  assert.equal(action.direction, "none");
});

test("evaluateScalingAction low queue depth alone does not trigger scale in without low utilization", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 80, // above 30%
    queueDepth: 2, // below scaleInThreshold
    avgLatencyMs: 200,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };
  const action = evaluateScalingAction(metrics, policy);
  assert.equal(action.direction, "none");
});

test("HorizontalScalingController computeWorkerCount with large queue", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "large",
    waiting: 100,
    delayed: 50,
    active: 10,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };
  const count = controller.computeWorkerCount(queueStats, 5);
  // ceil((100 + 10) / 5) = ceil(110/5) = 22
  assert.equal(count, 22);
});

test("HorizontalScalingController processMetrics returns null for no scaling needed", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "stable",
    waiting: 5,
    delayed: 0,
    active: 5,
    completed: 100,
    failed: 0,
    deadLetter: 0,
  };
  const stableMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 5,
    utilizationPercent: 50,
    queueDepth: 5,
    avgLatencyMs: 100,
  };
  const event = controller.processMetrics(queueStats, stableMetrics);
  assert.equal(event, null);
});