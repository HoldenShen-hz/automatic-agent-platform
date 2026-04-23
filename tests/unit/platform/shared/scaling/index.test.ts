import test from "node:test";
import assert from "node:assert/strict";
import {
  HorizontalScalingController,
  evaluateScalingAction,
  type ScalingMetric,
  type WorkerPoolMetrics,
  type ScalingPolicy,
  type ScalingAction,
  type HPAEvent,
  type ScalingDirection,
} from "../../../../../src/platform/shared/scaling/horizontal-scaling-controller.js";
import {
  ResourceQuota,
  createResourceQuota,
  canAllocate,
  calculateBurstCapacity,
  inheritQuota,
  DEFAULT_RESOURCE_ALLOCATION,
  type ResourceAllocation,
  type QuotaUsage,
  type QuotaAllocationResult,
} from "../../../../../src/platform/shared/scaling/resource-quota.js";
import {
  PriorityScheduler,
  PRIORITY_CLASSES,
  canPreempt,
  findTaskToPreempt,
  parseTimeoutToMs,
  hasExceededTimeout,
  type PriorityClass,
  type PriorityClassName,
  type QueuedTask,
  type PreemptionDecision,
} from "../../../../../src/platform/shared/scaling/priority-scheduler.js";
import {
  FairScheduler,
  type SchedulingTenant,
  type BorrowedResources,
  type SchedulingDecision,
} from "../../../../../src/platform/shared/scaling/fair-scheduler.js";

/**
 * Tests for src/platform/shared/scaling/index.ts
 * Exercises horizontal-scaling-controller, resource-quota, priority-scheduler, fair-scheduler
 */

// =============================================================================
// HorizontalScalingController Tests
// =============================================================================

test("HorizontalScalingController - scale out when queue depth and utilization exceed thresholds", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats = { queueName: "test", waiting: 20, delayed: 5, active: 3, completed: 0, failed: 0, deadLetter: 0 };
  const workerMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 80,
    queueDepth: 25,
    avgLatencyMs: 100,
  };

  const event = controller.processMetrics(queueStats, workerMetrics);

  assert.ok(event !== null);
  assert.strictEqual(event!.eventType, "scale_out");
  assert.strictEqual(event!.workerPool, "test-pool");
  assert.strictEqual(event!.action.direction, "out");
  assert.ok(event!.action.desiredWorkers > 10);
});

test("HorizontalScalingController - scale in when utilization and queue depth are low", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats = { queueName: "test", waiting: 1, delayed: 0, active: 1, completed: 0, failed: 0, deadLetter: 0 };
  const workerMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 2,
    utilizationPercent: 20,
    queueDepth: 2,
    avgLatencyMs: 50,
  };

  const event = controller.processMetrics(queueStats, workerMetrics);

  assert.ok(event !== null);
  assert.strictEqual(event!.eventType, "scale_in");
  assert.strictEqual(event!.action.direction, "in");
  assert.ok(event!.action.desiredWorkers < 10);
});

test("HorizontalScalingController - returns null when metrics within acceptable range", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats = { queueName: "test", waiting: 5, delayed: 0, active: 2, completed: 0, failed: 0, deadLetter: 0 };
  const workerMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 5,
    utilizationPercent: 50,
    queueDepth: 7,
    avgLatencyMs: 75,
  };

  const event = controller.processMetrics(queueStats, workerMetrics);

  assert.strictEqual(event, null);
});

test("HorizontalScalingController - computeWorkerCount calculates replicas from queue depth", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats = { queueName: "test", waiting: 25, delayed: 5, active: 5, completed: 0, failed: 0, deadLetter: 0 };

  const count = controller.computeWorkerCount(queueStats, 5);

  assert.strictEqual(count, 7); // ceil(35 / 5)
});

test("HorizontalScalingController - getScalingState returns last action and cooldown", () => {
  const controller = new HorizontalScalingController("test-pool");
  const queueStats = { queueName: "test", waiting: 20, delayed: 0, active: 0, completed: 0, failed: 0, deadLetter: 0 };
  const workerMetrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 8,
    utilizationPercent: 80,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  controller.processMetrics(queueStats, workerMetrics);
  const state = controller.getScalingState();

  assert.ok(state.lastAction !== null);
  assert.ok(state.cooldownRemainingMs >= 0);
});

