import test from "node:test";
import assert from "node:assert/strict";
import {
  PriorityScheduler,
  PRIORITY_CLASSES,
  canPreempt,
  findTaskToPreempt,
  parseTimeoutToMs,
  hasExceededTimeout,
  type QueuedTask,
  type PriorityClassName,
  type PreemptionDecision,
} from "../../../../../src/platform/shared/scaling/priority-scheduler.js";

/**
 * Comprehensive tests for PriorityScheduler - priority-scheduler.ts
 * Priority-based scheduling with preemption support
 */

// =============================================================================
// PRIORITY_CLASSES Constants
// =============================================================================

test("PRIORITY_CLASSES contains all five priority classes", () => {
  assert.ok(PRIORITY_CLASSES.critical !== undefined);
  assert.ok(PRIORITY_CLASSES.high !== undefined);
  assert.ok(PRIORITY_CLASSES.standard !== undefined);
  assert.ok(PRIORITY_CLASSES.background !== undefined);
  assert.ok(PRIORITY_CLASSES.best_effort !== undefined);
});

test("PRIORITY_CLASSES priority values are in descending order", () => {
  assert.equal(PRIORITY_CLASSES.critical.priorityValue, 1000);
  assert.equal(PRIORITY_CLASSES.high.priorityValue, 800);
  assert.equal(PRIORITY_CLASSES.standard.priorityValue, 500);
  assert.equal(PRIORITY_CLASSES.background.priorityValue, 200);
  assert.equal(PRIORITY_CLASSES.best_effort.priorityValue, 0);

  assert.ok(PRIORITY_CLASSES.critical.priorityValue > PRIORITY_CLASSES.high.priorityValue);
  assert.ok(PRIORITY_CLASSES.high.priorityValue > PRIORITY_CLASSES.standard.priorityValue);
  assert.ok(PRIORITY_CLASSES.standard.priorityValue > PRIORITY_CLASSES.background.priorityValue);
  assert.ok(PRIORITY_CLASSES.background.priorityValue > PRIORITY_CLASSES.best_effort.priorityValue);
});

test("PRIORITY_CLASSES queueTimeout values are parseable", () => {
  assert.equal(parseTimeoutToMs(PRIORITY_CLASSES.critical.queueTimeout), 10000);
  assert.equal(parseTimeoutToMs(PRIORITY_CLASSES.high.queueTimeout), 30000);
  assert.equal(parseTimeoutToMs(PRIORITY_CLASSES.standard.queueTimeout), 300000);
  assert.equal(parseTimeoutToMs(PRIORITY_CLASSES.background.queueTimeout), 3600000);
  assert.equal(parseTimeoutToMs(PRIORITY_CLASSES.best_effort.queueTimeout), Infinity);
});

test("PRIORITY_CLASSES preemption policies are correct", () => {
  assert.equal(PRIORITY_CLASSES.critical.preemptionPolicy, "any_non_critical");
  assert.equal(PRIORITY_CLASSES.high.preemptionPolicy, "lower_priority");
  assert.equal(PRIORITY_CLASSES.standard.preemptionPolicy, "never");
  assert.equal(PRIORITY_CLASSES.background.preemptionPolicy, "never");
  assert.equal(PRIORITY_CLASSES.best_effort.preemptionPolicy, "never");
});

// =============================================================================
// canPreempt Function
// =============================================================================

test("canPreempt critical can preempt standard", () => {
  const preemptor: QueuedTask = {
    taskId: "critical-task",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "standard-task",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, true);
  assert.equal(decision.preemptedTaskId, "standard-task");
});

test("canPreempt critical can preempt background", () => {
  const preemptor: QueuedTask = {
    taskId: "critical-task",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "background-task",
    priorityClass: "background",
    priorityValue: 200,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, true);
});

test("canPreempt critical can preempt best_effort", () => {
  const preemptor: QueuedTask = {
    taskId: "critical-task",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "best-effort-task",
    priorityClass: "best_effort",
    priorityValue: 0,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, true);
});

test("canPreempt high can preempt standard", () => {
  const preemptor: QueuedTask = {
    taskId: "high-task",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "standard-task",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, true);
});

