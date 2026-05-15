/**
 * @fileoverview Scaling Integration Tests
 *
 * Verifies end-to-end scaling behavior including:
 * - ResourceQuota: org-level resource allocation with guaranteed/burstable/maxLimit
 * - PriorityScheduler: 5-level priority classes with preemption support
 * - FairScheduler: Weighted Fair Queuing with borrowing and reclaim
 * - HorizontalScalingController: automatic scaling based on queue/worker metrics
 *
 * @see src/platform/shared/scaling/
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createResourceQuota,
  canAllocate,
  calculateBurstCapacity,
  inheritQuota,
  type ResourceQuota,
  type ResourceAllocation,
  type QuotaUsage,
} from "../../../../../src/platform/shared/scaling/resource-quota.js";

import {
  PriorityScheduler,
  PRIORITY_CLASSES,
  canPreempt,
  findTaskToPreempt,
  parseTimeoutToMs,
  hasExceededTimeout,
  type QueuedTask,
  type PriorityClassName,
} from "../../../../../src/platform/shared/scaling/priority-scheduler.js";

import {
  FairScheduler,
  type SchedulingTenant,
} from "../../../../../src/platform/shared/scaling/fair-scheduler.js";

import {
  HorizontalScalingController,
  evaluateScalingAction,
  type WorkerPoolMetrics,
  type ScalingPolicy,
} from "../../../../../src/platform/shared/scaling/horizontal-scaling-controller.js";

import type { QueueStats } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

// ── Resource Quota Tests ──────────────────────────────────────────────────────

test("ResourceQuota: createResourceQuota returns valid quota with defaults", () => {
  const quota = createResourceQuota("org-1");

  assert.equal(quota.orgNodeId, "org-1");
  assert.equal(quota.guaranteed.maxConcurrentWorkflows, 10);
  assert.equal(quota.guaranteed.maxConcurrentWorkers, 5);
  assert.equal(quota.guaranteed.llmTokensPerMinute, 10000);
  assert.equal(quota.guaranteed.llmRequestsPerMinute, 60);

  // All tiers should have same defaults initially
  assert.deepEqual(quota.guaranteed, quota.burstable);
  assert.deepEqual(quota.guaranteed, quota.maxLimit);
});

test("ResourceQuota: createResourceQuota applies overrides correctly", () => {
  const quota = createResourceQuota("org-2", {
    guaranteed: { maxConcurrentWorkflows: 20 },
    burstable: { maxConcurrentWorkers: 10 },
    maxLimit: { llmTokensPerMinute: 50000 },
  });

  assert.equal(quota.guaranteed.maxConcurrentWorkflows, 20);
  assert.equal(quota.burstable.maxConcurrentWorkers, 10);
  assert.equal(quota.maxLimit.llmTokensPerMinute, 50000);

  // Unchanged values should still be defaults
  assert.equal(quota.guaranteed.maxConcurrentWorkers, 5);
  assert.equal(quota.burstable.maxConcurrentWorkflows, 10);
});

test("ResourceQuota: canAllocate admits when within guaranteed limits", () => {
  const quota = createResourceQuota("org-test");
  const usage: QuotaUsage = {
    orgNodeId: "org-test",
    activeWorkflows: 2,
    activeWorkers: 1,
    llmTokensUsedLastMinute: 1000,
    llmRequestsUsedLastMinute: 10,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 5 });

  assert.equal(result.admitted, true);
  assert.ok(result.reason.includes("Within quota limits"));
});

test("ResourceQuota: canAllocate rejects when exceeding maxLimit", () => {
  const quota = createResourceQuota("org-test");
  const usage: QuotaUsage = {
    orgNodeId: "org-test",
    activeWorkflows: 9,
    activeWorkers: 5,
    llmTokensUsedLastMinute: 10000,
    llmRequestsUsedLastMinute: 60,
  };

  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 5 });

  assert.equal(result.admitted, false);
  assert.ok(result.reason.includes("max limit"));
  assert.equal(result.rejectedDueTo, "maxConcurrentWorkflows");
});

test("ResourceQuota: canAllocate rejects when exceeding burstable but within maxLimit", () => {
  // maxLimit must be >= burstable for valid tier model
  const quota = createResourceQuota("org-test", {
    guaranteed: { maxConcurrentWorkflows: 10 },
    burstable: { maxConcurrentWorkflows: 15 },
    maxLimit: { maxConcurrentWorkflows: 20 }, // Override maxLimit to be higher than burstable
  });
  const usage: QuotaUsage = {
    orgNodeId: "org-test",
    activeWorkflows: 12, // Already at 12, requesting 5 more = 17
    activeWorkers: 5,
    llmTokensUsedLastMinute: 10000,
    llmRequestsUsedLastMinute: 60,
  };

  // 12 + 5 = 17 exceeds burstable (15) but not maxLimit (20)
  const result = canAllocate(quota, usage, { maxConcurrentWorkflows: 5 });

  assert.equal(result.admitted, false);
  assert.ok(result.reason.includes("burstable"));
});

test("ResourceQuota: calculateBurstCapacity returns correct idle capacity", () => {
  const quota = createResourceQuota("org-test");
  const usage: QuotaUsage = {
    orgNodeId: "org-test",
    activeWorkflows: 5, // At guaranteed limit
    activeWorkers: 3,
    llmTokensUsedLastMinute: 5000,
    llmRequestsUsedLastMinute: 30,
  };

  const burst = calculateBurstCapacity(quota, usage);

  // Guaranteed is 10, used 5 = 5 burst available for workflows
  assert.equal(burst.maxConcurrentWorkflows, 5);
  // Guaranteed is 5, used 3 = 2 burst available for workers
  assert.equal(burst.maxConcurrentWorkers, 2);
});

test("ResourceQuota: inheritQuota creates scaled-down child quota", () => {
  const parentQuota = createResourceQuota("parent-org", {
    guaranteed: { maxConcurrentWorkflows: 20, maxConcurrentWorkers: 10 },
    maxLimit: { maxConcurrentWorkflows: 50, maxConcurrentWorkers: 25 },
  });

  const childQuota = inheritQuota(parentQuota, 0.5);

  // Child orgNodeId should be empty (caller must set)
  assert.equal(childQuota.orgNodeId, "");

  // Scaled by 0.5, rounded down, minimum 1
  assert.equal(childQuota.guaranteed.maxConcurrentWorkflows, 10);
  assert.equal(childQuota.guaranteed.maxConcurrentWorkers, 5);
  assert.equal(childQuota.maxLimit.maxConcurrentWorkflows, 25);
  assert.equal(childQuota.maxLimit.maxConcurrentWorkers, 12);
});

test("ResourceQuota: inheritQuota respects minimum of 1", () => {
  const parentQuota = createResourceQuota("tiny-parent", {
    guaranteed: { maxConcurrentWorkflows: 1 },
  });

  const childQuota = inheritQuota(parentQuota, 0.5);

  // 1 * 0.5 = 0.5 -> Math.floor -> 0 -> Math.max(1, 0) -> 1
  assert.equal(childQuota.guaranteed.maxConcurrentWorkflows, 1);
});

// ── Priority Scheduler Tests ──────────────────────────────────────────────────

test("PriorityScheduler: enqueue and dequeue preserves priority order", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({ taskId: "task-low", priorityClass: "best_effort", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "task-high", priorityClass: "high", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "task-critical", priorityClass: "critical", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });

  const first = scheduler.dequeue(10);
  const second = scheduler.dequeue(10);
  const third = scheduler.dequeue(10);

  assert.equal(first?.taskId, "task-critical");
  assert.equal(second?.taskId, "task-high");
  assert.equal(third?.taskId, "task-low");
});

test("PriorityScheduler: dequeue returns null when queue is empty", () => {
  const scheduler = new PriorityScheduler();

  const result = scheduler.dequeue(5);

  assert.equal(result, null);
});

test("PriorityScheduler: dequeue starts tasks while workers available", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({ taskId: "task-1", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "task-2", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });

  // With maxWorkers=2, both should start
  const first = scheduler.dequeue(2);
  const second = scheduler.dequeue(2);

  assert.equal(first?.taskId, "task-1");
  assert.equal(second?.taskId, "task-2");

  // Third should be null since workers full
  const third = scheduler.dequeue(2);
  assert.equal(third, null);
});

test("PriorityScheduler: complete removes task from running", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({ taskId: "task-1", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.dequeue(1);
  assert.equal(scheduler.getStats().totalRunning, 1);

  scheduler.complete("task-1");
  assert.equal(scheduler.getStats().totalRunning, 0);
});

test("PriorityScheduler: preemption occurs when higher priority task cannot fit", () => {
  const scheduler = new PriorityScheduler();

  // Start a low priority task
  scheduler.enqueue({ taskId: "task-low", priorityClass: "background", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.dequeue(1);

  // High priority task should preempt when workers at capacity
  scheduler.enqueue({ taskId: "task-high", priorityClass: "high", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });

  const preempted = scheduler.dequeue(1);

  assert.equal(preempted?.taskId, "task-high");
  assert.equal(scheduler.getStats().totalRunning, 1);
});

test("PriorityScheduler: getQueueDepthByPriority returns correct counts", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({ taskId: "t1", priorityClass: "critical", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "t2", priorityClass: "high", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "t3", priorityClass: "high", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });
  scheduler.enqueue({ taskId: "t4", priorityClass: "standard", enqueuedAt: Date.now(), canBePreempted: true, requestedResources: {} });

  const counts = scheduler.getQueueDepthByPriority();

  assert.equal(counts.critical, 1);
  assert.equal(counts.high, 2);
  assert.equal(counts.standard, 1);
  assert.equal(counts.background, 0);
  assert.equal(counts.best_effort, 0);
});

test("PriorityScheduler: tick updates wait times", async () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({ taskId: "task-1", priorityClass: "standard", enqueuedAt: Date.now() - 1000, canBePreempted: true, requestedResources: {} });

  // Wait a bit
  await new Promise<void>((resolve) => setTimeout(resolve, 50));

  scheduler.tick();

  const stats = scheduler.getStats();
  assert.ok(stats.oldestTaskWaitMs >= 50, "Wait time should be updated");
});

test("canPreempt: critical can preempt any non-critical task", () => {
  const critical: QueuedTask = {
    taskId: "critical-task",
    priorityClass: "critical",
    priorityValue: PRIORITY_CLASSES.critical.priorityValue,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const background: QueuedTask = {
    taskId: "bg-task",
    priorityClass: "background",
    priorityValue: PRIORITY_CLASSES.background.priorityValue,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(critical, background);

  assert.equal(decision.shouldPreempt, true);
  assert.equal(decision.preemptedTaskId, "bg-task");
});

test("canPreempt: cannot preempt critical task", () => {
  const high: QueuedTask = {
    taskId: "high-task",
    priorityClass: "high",
    priorityValue: PRIORITY_CLASSES.high.priorityValue,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const critical: QueuedTask = {
    taskId: "critical-task",
    priorityClass: "critical",
    priorityValue: PRIORITY_CLASSES.critical.priorityValue,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(high, critical);

  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason?.includes("Cannot preempt critical"));
});

test("canPreempt: lower_priority cannot preempt higher priority", () => {
  const standard: QueuedTask = {
    taskId: "std-task",
    priorityClass: "standard",
    priorityValue: PRIORITY_CLASSES.standard.priorityValue,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const high: QueuedTask = {
    taskId: "high-task",
    priorityClass: "high",
    priorityValue: PRIORITY_CLASSES.high.priorityValue,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(standard, high);

  assert.equal(decision.shouldPreempt, false);
});

test("parseTimeoutToMs: parses duration strings correctly", () => {
  assert.equal(parseTimeoutToMs("10s"), 10000);
  assert.equal(parseTimeoutToMs("5m"), 5 * 60 * 1000);
  assert.equal(parseTimeoutToMs("1h"), 60 * 60 * 1000);
  assert.equal(parseTimeoutToMs("1d"), 24 * 60 * 60 * 1000);
  assert.equal(parseTimeoutToMs("invalid"), Infinity);
});

test("hasExceededTimeout: returns true when waited longer than timeout", () => {
  const task: QueuedTask = {
    taskId: "task-1",
    priorityClass: "standard",
    priorityValue: PRIORITY_CLASSES.standard.priorityValue,
    enqueuedAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
    waitedMs: 10 * 60 * 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const exceeded = hasExceededTimeout(task);

  assert.equal(exceeded, true); // standard queue timeout is 5m
});

// ── Fair Scheduler Tests ──────────────────────────────────────────────────────

test("FairScheduler: registerTenant and admitTask admits within guaranteed", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-a", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 25000,
    llmRequestsPerMinute: 50,
  });

  const decision = scheduler.admitTask("tenant-a", "task-1", { maxConcurrentWorkflows: 2 });

  assert.equal(decision.admitted, true);
  assert.equal(decision.tenantId, "tenant-a");
  assert.equal(decision.taskId, "task-1");
});

test("FairScheduler: admitTask rejects unknown tenant", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 100,
  });

  const decision = scheduler.admitTask("unknown-tenant", "task-1", { maxConcurrentWorkflows: 1 });

  assert.equal(decision.admitted, false);
  assert.ok(decision.waitReason?.includes("not registered"));
});

test("FairScheduler: admitTask borrows when at guaranteed limit", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 100,
  });

  // Register two tenants
  scheduler.registerTenant("tenant-a", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 25000,
    llmRequestsPerMinute: 50,
  });

  scheduler.registerTenant("tenant-b", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 25000,
    llmRequestsPerMinute: 50,
  });

  // Exhaust tenant-a's guaranteed allocation
  for (let i = 0; i < 10; i++) {
    scheduler.admitTask("tenant-a", `task-a-${i}`, { maxConcurrentWorkflows: 1 });
  }

  // Admit 11th task - should borrow from tenant-b
  const decision = scheduler.admitTask("tenant-a", "task-11", { maxConcurrentWorkflows: 1 });

  assert.equal(decision.admitted, true);
  assert.ok(decision.borrowedFrom !== undefined);
  assert.ok(decision.borrowedFrom.length > 0);
});

test("FairScheduler: releaseResources triggers reclaim", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-a", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 25000,
    llmRequestsPerMinute: 50,
  });

  scheduler.registerTenant("tenant-b", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 25000,
    llmRequestsPerMinute: 50,
  });

  // Admit and release
  scheduler.admitTask("tenant-a", "task-1", { maxConcurrentWorkflows: 3 });
  scheduler.releaseResources("tenant-a", { maxConcurrentWorkflows: 3 });

  const stats = scheduler.getTenantStats("tenant-a");
  assert.ok(stats !== null);
  assert.equal(stats!.used.maxConcurrentWorkflows, 0);
});

test("FairScheduler: getTenantStats returns correct usage counts", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-x", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 10000,
    llmRequestsPerMinute: 50,
  });

  // Use 5 of 10 workflows, 2 of 5 workers, and some tokens
  scheduler.admitTask("tenant-x", "task-1", { maxConcurrentWorkflows: 3, maxConcurrentWorkers: 2 });
  scheduler.admitTask("tenant-x", "task-2", { maxConcurrentWorkflows: 2, maxConcurrentWorkers: 1 });
  scheduler.admitTask("tenant-x", "task-3", { llmTokensPerMinute: 5000 });

  const stats = scheduler.getTenantStats("tenant-x");

  assert.ok(stats !== null);
  assert.equal(stats!.used.maxConcurrentWorkflows, 5);
  assert.equal(stats!.used.maxConcurrentWorkers, 3);
  assert.equal(stats!.used.llmTokensPerMinute, 5000);
  // Utilization is computed as totalUsage/totalGuaranteed for all resources
  // Total used = 5+3+5000 = 5008, Total guaranteed = 10+5+10000 = 10015
  assert.ok(stats!.utilizationPercent > 0 && stats!.utilizationPercent <= 100);
});

test("FairScheduler: getAllUtilization returns all tenants", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-a", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 25000,
    llmRequestsPerMinute: 50,
  });

  scheduler.registerTenant("tenant-b", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 25000,
    llmRequestsPerMinute: 50,
  });

  const utilization = scheduler.getAllUtilization();

  assert.equal(utilization.length, 2);
  assert.ok(utilization.some((t) => t.tenantId === "tenant-a"));
  assert.ok(utilization.some((t) => t.tenantId === "tenant-b"));
});

test("FairScheduler: unregisterTenant removes tenant", () => {
  const scheduler = new FairScheduler({
    maxConcurrentWorkflows: 20,
    maxConcurrentWorkers: 10,
    llmTokensPerMinute: 50000,
    llmRequestsPerMinute: 100,
  });

  scheduler.registerTenant("tenant-removable", 1.0, {
    maxConcurrentWorkflows: 10,
    maxConcurrentWorkers: 5,
    llmTokensPerMinute: 25000,
    llmRequestsPerMinute: 50,
  });

  scheduler.unregisterTenant("tenant-removable");

  const stats = scheduler.getTenantStats("tenant-removable");
  assert.equal(stats, null);
});

// ── Horizontal Scaling Controller Tests ──────────────────────────────────────

test("HorizontalScalingController: evaluateScalingAction scales out on high queue and utilization", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 5,
    busyWorkers: 5,
    utilizationPercent: 85,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  const action = evaluateScalingAction(metrics);

  assert.equal(action.direction, "out");
  assert.ok(action.desiredWorkers > 5);
  assert.ok(action.reason.includes("Queue depth"));
});

test("HorizontalScalingController: evaluateScalingAction scales in on low metrics", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 10,
    busyWorkers: 2,
    utilizationPercent: 20,
    queueDepth: 1,
    avgLatencyMs: 10,
  };

  const action = evaluateScalingAction(metrics);

  assert.equal(action.direction, "in");
  assert.ok(action.desiredWorkers < 10);
});

test("HorizontalScalingController: evaluateScalingAction returns none when metrics normal", () => {
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 5,
    busyWorkers: 3,
    utilizationPercent: 60,
    queueDepth: 5,
    avgLatencyMs: 50,
  };

  const action = evaluateScalingAction(metrics);

  assert.equal(action.direction, "none");
  assert.equal(action.desiredWorkers, 5);
});

test("HorizontalScalingController: processMetrics enforces cooldown", () => {
  const controller = new HorizontalScalingController("test-pool");

  const queueStats = { queueName: "test-queue", waiting: 20, delayed: 0, active: 5, running: 0, completed: 0, failed: 0, deadLetter: 0 };
  const workerMetrics: WorkerPoolMetrics = {
    activeWorkers: 5,
    busyWorkers: 5,
    utilizationPercent: 85,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  // First call should trigger scale out
  const event1 = controller.processMetrics(queueStats, workerMetrics);
  assert.ok(event1 !== null);
  assert.equal(event1!.eventType, "scale_out");

  // Immediate second call should be in cooldown
  const event2 = controller.processMetrics(queueStats, workerMetrics);
  assert.ok(event2 !== null);
  assert.equal(event2!.eventType, "cooldown_active");
  assert.ok(event2!.cooldownRemainingMs !== undefined);
  assert.ok(event2!.cooldownRemainingMs > 0);
});

test("HorizontalScalingController: processMetrics returns null when no action needed", () => {
  const controller = new HorizontalScalingController("idle-pool");

  const queueStats = { queueName: "idle-queue", waiting: 2, delayed: 0, active: 1, running: 0, completed: 0, failed: 0, deadLetter: 0 };
  const workerMetrics: WorkerPoolMetrics = {
    activeWorkers: 3,
    busyWorkers: 1,
    utilizationPercent: 40,
    queueDepth: 2,
    avgLatencyMs: 20,
  };

  const event = controller.processMetrics(queueStats, workerMetrics);

  assert.equal(event, null);
});

test("HorizontalScalingController: computeWorkerCount calculates correct replica count", () => {
  const controller = new HorizontalScalingController("test-pool");

  const queueStats = { queueName: "pending-queue", waiting: 25, delayed: 5, active: 5, running: 0, completed: 0, failed: 0, deadLetter: 0 };

  const workers = controller.computeWorkerCount(queueStats, 5);

  assert.equal(workers, 7); // ceil(35 / 5) = 7
});

test("HorizontalScalingController: computeWorkerCount respects minimum of 1", () => {
  const controller = new HorizontalScalingController("test-pool");

  const queueStats = { queueName: "empty-queue", waiting: 0, delayed: 0, active: 0, running: 0, completed: 0, failed: 0, deadLetter: 0 };

  const workers = controller.computeWorkerCount(queueStats, 5);

  assert.equal(workers, 1);
});

test("HorizontalScalingController: getScalingState returns correct state", () => {
  const controller = new HorizontalScalingController("test-pool");

  const state = controller.getScalingState();

  assert.equal(state.lastAction, null);
  assert.equal(state.cooldownRemainingMs, 0);
});

test("HorizontalScalingController: custom policy thresholds are respected", () => {
  const customPolicy: ScalingPolicy = {
    scaleOutThreshold: 50,
    scaleInThreshold: 5,
    targetUtilization: 80,
    minWorkers: 2,
    maxWorkers: 50,
    stabilizationWindowSeconds: 60,
    cooldownSeconds: 30,
  };

  // Should NOT scale out with queue=20 (threshold is 50)
  const metrics: WorkerPoolMetrics = {
    activeWorkers: 5,
    busyWorkers: 5,
    utilizationPercent: 85,
    queueDepth: 20,
    avgLatencyMs: 100,
  };

  const action = evaluateScalingAction(metrics, customPolicy);

  assert.equal(action.direction, "none");
});
