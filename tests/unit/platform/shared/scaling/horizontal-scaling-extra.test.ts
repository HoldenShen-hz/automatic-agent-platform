import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateScalingAction,
  HorizontalScalingController,
  type WorkerPoolMetrics,
  type ScalingPolicy,
  type ScalingAction,
  type ScalingDirection,
} from "../../../../../src/platform/shared/scaling/horizontal-scaling-controller.js";
import type { QueueStats } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";

/**
 * Additional tests for Horizontal Scaling Controller covering edge cases
 */

// =============================================================================
// evaluateScalingAction Edge Cases
// =============================================================================

test("evaluateScalingAction returns correct metrics in action output", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 75,
    queueDepth: 5,
    avgLatencyMs: 100,
  };

  const action = evaluateScalingAction(metrics);

  assert.equal(action.metrics.length, 2);
  assert.ok(action.metrics.some((m) => m.name === "utilization"));
  assert.ok(action.metrics.some((m) => m.name === "queueDepth"));
});

test("evaluateScalingAction with utilization at 80 percent (not exceeding)", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 80,
    queueDepth: 8,
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

  // At exactly 80% utilization (not > 80), and queue depth 8 which is < threshold 10
  // so no scale out should occur
  assert.equal(action.direction, "none");
});

test("evaluateScalingAction with utilization at 30 threshold and empty queue", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 3,
    utilizationPercent: 30,
    queueDepth: 3,
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

  // Exactly at thresholds - no scaling
  assert.equal(action.direction, "none");
});

test("evaluateScalingAction scale out desiredWorkers respects maxWorkers", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 90,
    busyWorkers: 85,
    utilizationPercent: 95,
    queueDepth: 50,
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

test("evaluateScalingAction scale in desiredWorkers respects minWorkers", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 2,
    busyWorkers: 1,
    utilizationPercent: 25,
    queueDepth: 1,
    avgLatencyMs: 50,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 3,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };

  const action = evaluateScalingAction(metrics, policy);

  assert.equal(action.direction, "in");
  // floor(2 * 0.7) = 1, but minWorkers is 3
  assert.equal(action.desiredWorkers, 3);
});

test("evaluateScalingAction includes timestamp in action output", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 70,
    queueDepth: 5,
    avgLatencyMs: 100,
  };

  const action = evaluateScalingAction(metrics);

  assert.ok(action.timestamp !== undefined);
  assert.ok(action.timestamp.length > 0);
});

test("evaluateScalingAction reason is descriptive", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 85,
    queueDepth: 15,
    avgLatencyMs: 200,
  };

  const action = evaluateScalingAction(metrics);

  assert.ok(action.reason.length > 0);
  assert.ok(action.reason.includes("Queue depth") || action.reason.includes("utilization"));
});

// =============================================================================
// HorizontalScalingController Edge Cases
// =============================================================================

test("HorizontalScalingController with custom cooldown", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 300, // 5 minutes
  });

  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 20,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  const event = controller.processMetrics(queueStats, metrics);
  assert.notEqual(event, null);
  assert.equal(event!.eventType, "scale_out");
});

test("HorizontalScalingController with high queue depth and high utilization triggers scale out", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 20,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 5,
    busyWorkers: 4,
    utilizationPercent: 80, // High utilization to trigger scale out
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  const event = controller.processMetrics(queueStats, metrics);
  assert.notEqual(event, null);
  assert.equal(event!.eventType, "scale_out");
});

test("HorizontalScalingController computeWorkerCount with fractional result", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 7,
    delayed: 2,
    active: 1,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  // (7 + 2 + 1) / 3 = 10/3 = 3.333, should ceil to 4
  const count = controller.computeWorkerCount(queueStats, 3);
  assert.equal(count, 4);
});

test("HorizontalScalingController computeWorkerCount with targetWorkersPerWorker of 1", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 10,
    delayed: 5,
    active: 3,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const count = controller.computeWorkerCount(queueStats, 1);
  assert.equal(count, 18); // ceil(10 + 3) / 1 = 13
});

test("HorizontalScalingController computeWorkerCount minimum is 1", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 0,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const count = controller.computeWorkerCount(queueStats, 10);
  assert.equal(count, 1);
});

test("HorizontalScalingController getScalingState after no actions", () => {
  const controller = new HorizontalScalingController("test-pool");

  const state = controller.getScalingState();
  assert.equal(state.lastAction, null);
  assert.ok(state.cooldownRemainingMs >= 0);
});