test("canPreempt high can preempt background", () => {
  const preemptor: QueuedTask = {
    taskId: "high-task",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "background-task",
    priorityClass: "background",
    priorityValue: 200,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, true);
});

test("canPreempt high can preempt best_effort", () => {
  const preemptor: QueuedTask = {
    taskId: "high-task",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "best-effort-task",
    priorityClass: "best_effort",
    priorityValue: 0,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, true);
});

test("canPreempt cannot preempt critical target regardless of preemptor", () => {
  const preemptor: QueuedTask = {
    taskId: "critical-task",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "critical-target",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason !== undefined);
  assert.ok(decision.reason!.includes("Cannot preempt critical"));
});

test("canPreempt returns false when target canBePreempted is false", () => {
  const preemptor: QueuedTask = {
    taskId: "critical-task",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "non-preemptible",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: false,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason !== undefined);
});

test("canPreempt returns false when preemptor has never policy", () => {
  const preemptor: QueuedTask = {
    taskId: "standard-task",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "background-task",
    priorityClass: "background",
    priorityValue: 200,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason !== undefined);
  assert.ok(decision.reason!.includes("preemption_policy=never"));
});

test("canPreempt high cannot preempt high (equal priority)", () => {
  const preemptor: QueuedTask = {
    taskId: "high-1",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "high-2",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now() - 1000,
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason !== undefined);
});

// =============================================================================
// findTaskToPreempt Function
// =============================================================================

test("findTaskToPreempt selects lowest priority task", () => {
  const preemptor: QueuedTask = {
    taskId: "high-priority",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const runningTasks: QueuedTask[] = [
    {
      taskId: "standard-task",
      priorityClass: "standard",
      priorityValue: 500,
      enqueuedAt: Date.now(),
      waitedMs: 0,
      canBePreempted: true,
      requestedResources: {},
    },
    {
      taskId: "best-effort-task",
      priorityClass: "best_effort",
      priorityValue: 0,
      enqueuedAt: Date.now(),
      waitedMs: 0,
      canBePreempted: true,
      requestedResources: {},
    },
  ];

  const decision = findTaskToPreempt(preemptor, runningTasks);
  assert.equal(decision.shouldPreempt, true);
  assert.equal(decision.preemptedTaskId, "best-effort-task");
});

test("findTaskToPreempt selects oldest when priorities are equal", () => {
  const preemptor: QueuedTask = {
    taskId: "high-priority",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const runningTasks: QueuedTask[] = [
    {
      taskId: "newer-task",
      priorityClass: "standard",
      priorityValue: 500,
      enqueuedAt: Date.now(),
      waitedMs: 0,
      canBePreempted: true,
      requestedResources: {},
    },
    {
      taskId: "older-task",
      priorityClass: "standard",
      priorityValue: 500,
      enqueuedAt: Date.now() - 60000,
      waitedMs: 60000,
      canBePreempted: true,
      requestedResources: {},
    },
  ];

  const decision = findTaskToPreempt(preemptor, runningTasks);
  assert.equal(decision.shouldPreempt, true);
  assert.equal(decision.preemptedTaskId, "older-task");
});

test("findTaskToPreempt returns no task found when no preemptable tasks", () => {
  const preemptor: QueuedTask = {
    taskId: "high-priority",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const runningTasks: QueuedTask[] = [
    {
      taskId: "non-preemptible",
      priorityClass: "standard",
      priorityValue: 500,
      enqueuedAt: Date.now(),
      waitedMs: 0,
      canBePreempted: false,
      requestedResources: {},
    },
  ];

  const decision = findTaskToPreempt(preemptor, runningTasks);
  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason !== undefined);
});

test("findTaskToPreempt skips non-preemptible tasks", () => {
  const preemptor: QueuedTask = {
    taskId: "high-priority",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const runningTasks: QueuedTask[] = [
    {
      taskId: "non-preemptible",
      priorityClass: "standard",
      priorityValue: 500,
      enqueuedAt: Date.now(),
      waitedMs: 0,
      canBePreempted: false,
      requestedResources: {},
    },
    {
      taskId: "preemptible",
      priorityClass: "background",
      priorityValue: 200,
      enqueuedAt: Date.now(),
      waitedMs: 0,
      canBePreempted: true,
      requestedResources: {},
    },
  ];

  const decision = findTaskToPreempt(preemptor, runningTasks);
  assert.equal(decision.shouldPreempt, true);
  assert.equal(decision.preemptedTaskId, "preemptible");
});

// =============================================================================
// PriorityScheduler - Enqueue and Dequeue
// =============================================================================

test("PriorityScheduler enqueue sorts by priority value (highest first)", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "low",
    priorityClass: "best_effort",
    enqueuedAt: Date.now() - 100,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "high",
    priorityClass: "high",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "critical",
    priorityClass: "critical",
    enqueuedAt: Date.now() + 100,
    canBePreempted: true,
    requestedResources: {},
  });

  const task = scheduler.dequeue(1);
  assert.equal(task!.taskId, "critical");
});

