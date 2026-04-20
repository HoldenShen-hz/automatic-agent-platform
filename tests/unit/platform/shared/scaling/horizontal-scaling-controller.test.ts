import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateScalingAction,
  HorizontalScalingController,
  type WorkerPoolMetrics,
  type ScalingPolicy,
} from "../../../../../../src/platform/shared/scaling/horizontal-scaling-controller.js";
import type { QueueStats } from "../../../../../../src/platform/execution/queue/queue-adapter-types.js";

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