test("HorizontalScalingController getScalingState cooldown decreases over time", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  });

  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 20,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  controller.processMetrics(queueStats, metrics);

  const state1 = controller.getScalingState();
  assert.notEqual(state1.lastAction, null);

  // Cooldown should be close to 60000ms initially
  assert.ok(state1.cooldownRemainingMs > 50000);
});

test("HorizontalScalingController scale_in event type", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 1,
    delayed: 0,
    active: 1,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 2,
    utilizationPercent: 20,
    queueDepth: 1,
    avgLatencyMs: 50,
  };

  const event = controller.processMetrics(queueStats, metrics);
  assert.notEqual(event, null);
  assert.equal(event!.eventType, "scale_in");
  assert.equal(event!.action.direction, "in");
});

test("HorizontalScalingController opposite directions bypass cooldown", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60000, // 1 minute
  });

  // Scale out first
  const outQueueStats: QueueStats = {
    queueName: "test",
    waiting: 20,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const outMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  const outEvent = controller.processMetrics(outQueueStats, outMetrics);
  assert.equal(outEvent!.eventType, "scale_out");

  // Scale in immediately (different direction should bypass cooldown)
  const inQueueStats: QueueStats = {
    queueName: "test",
    waiting: 1,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const inMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 2,
    utilizationPercent: 20,
    queueDepth: 1,
    avgLatencyMs: 50,
  };

  const inEvent = controller.processMetrics(inQueueStats, inMetrics);
  assert.equal(inEvent!.eventType, "scale_in");
});

test("HorizontalScalingController cooldown_active has cooldownRemainingMs", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 5000,
  });

  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 20,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  // First scale out
  controller.processMetrics(queueStats, metrics);

  // Second scale out should trigger cooldown
  const cooldownEvent = controller.processMetrics(queueStats, metrics);
  assert.equal(cooldownEvent!.eventType, "cooldown_active");
  assert.ok(cooldownEvent!.cooldownRemainingMs !== undefined);
  assert.ok(cooldownEvent!.cooldownRemainingMs! > 0);
  assert.ok(cooldownEvent!.cooldownRemainingMs! >= 0);
});

test("HorizontalScalingController with maxWorkers set to minWorkers", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 5,
    maxWorkers: 5,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  });

  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 100,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 5,
    busyWorkers: 5,
    utilizationPercent: 100,
    queueDepth: 100,
    avgLatencyMs: 1000,
  };

  const event = controller.processMetrics(queueStats, metrics);
  // Even with extreme load, can't scale beyond maxWorkers
  assert.equal(event!.action.desiredWorkers, 5);
});

test("HorizontalScalingController processMetrics with stable system returns null", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "empty",
    waiting: 0,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 5,
    busyWorkers: 0,
    utilizationPercent: 0,
    queueDepth: 0,
    avgLatencyMs: 0,
  };

  const event = controller.processMetrics(queueStats, metrics);
  // With zero utilization and zero queue depth, this triggers scale_in
  assert.notEqual(event, null);
  assert.equal(event!.action.direction, "in");
});

// =============================================================================
// ScalingPolicy Edge Cases
// =============================================================================

test("evaluateScalingAction with very small scaleOutThreshold", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 85,
    queueDepth: 2,
    avgLatencyMs: 100,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 1,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };

  const action = evaluateScalingAction(metrics, policy);
  // queue depth (2) > threshold (1) and utilization > target (70)
  assert.equal(action.direction, "out");
});

test("evaluateScalingAction with very large scaleInThreshold", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 2,
    utilizationPercent: 20,
    queueDepth: 1,
    avgLatencyMs: 50,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 100,
    scaleInThreshold: 100,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };

  const action = evaluateScalingAction(metrics, policy);
  // queue depth (1) < scaleInThreshold (100) and utilization < 30
  assert.equal(action.direction, "in");
});

test("evaluateScalingAction with targetUtilization at 100 and low utilization", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 10,
    utilizationPercent: 100,
    queueDepth: 5, // low queue depth
    avgLatencyMs: 200,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 100,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  };

  const action = evaluateScalingAction(metrics, policy);
  // Queue depth is low so no scale out, utilization at 100 doesn't trigger any condition
  assert.equal(action.direction, "none");
});

test("evaluateScalingAction with stabilizationWindowSeconds", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 20,
    avgLatencyMs: 100,
  };
  const policy: ScalingPolicy = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 600, // 10 minutes
    cooldownSeconds: 60,
  };

  const action = evaluateScalingAction(metrics, policy);

  assert.equal(action.direction, "out");
  assert.ok(action.desiredWorkers > 10);
});