test("evaluateScalingAction - scale out triggers correctly", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 9,
    utilizationPercent: 85,
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

  assert.strictEqual(action.direction, "out");
  assert.ok(action.desiredWorkers >= 10);
});

test("evaluateScalingAction - returns no action when metrics are normal", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 5,
    utilizationPercent: 50,
    queueDepth: 5,
    avgLatencyMs: 75,
  };

  const action = evaluateScalingAction(metrics);

  assert.strictEqual(action.direction, "none");
  assert.strictEqual(action.desiredWorkers, 10);
});

// =============================================================================
// ResourceQuota Tests
// =============================================================================

test("createResourceQuota - creates quota with default values", () => {
  const quota = createResourceQuota("org-1");

  assert.strictEqual(quota.orgNodeId, "org-1");
  assert.deepStrictEqual(quota.guaranteed, DEFAULT_RESOURCE_ALLOCATION);
  assert.deepStrictEqual(quota.burstable, DEFAULT_RESOURCE_ALLOCATION);
  assert.deepStrictEqual(quota.maxLimit, DEFAULT_RESOURCE_ALLOCATION);
});

test("createResourceQuota - applies overrides correctly", () => {
  const quota = createResourceQuota("org-2", {
    guaranteed: { maxConcurrentWorkflows: 20 },
    maxLimit: { llmTokensPerMinute: 50000 },
  });

  assert.strictEqual(quota.orgNodeId, "org-2");
  assert.strictEqual(quota.guaranteed.maxConcurrentWorkflows, 20);
  assert.strictEqual(quota.maxLimit.llmTokensPerMinute, 50000);
});

test("canAllocate - admits when within guaranteed limits", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 1000,
    llmRequestsUsedLastMinute: 10,
  };
  const requested: Partial<ResourceAllocation> = { maxConcurrentWorkflows: 2 };

  const result = canAllocate(quota, usage, requested);

  assert.strictEqual(result.admitted, true);
  assert.ok(result.reason.includes("Within quota"));
});

test("canAllocate - rejects when exceeding max limit", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 9,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 10000,
    llmRequestsUsedLastMinute: 60,
  };
  const requested: Partial<ResourceAllocation> = { maxConcurrentWorkflows: 5 };

  const result = canAllocate(quota, usage, requested);

  assert.strictEqual(result.admitted, false);
  assert.strictEqual(result.rejectedDueTo, "maxConcurrentWorkflows");
});

test("canAllocate - rejects when exceeding burstable but within max", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 8,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 10000,
    llmRequestsUsedLastMinute: 60,
  };
  const requested: Partial<ResourceAllocation> = { maxConcurrentWorkflows: 5 };

  const result = canAllocate(quota, usage, requested);

  assert.strictEqual(result.admitted, false);
  assert.ok(result.reason.includes("burstable"));
});

test("calculateBurstCapacity - calculates idle burst capacity", () => {
  const quota = createResourceQuota("org-1");
  const usage: QuotaUsage = {
    orgNodeId: "org-1",
    activeWorkflows: 5,
    activeWorkers: 2,
    llmTokensUsedLastMinute: 2000,
    llmRequestsUsedLastMinute: 20,
  };

  const burst = calculateBurstCapacity(quota, usage);

  assert.ok(burst.maxConcurrentWorkflows >= 0);
  assert.ok(burst.llmTokensPerMinute >= 0);
});

test("inheritQuota - scales parent quota by ratio", () => {
  const parent = createResourceQuota("parent-org");
  parent.guaranteed.maxConcurrentWorkflows = 20;
  parent.burstable.maxConcurrentWorkflows = 30;
  parent.maxLimit.maxConcurrentWorkflows = 40;

  const child = inheritQuota(parent, 0.5);

  assert.strictEqual(child.guaranteed.maxConcurrentWorkflows, 10);
  assert.strictEqual(child.burstable.maxConcurrentWorkflows, 15);
  assert.strictEqual(child.maxLimit.maxConcurrentWorkflows, 20);
  assert.strictEqual(child.orgNodeId, "");
});

// =============================================================================
// PriorityScheduler Tests
// =============================================================================

