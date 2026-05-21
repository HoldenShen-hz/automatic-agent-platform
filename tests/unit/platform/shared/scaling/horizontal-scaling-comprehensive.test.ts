import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateScalingAction,
  HorizontalScalingController,
  type WorkerPoolMetrics,
  type ScalingPolicy,
  type ScalingAction,
  type ScalingDirection,
  type ScalingMetric,
  type ScalingPolicy,
  type HPAEvent,
} from "../../../../../src/platform/shared/scaling/horizontal-scaling-controller.js";
import type { QueueStats } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

/**
 * Comprehensive tests for HorizontalScalingController - horizontal-scaling-controller.ts
 * Automatic scaling strategy with HPA-style scaling decisions
 */

// =============================================================================
// evaluateScalingAction - Core Scaling Logic
// =============================================================================

test("evaluateScalingAction scale out when queue depth > threshold and utilization > target", () => {
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
  assert.ok(action.desiredWorkers > 10);
});

test("evaluateScalingAction scale out with utilization > 80% and backlog > threshold/2", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 85,
    queueDepth: 8, // > threshold * 0.5 = 5
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

test("evaluateScalingAction scale in when utilization < 30% and queue < scaleInThreshold", () => {
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
  assert.ok(action.desiredWorkers < 10);
});

test("evaluateScalingAction no action when metrics within acceptable range", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 7,
    utilizationPercent: 70,
    queueDepth: 5,
    avgLatencyMs: 100,
  };

  const action = evaluateScalingAction(metrics);

  assert.equal(action.direction, "none");
  assert.equal(action.desiredWorkers, 10);
});

test("evaluateScalingAction at exact thresholds returns none", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 7,
    utilizationPercent: 70,
    queueDepth: 10, // exactly at scaleOutThreshold
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

test("evaluateScalingAction scale out respects maxWorkers", () => {
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
  assert.equal(action.desiredWorkers, 100); // capped
});

test("evaluateScalingAction scale in respects minWorkers", () => {
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
  assert.equal(action.desiredWorkers, 2); // floor(3*0.7) = 2, but minWorkers = 2
});

test("evaluateScalingAction no scale out with high utilization alone", () => {
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

  assert.equal(action.direction, "none");
});

test("evaluateScalingAction no scale in with low queue alone", () => {
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

// =============================================================================
// evaluateScalingAction - Action Output Details
// =============================================================================

test("evaluateScalingAction returns descriptive reason", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 20,
    avgLatencyMs: 200,
  };

  const action = evaluateScalingAction(metrics);

  assert.ok(action.reason !== undefined);
  assert.ok(action.reason.length > 0);
  assert.ok(
    action.reason.includes("Queue depth") ||
    action.reason.includes("utilization") ||
    action.reason.includes("acceptable")
  );
});

test("evaluateScalingAction includes metrics in output", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 75,
    queueDepth: 5,
    avgLatencyMs: 100,
  };

  const action = evaluateScalingAction(metrics);

  assert.ok(action.metrics !== undefined);
  assert.ok(action.metrics.length === 2);
  assert.ok(action.metrics.some((m) => m.name === "utilization"));
  assert.ok(action.metrics.some((m) => m.name === "queueDepth"));
});

test("evaluateScalingAction includes timestamp in output", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 75,
    queueDepth: 5,
    avgLatencyMs: 100,
  };

  const action = evaluateScalingAction(metrics);

  assert.ok(action.timestamp !== undefined);
  assert.ok(action.timestamp.length > 0);
});

test("evaluateScalingAction metrics contain current and target values", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 80,
    queueDepth: 15,
    avgLatencyMs: 100,
  };

  const action = evaluateScalingAction(metrics);

  const utilizationMetric = action.metrics.find((m) => m.name === "utilization");
  assert.ok(utilizationMetric !== undefined);
  assert.equal(utilizationMetric.current, 80);
  assert.equal(utilizationMetric.target, 70); // from default policy

  const queueMetric = action.metrics.find((m) => m.name === "queueDepth");
  assert.ok(queueMetric !== undefined);
  assert.equal(queueMetric.current, 15);
  assert.equal(queueMetric.target, 10); // from default policy
});

// =============================================================================
// HorizontalScalingController - processMetrics
// =============================================================================

test("HorizontalScalingController emits scale_out event when thresholds exceeded", () => {
  const controller = new HorizontalScalingController("test-pool");
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

  const event = controller.processMetrics(queueStats, metrics);

  assert.ok(event !== null);
  assert.equal(event!.eventType, "scale_out");
  assert.equal(event!.workerPool, "test-pool");
  assert.equal(event!.action.direction, "out");
});