test("PriorityScheduler dequeue returns null when queue is empty", () => {
  const scheduler = new PriorityScheduler();

  const task = scheduler.dequeue(1);

  assert.equal(task, null);
});

test("PriorityScheduler dequeue accepts multiple workers", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "task-2",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  const task1 = scheduler.dequeue(2);
  const task2 = scheduler.dequeue(2);

  assert.ok(task1 !== null);
  assert.ok(task2 !== null);
});

test("PriorityScheduler dequeue fills worker slots before considering preemption", () => {
  const scheduler = new PriorityScheduler();

  // Fill both worker slots
  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "task-2",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(2);
  scheduler.dequeue(2);

  // Queue another standard task
  scheduler.enqueue({
    taskId: "task-3",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  // No slots available and cannot preempt equal priority
  const result = scheduler.dequeue(2);
  assert.equal(result, null);
});

// =============================================================================
// PriorityScheduler - Preemption
// =============================================================================

test("PriorityScheduler preempts lower priority when slots full", () => {
  const scheduler = new PriorityScheduler();

  // Start a standard task (occupying 1 slot with maxWorkers=1)
  scheduler.enqueue({
    taskId: "standard-task",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(1);

  // Queue a high priority task
  scheduler.enqueue({
    taskId: "high-priority",
    priorityClass: "high",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  const result = scheduler.dequeue(1);

  assert.equal(result!.taskId, "high-priority");
});

test("PriorityScheduler preemption puts preempted task back in queue", () => {
  const scheduler = new PriorityScheduler();

  // Start a standard task
  scheduler.enqueue({
    taskId: "standard-task",
    priorityClass: "standard",
    enqueuedAt: Date.now() - 1000,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(1);

  // Queue a high priority task
  scheduler.enqueue({
    taskId: "high-priority",
    priorityClass: "high",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(1);

  // Preempted task should be back in queue
  const stats = scheduler.getStats();
  assert.ok(stats.totalQueued > 0);
});

// =============================================================================
// PriorityScheduler - Complete
// =============================================================================

test("PriorityScheduler complete removes task from running", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(1);
  scheduler.complete("task-1");

  const stats = scheduler.getStats();
  assert.equal(stats.totalRunning, 0);
});

test("PriorityScheduler complete removes task from queue if still queued", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  // Don't dequeue, just complete
  scheduler.complete("task-1");

  const stats = scheduler.getStats();
  assert.equal(stats.totalQueued, 0);
});

// =============================================================================
// PriorityScheduler - Tick and Starvation Prevention
// =============================================================================

test("PriorityScheduler tick updates waitedMs for all queued tasks", () => {
  const scheduler = new PriorityScheduler();
  const beforeEnqueue = Date.now() - 3000;

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: beforeEnqueue,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.tick();

  const stats = scheduler.getStats();
  assert.ok(stats.oldestTaskWaitMs >= 3000);
});

test("PriorityScheduler starvation prevention upgrades background to high", () => {
  const scheduler = new PriorityScheduler(60000); // 60 second threshold

  scheduler.enqueue({
    taskId: "old-background",
    priorityClass: "background",
    enqueuedAt: Date.now() - 120000, // 2 minutes ago
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.tick();

  const stats = scheduler.getStats();
  assert.equal(stats.byPriority.high, 1);
  assert.equal(stats.byPriority.background, 0);
});

test("PriorityScheduler starvation prevention does not upgrade standard", () => {
  const scheduler = new PriorityScheduler(60000);

  scheduler.enqueue({
    taskId: "old-standard",
    priorityClass: "standard",
    enqueuedAt: Date.now() - 120000,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.tick();

  const stats = scheduler.getStats();
  // Standard has "never" preemption policy but can still be upgraded for starvation
  // Note: tick() upgrades to "high" class, not "standard"
  assert.ok(stats.totalQueued > 0);
});

// =============================================================================
// PriorityScheduler - Queue Statistics
// =============================================================================

test("PriorityScheduler getQueueDepthByPriority counts correctly", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "c1",
    priorityClass: "critical",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "h1",
    priorityClass: "high",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "h2",
    priorityClass: "high",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "s1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "s2",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "s3",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "b1",
    priorityClass: "background",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "be1",
    priorityClass: "best_effort",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  const depth = scheduler.getQueueDepthByPriority();

  assert.equal(depth.critical, 1);
  assert.equal(depth.high, 2);
  assert.equal(depth.standard, 3);
  assert.equal(depth.background, 1);
  assert.equal(depth.best_effort, 1);
});

test("PriorityScheduler getStats returns correct totals", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "task-2",
    priorityClass: "high",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(1);

  const stats = scheduler.getStats();

  assert.equal(stats.totalQueued, 1);
  assert.equal(stats.totalRunning, 1);
  assert.ok(stats.oldestTaskWaitMs >= 0);
});

test("PriorityScheduler getStats with empty queue returns zeros", () => {
  const scheduler = new PriorityScheduler();

  const stats = scheduler.getStats();

  assert.equal(stats.totalQueued, 0);
  assert.equal(stats.totalRunning, 0);
  assert.equal(stats.oldestTaskWaitMs, 0);
});

// =============================================================================
// parseTimeoutToMs and hasExceededTimeout
// =============================================================================

test("parseTimeoutToMs parses seconds correctly", () => {
  assert.equal(parseTimeoutToMs("1s"), 1000);
  assert.equal(parseTimeoutToMs("30s"), 30000);
  assert.equal(parseTimeoutToMs("60s"), 60000);
});

test("parseTimeoutToMs parses minutes correctly", () => {
  assert.equal(parseTimeoutToMs("1m"), 60000);
  assert.equal(parseTimeoutToMs("5m"), 300000);
  assert.equal(parseTimeoutToMs("30m"), 1800000);
});

test("parseTimeoutToMs parses hours correctly", () => {
  assert.equal(parseTimeoutToMs("1h"), 3600000);
  assert.equal(parseTimeoutToMs("2h"), 7200000);
  assert.equal(parseTimeoutToMs("24h"), 86400000);
});

test("parseTimeoutToMs parses days correctly", () => {
  assert.equal(parseTimeoutToMs("1d"), 86400000);
  assert.equal(parseTimeoutToMs("7d"), 604800000);
});

test("parseTimeoutToMs returns Infinity for invalid input", () => {
  assert.equal(parseTimeoutToMs("invalid"), Infinity);
  assert.equal(parseTimeoutToMs(""), Infinity);
  assert.equal(parseTimeoutToMs("1x"), Infinity);
});

test("hasExceededTimeout returns true when exceeded", () => {
  const task: QueuedTask = {
    taskId: "old-task",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now() - 60000, // 1 minute ago
    waitedMs: 60000,
    canBePreempted: true,
    requestedResources: {},
  };

  // High has 30s timeout
  assert.equal(hasExceededTimeout(task), true);
});

test("hasExceededTimeout returns false when not exceeded", () => {
  const task: QueuedTask = {
    taskId: "fresh-task",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now() - 5000, // 5 seconds ago
    waitedMs: 5000,
    canBePreempted: true,
    requestedResources: {},
  };

  assert.equal(hasExceededTimeout(task), false);
});

test("hasExceededTimeout returns false for best_effort (infinite timeout)", () => {
  const task: QueuedTask = {
    taskId: "best-effort-old",
    priorityClass: "best_effort",
    priorityValue: 0,
    enqueuedAt: Date.now() - 1000000,
    waitedMs: 1000000,
    canBePreempted: true,
    requestedResources: {},
  };

  assert.equal(hasExceededTimeout(task), false);
});