test("PriorityScheduler - enqueue and dequeue respects priority order", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({ taskId: "low", priorityClass: "best_effort", enqueuedAt: Date.now() - 100, canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "high", priorityClass: "high", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "critical", priorityClass: "critical", enqueuedAt: Date.now() + 100, canBePreempted: true, requestedResources: {} });

  const first = scheduler.dequeue(1);

  assert.strictEqual(first!.taskId, "critical");
});

test("PriorityScheduler - dequeue returns null when queue is empty", () => {
  const scheduler = new PriorityScheduler();

  const result = scheduler.dequeue(1);

  assert.strictEqual(result, null);
});

test("PriorityScheduler - complete removes task from running", () => {
  const scheduler = new PriorityScheduler();
  scheduler.enqueue({ taskId: "task-1", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });

  const task = scheduler.dequeue(1);
  assert.ok(task);

  scheduler.complete("task-1");
  const stats = scheduler.getStats();

  assert.strictEqual(stats.totalRunning, 0);
});

test("PriorityScheduler - tick updates wait times", () => {
  const scheduler = new PriorityScheduler();
  const beforeTick = Date.now() - 5000;
  scheduler.enqueue({ taskId: "task-1", priorityClass: "standard", enqueuedAt: beforeTick, canBePreempted: true, requestedResources: {} });

  scheduler.tick();
  const stats = scheduler.getStats();

  assert.ok(stats.oldestTaskWaitMs >= 5000);
});

test("PriorityScheduler - starvation prevention upgrades long-waiting tasks", () => {
  const scheduler = new PriorityScheduler(30 * 60 * 1000); // 30 min threshold
  const oldTime = Date.now() - (31 * 60 * 1000); // 31 min ago
  scheduler.enqueue({ taskId: "old-task", priorityClass: "background", enqueuedAt: oldTime, canBePreempted: true, requestedResources: {} });

  scheduler.tick();
  const stats = scheduler.getStats();

  assert.ok(stats.byPriority.high > 0 || stats.byPriority.background === 0);
});

test("PriorityScheduler - getQueueDepthByPriority returns correct counts", () => {
  const scheduler = new PriorityScheduler();
  scheduler.enqueue({ taskId: "t1", priorityClass: "critical", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "t2", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "t3", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });

  const counts = scheduler.getQueueDepthByPriority();

  assert.strictEqual(counts.critical, 1);
  assert.strictEqual(counts.standard, 2);
  assert.strictEqual(counts.high, 0);
});

test("canPreempt - critical can preempt any non-critical", () => {
  const preemptor: QueuedTask = {
    taskId: "high-priority",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };
  const target: QueuedTask = {
    taskId: "low-priority",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);

  assert.strictEqual(decision.shouldPreempt, true);
  assert.strictEqual(decision.preemptedTaskId, "low-priority");
});

test("canPreempt - cannot preempt critical tasks", () => {
  const preemptor: QueuedTask = {
    taskId: "high-priority",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };
  const target: QueuedTask = {
    taskId: "critical-task",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);

  assert.strictEqual(decision.shouldPreempt, false);
  assert.ok(decision.reason!.includes("Cannot preempt critical"));
});

test("canPreempt - returns false when preemptor has preemption_policy=never", () => {
  const preemptor: QueuedTask = {
    taskId: "task-1",
    priorityClass: "background",
    priorityValue: 200,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };
  const target: QueuedTask = {
    taskId: "task-2",
    priorityClass: "best_effort",
    priorityValue: 0,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);

  assert.strictEqual(decision.shouldPreempt, false);
});

test("parseTimeoutToMs - parses time strings correctly", () => {
  assert.strictEqual(parseTimeoutToMs("30s"), 30000);
  assert.strictEqual(parseTimeoutToMs("5m"), 300000);
  assert.strictEqual(parseTimeoutToMs("1h"), 3600000);
  assert.strictEqual(parseTimeoutToMs("1d"), 86400000);
  assert.strictEqual(parseTimeoutToMs("∞"), Infinity);
});