test("HorizontalScalingController emits scale_in event when utilization and queue are low", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 1,
    delayed: 0,
    active: 1,
    completed: 100,
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

  assert.ok(event !== null);
  assert.equal(event!.eventType, "scale_in");
  assert.equal(event!.action.direction, "in");
});

test("HorizontalScalingController returns null when no scaling needed", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 5,
    delayed: 0,
    active: 2,
    completed: 100,
    failed: 0,
    deadLetter: 0,
  };
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 5,
    utilizationPercent: 50,
    queueDepth: 5,
    avgLatencyMs: 75,
  };

  const event = controller.processMetrics(queueStats, metrics);

  assert.equal(event, null);
});

test("HorizontalScalingController cooldown prevents same-direction scaling", () => {
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

  // First scale out - should succeed
  const first = controller.processMetrics(queueStats, metrics);
  assert.ok(first !== null);
  assert.equal(first!.eventType, "scale_out");

  // Second scale out immediately after - should be cooldown
  const second = controller.processMetrics(queueStats, metrics);
  assert.ok(second !== null);
  assert.equal(second!.eventType, "cooldown_active");
  assert.ok(second!.cooldownRemainingMs !== undefined);
  assert.ok(second!.cooldownRemainingMs! > 0);
});

test("HorizontalScalingController opposite direction bypasses cooldown", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60000, // 1 minute cooldown
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

  // Scale in immediately (different direction) - should succeed
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

test("HorizontalScalingController after cooldown expires scaling works again", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 100, // 100ms cooldown for testing
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

  // Wait for cooldown
  setTimeoutSync(150);

  // Should be able to scale out again
  const event = controller.processMetrics(queueStats, metrics);
  assert.ok(event !== null);
  assert.equal(event!.eventType, "scale_out");
});

// =============================================================================
// HorizontalScalingController - computeWorkerCount
// =============================================================================

test("HorizontalScalingController computeWorkerCount calculates correctly", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 20,
    delayed: 5,
    active: 3,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const count = controller.computeWorkerCount(queueStats, 5);

  // ceil((20 + 5 + 3) / 5) = ceil(28 / 5) = 6
  assert.equal(count, 6);
});

test("HorizontalScalingController computeWorkerCount returns minimum of 1", () => {
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

  const count = controller.computeWorkerCount(queueStats, 5);

  assert.equal(count, 1);
});

test("HorizontalScalingController computeWorkerCount with custom targetWorkersPerWorker", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 30,
    delayed: 10,
    active: 5,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const count = controller.computeWorkerCount(queueStats, 10);

  // ceil((30 + 10 + 5) / 10) = ceil(45 / 10) = 5
  assert.equal(count, 5);
});

test("HorizontalScalingController computeWorkerCount with target of 1", () => {
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

  // ceil(18 / 1) = 18
  assert.equal(count, 18);
});

// =============================================================================
// HorizontalScalingController - getScalingState
// =============================================================================

test("HorizontalScalingController getScalingState returns initial null state", () => {
  const controller = new HorizontalScalingController("test-pool");

  const state = controller.getScalingState();

  assert.equal(state.lastAction, null);
  assert.ok(state.cooldownRemainingMs >= 0);
});

test("HorizontalScalingController getScalingState reflects last action", () => {
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
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 90,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  controller.processMetrics(queueStats, metrics);

  const state = controller.getScalingState();

  assert.ok(state.lastAction !== null);
  assert.equal(state.lastAction!.direction, "out");
});

// =============================================================================
// HorizontalScalingController - Edge Cases
// =============================================================================

test("HorizontalScalingController with minWorkers equals maxWorkers", () => {
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

  assert.ok(event !== null);
  assert.equal(event!.action.desiredWorkers, 5);
  assert.equal(event!.action.direction, "out");
});

test("HorizontalScalingController with zero queue depth and zero utilization", () => {
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

  assert.ok(event !== null);
  assert.equal(event!.action.direction, "in");
});

test("HorizontalScalingController with very small scaleOutThreshold", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 1,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  });

  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 5,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  };

  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 85,
    queueDepth: 5,
    avgLatencyMs: 100,
  };

  const event = controller.processMetrics(queueStats, metrics);

  assert.ok(event !== null);
  assert.equal(event!.action.direction, "out");
});

test("HorizontalScalingController with very large scaleInThreshold", () => {
  const controller = new HorizontalScalingController("test-pool", {
    scaleOutThreshold: 100,
    scaleInThreshold: 100,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
  });

  const queueStats: QueueStats = {
    queueName: "test",
    waiting: 1,
    delayed: 0,
    active: 0,
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

  assert.ok(event !== null);
  assert.equal(event!.action.direction, "in");
});

// Helper function for testing setTimeout
function setTimeoutSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy wait for synchronous testing
  }
}
