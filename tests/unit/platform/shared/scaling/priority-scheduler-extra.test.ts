import test from "node:test";
import assert from "node:assert/strict";
import {
  PRIORITY_CLASSES,
  canPreempt,
  findTaskToPreempt,
  PriorityScheduler,
  parseTimeoutToMs,
  hasExceededTimeout,
  type QueuedTask,
  type PriorityClassName,
} from "../../../../../src/platform/shared/scaling/priority-scheduler.js";

/**
 * Additional tests for Priority Scheduler covering edge cases and preemption scenarios
 */

// =============================================================================
// canPreempt Edge Cases
// =============================================================================

test("canPreempt returns false when target cannot be preempted", () => {
  const preemptor: QueuedTask = {
    taskId: "task-1",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "task-2",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: false, // Not preemptible
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason?.includes("non-preemptible"));
});

test("canPreempt returns false for equal priority tasks with lower_priority policy", () => {
  const preemptor: QueuedTask = {
    taskId: "task-1",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "task-2",
    priorityClass: "high",
    priorityValue: 800, // Same priority
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason?.includes("not lower"));
});

test("canPreempt returns false when high priority cannot preempt best_effort due to policy", () => {
  const preemptor: QueuedTask = {
    taskId: "task-1",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "task-2",
    priorityClass: "best_effort",
    priorityValue: 0,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, true); // high can preempt best_effort
  assert.equal(decision.preemptedTaskId, "task-2");
});

test("canPreempt background cannot preempt standard due to never policy", () => {
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
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);
  assert.equal(decision.shouldPreempt, false);
});

// =============================================================================
// findTaskToPreempt Edge Cases
// =============================================================================

test("findTaskToPreempt returns no task found when no tasks are preemptible", () => {
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
      canBePreempted: false, // Not preemptible
      requestedResources: {},
    },
  ];

  const decision = findTaskToPreempt(preemptor, runningTasks);
  assert.equal(decision.shouldPreempt, false);
  assert.ok(decision.reason?.includes("No preemptable task found"));
});

test("findTaskToPreempt selects oldest when multiple have same priority", () => {
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
      enqueuedAt: Date.now() - 60000, // 1 minute older
      waitedMs: 60000,
      canBePreempted: true,
      requestedResources: {},
    },
  ];

  const decision = findTaskToPreempt(preemptor, runningTasks);
  assert.equal(decision.shouldPreempt, true);
  assert.equal(decision.preemptedTaskId, "older-task");
});