test("hasExceededTimeout - returns true when task waited beyond timeout", () => {
  const task: QueuedTask = {
    taskId: "task-1",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now() - (10 * 60 * 1000), // 10 min ago
    waitedMs: 10 * 60 * 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const exceeded = hasExceededTimeout(task);

  assert.strictEqual(exceeded, true); // standard queueTimeout is 5m
});

test("PRIORITY_CLASSES - contains all required priority classes", () => {
  assert.ok(PRIORITY_CLASSES.critical);
  assert.ok(PRIORITY_CLASSES.high);
  assert.ok(PRIORITY_CLASSES.standard);
  assert.ok(PRIORITY_CLASSES.background);
  assert.ok(PRIORITY_CLASSES.best_effort);

  assert.strictEqual(PRIORITY_CLASSES.critical.priorityValue, 1000);
  assert.strictEqual(PRIORITY_CLASSES.best_effort.priorityValue, 0);
});

// =============================================================================
// FairScheduler Tests
// =============================================================================

test("FairScheduler - registerTenant and admitTask workflow", () => {
  const scheduler = new FairScheduler(DEFAULT_RESOURCE_ALLOCATION);
  scheduler.registerTenant("tenant-1", 1.0, DEFAULT_RESOURCE_ALLOCATION);

  const decision = scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 1 });

  assert.strictEqual(decision.admitted, true);
  assert.strictEqual(decision.tenantId, "tenant-1");
  assert.deepStrictEqual(decision.allocatedResources, { maxConcurrentWorkflows: 1 });
});

test("FairScheduler - rejects task from unregistered tenant", () => {
  const scheduler = new FairScheduler(DEFAULT_RESOURCE_ALLOCATION);

  const decision = scheduler.admitTask("unknown-tenant", "task-1", { maxConcurrentWorkflows: 1 });

  assert.strictEqual(decision.admitted, false);
  assert.ok(decision.waitReason!.includes("not registered"));
});

test("FairScheduler - releaseResources updates usage", () => {
  const scheduler = new FairScheduler(DEFAULT_RESOURCE_ALLOCATION);
  scheduler.registerTenant("tenant-1", 1.0, DEFAULT_RESOURCE_ALLOCATION);
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 2 });

  scheduler.releaseResources("tenant-1", { maxConcurrentWorkflows: 1 });

  const stats = scheduler.getTenantStats("tenant-1");
  assert.ok(stats);
  assert.strictEqual(stats.used.maxConcurrentWorkflows, 1);
});

test("FairScheduler - unregisterTenant removes tenant", () => {
  const scheduler = new FairScheduler(DEFAULT_RESOURCE_ALLOCATION);
  scheduler.registerTenant("tenant-1", 1.0, DEFAULT_RESOURCE_ALLOCATION);
  scheduler.unregisterTenant("tenant-1");

  const decision = scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 1 });

  assert.strictEqual(decision.admitted, false);
});

test("FairScheduler - getTenantStats returns correct utilization", () => {
  const scheduler = new FairScheduler(DEFAULT_RESOURCE_ALLOCATION);
  scheduler.registerTenant("tenant-1", 1.0, DEFAULT_RESOURCE_ALLOCATION);
  scheduler.admitTask("tenant-1", "task-1", { maxConcurrentWorkflows: 5, maxConcurrentWorkers: 2 });

  const stats = scheduler.getTenantStats("tenant-1");

  assert.ok(stats);
  assert.strictEqual(stats.used.maxConcurrentWorkflows, 5);
  assert.strictEqual(stats.used.maxConcurrentWorkers, 2);
  assert.ok(stats.utilizationPercent >= 0);
});

test("FairScheduler - getAllUtilization returns all tenants", () => {
  const scheduler = new FairScheduler(DEFAULT_RESOURCE_ALLOCATION);
  scheduler.registerTenant("tenant-1", 1.0, DEFAULT_RESOURCE_ALLOCATION);
  scheduler.registerTenant("tenant-2", 1.5, DEFAULT_RESOURCE_ALLOCATION);

  const utilization = scheduler.getAllUtilization();

  assert.strictEqual(utilization.length, 2);
});

test("FairScheduler - getTenantStats returns null for unknown tenant", () => {
  const scheduler = new FairScheduler(DEFAULT_RESOURCE_ALLOCATION);

  const stats = scheduler.getTenantStats("unknown");

  assert.strictEqual(stats, null);
});