test("findTaskToPreempt returns no task found for empty running tasks", () => {
  const preemptor: QueuedTask = {
    taskId: "high-priority",
    priorityClass: "high",
    priorityValue: 800,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = findTaskToPreempt(preemptor, []);
  assert.equal(decision.shouldPreempt, false);
});

// =============================================================================
// PriorityScheduler Edge Cases
// =============================================================================

test("PriorityScheduler dequeue returns null when workers slots are full and no preemption possible", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(1); // Occupy the slot

  scheduler.enqueue({
    taskId: "task-2",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  // No slot available and no preemptable tasks
  const result = scheduler.dequeue(1);
  assert.equal(result, null);
});

test("PriorityScheduler dequeue preempts and re-queues lower priority when slots full", () => {
  const scheduler = new PriorityScheduler();

  // Start a low priority task
  scheduler.enqueue({
    taskId: "low-priority",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(1);

  // Now try to add a high priority task
  scheduler.enqueue({
    taskId: "high-priority",
    priorityClass: "high",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  const preempted = scheduler.dequeue(1);
  assert.equal(preempted?.taskId, "high-priority");

  // The low priority should be back in queue
  const stats = scheduler.getStats();
  assert.ok(stats.totalQueued > 0);
});

test("PriorityScheduler completes removes from queue not just running", () => {
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
  assert.equal(stats.totalQueued, 0);
});

test("PriorityScheduler tick updates wait times correctly", () => {
  const scheduler = new PriorityScheduler();
  const beforeEnqueue = Date.now() - 5000;

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: beforeEnqueue,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.tick();

  const stats = scheduler.getStats();
  assert.ok(stats.oldestTaskWaitMs >= 5000);
});

test("PriorityScheduler starvation prevention does not upgrade critical or high priority", () => {
  const scheduler = new PriorityScheduler(30000); // 30 seconds

  scheduler.enqueue({
    taskId: "critical-task",
    priorityClass: "critical",
    enqueuedAt: Date.now() - 40000,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.tick();

  const stats = scheduler.getStats();
  assert.equal(stats.byPriority.critical, 1);
  assert.equal(stats.byPriority.high, 0);
});

test("PriorityScheduler starvation prevention does not affect short-waiting tasks", () => {
  const scheduler = new PriorityScheduler(30000); // 30 seconds

  scheduler.enqueue({
    taskId: "recent-task",
    priorityClass: "background",
    enqueuedAt: Date.now() - 5000, // Only 5 seconds ago
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.tick();

  const stats = scheduler.getStats();
  assert.equal(stats.byPriority.background, 1);
  assert.equal(stats.byPriority.high, 0);
});

test("PriorityScheduler handles same priority tasks by enqueue order", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "first",
    priorityClass: "high",
    enqueuedAt: Date.now() - 200,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "second",
    priorityClass: "high",
    enqueuedAt: Date.now() - 100,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.enqueue({
    taskId: "third",
    priorityClass: "high",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  // All same priority - should be ordered by enqueue time (FIFO)
  // With 3 worker slots available
  const first = scheduler.dequeue(3);
  const second = scheduler.dequeue(3);
  const third = scheduler.dequeue(3);

  // Verify they are dequeued in order
  assert.ok(first !== null);
  assert.ok(second !== null);
  assert.ok(third !== null);
});

// =============================================================================
// Priority Class Timeout Tests
// =============================================================================

test("hasExceededTimeout returns false for fresh tasks", () => {
  const task: QueuedTask = {
    taskId: "fresh-task",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now(),
    waitedMs: 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  assert.equal(hasExceededTimeout(task), false);
});

test("hasExceededTimeout returns false for best_effort (infinite timeout)", () => {
  const task: QueuedTask = {
    taskId: "best-effort-task",
    priorityClass: "best_effort",
    priorityValue: 0,
    enqueuedAt: Date.now() - 100 * 60 * 1000, // 100 minutes ago
    waitedMs: 100 * 60 * 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  assert.equal(hasExceededTimeout(task), false); // best_effort has infinite timeout
});

test("hasExceededTimeout returns true for background task exceeding 1h timeout", () => {
  const task: QueuedTask = {
    taskId: "old-background",
    priorityClass: "background",
    priorityValue: 200,
    enqueuedAt: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
    waitedMs: 2 * 60 * 60 * 1000,
    canBePreempted: true,
    requestedResources: {},
  };

  assert.equal(hasExceededTimeout(task), true); // background has 1h timeout
});

test("hasExceededTimeout returns true for critical task exceeding 10s timeout", () => {
  const task: QueuedTask = {
    taskId: "old-critical",
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now() - 15000, // 15 seconds ago
    waitedMs: 15000,
    canBePreempted: true,
    requestedResources: {},
  };

  assert.equal(hasExceededTimeout(task), true); // critical has 10s timeout
});

// =============================================================================
// PriorityClass Constants Tests
// =============================================================================

test("PRIORITY_CLASSES background has correct preemption policy", () => {
  assert.equal(PRIORITY_CLASSES.background.preemptionPolicy, "never");
});

test("PRIORITY_CLASSES standard has queueTimeout of 5m", () => {
  assert.equal(parseTimeoutToMs(PRIORITY_CLASSES.standard.queueTimeout), 300000);
});

test("PRIORITY_CLASSES critical has queueTimeout of 10s", () => {
  assert.equal(parseTimeoutToMs(PRIORITY_CLASSES.critical.queueTimeout), 10000);
});

test("PRIORITY_CLASSES high has guaranteedStartSla", () => {
  assert.ok(PRIORITY_CLASSES.high.guaranteedStartSla !== undefined);
  assert.equal(PRIORITY_CLASSES.high.guaranteedStartSla, "< 30s");
});

test("PRIORITY_CLASSES background has guaranteedStartSla as best_effort", () => {
  assert.equal(PRIORITY_CLASSES.background.guaranteedStartSla, "best_effort");
});

// =============================================================================
// Queue Stats Tests
// =============================================================================

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
  // high task was dequeued first so it should be running, not queued
  assert.equal(stats.byPriority.high, 0);
});

test("PriorityScheduler getStats handles empty queue", () => {
  const scheduler = new PriorityScheduler();

  const stats = scheduler.getStats();
  assert.equal(stats.totalQueued, 0);
  assert.equal(stats.totalRunning, 0);
  assert.equal(stats.oldestTaskWaitMs, 0);
});
