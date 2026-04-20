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
} from "../../../../../src/platform/shared/scaling/priority-scheduler.js";

test("PRIORITY_CLASSES has correct values", () => {
  assert.equal(PRIORITY_CLASSES.critical.priorityValue, 1000);
  assert.equal(PRIORITY_CLASSES.high.priorityValue, 800);
  assert.equal(PRIORITY_CLASSES.standard.priorityValue, 500);
  assert.equal(PRIORITY_CLASSES.background.priorityValue, 200);
  assert.equal(PRIORITY_CLASSES.best_effort.priorityValue, 0);
});

test("PRIORITY_CLASSES critical has any_non_critical preemption policy", () => {
  assert.equal(PRIORITY_CLASSES.critical.preemptionPolicy, "any_non_critical");
});

test("PRIORITY_CLASSES high has lower_priority preemption policy", () => {
  assert.equal(PRIORITY_CLASSES.high.preemptionPolicy, "lower_priority");
});

test("canPreempt returns false for never policy preemptor", () => {
  const preemptor: QueuedTask = {
    taskId: "task-1",
    priorityClass: "standard", // standard has preemptionPolicy: "never"
    priorityValue: 500,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const target: QueuedTask = {
    taskId: "task-2",
    priorityClass: "background",
    priorityValue: 200,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  // Standard has preemptionPolicy: "never" - cannot preempt any task
  const decision = canPreempt(preemptor, target);

  assert.equal(decision.shouldPreempt, false);
});

test("canPreempt allows critical to preempt non-critical", () => {
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
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);

  assert.equal(decision.shouldPreempt, true);
  assert.equal(decision.preemptedTaskId, "task-2");
});

test("canPreempt does not allow critical to preempt critical", () => {
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
    priorityClass: "critical",
    priorityValue: 1000,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);

  assert.equal(decision.shouldPreempt, false);
});

test("canPreempt allows higher priority to preempt lower priority", () => {
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
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now(),
    waitedMs: 0,
    canBePreempted: true,
    requestedResources: {},
  };

  const decision = canPreempt(preemptor, target);

  assert.equal(decision.shouldPreempt, true);
});

test("findTaskToPreempt finds lowest priority task", () => {
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
      taskId: "low-priority",
      priorityClass: "best_effort",
      priorityValue: 0,
      enqueuedAt: Date.now() - 60000,
      waitedMs: 60000,
      canBePreempted: true,
      requestedResources: {},
    },
    {
      taskId: "medium-priority",
      priorityClass: "standard",
      priorityValue: 500,
      enqueuedAt: Date.now(),
      waitedMs: 0,
      canBePreempted: true,
      requestedResources: {},
    },
  ];

  const decision = findTaskToPreempt(preemptor, runningTasks);

  assert.equal(decision.shouldPreempt, true);
  assert.equal(decision.preemptedTaskId, "low-priority");
});

test("PriorityScheduler enqueue and dequeue", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  const task = scheduler.dequeue(10);

  assert.ok(task !== null);
  assert.equal(task?.taskId, "task-1");
});

test("PriorityScheduler dequeue respects priority order", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "low",
    priorityClass: "background",
    enqueuedAt: Date.now(),
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

  const first = scheduler.dequeue(10);
  assert.equal(first?.taskId, "high"); // High priority first

  const second = scheduler.dequeue(10);
  assert.equal(second?.taskId, "low");
});

test("PriorityScheduler complete removes running task", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.dequeue(10);
  scheduler.complete("task-1");

  const stats = scheduler.getStats();
  assert.equal(stats.totalRunning, 0);
});

test("PriorityScheduler getQueueDepthByPriority", () => {
  const scheduler = new PriorityScheduler();

  scheduler.enqueue({
    taskId: "task-1",
    priorityClass: "high",
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

  scheduler.enqueue({
    taskId: "task-3",
    priorityClass: "standard",
    enqueuedAt: Date.now(),
    canBePreempted: true,
    requestedResources: {},
  });

  const depth = scheduler.getQueueDepthByPriority();

  assert.equal(depth.high, 1);
  assert.equal(depth.standard, 2);
  assert.equal(depth.critical, 0);
});

test("PriorityScheduler starvation prevention upgrades priority", () => {
  const scheduler = new PriorityScheduler(30000); // 30 seconds for test

  const oldTime = Date.now() - 40000; // 40 seconds ago

  scheduler.enqueue({
    taskId: "starving-task",
    priorityClass: "background",
    enqueuedAt: oldTime,
    canBePreempted: true,
    requestedResources: {},
  });

  scheduler.tick(); // Should upgrade to high

  const stats = scheduler.getStats();
  assert.equal(stats.byPriority.high, 1);
  assert.equal(stats.byPriority.background, 0);
});

test("parseTimeoutToMs parses correctly", () => {
  assert.equal(parseTimeoutToMs("30s"), 30000);
  assert.equal(parseTimeoutToMs("5m"), 300000);
  assert.equal(parseTimeoutToMs("1h"), 3600000);
  assert.equal(parseTimeoutToMs("1d"), 86400000);
});

test("parseTimeoutToMs returns Infinity for invalid", () => {
  assert.equal(parseTimeoutToMs("invalid"), Infinity);
  assert.equal(parseTimeoutToMs("∞"), Infinity);
});

test("hasExceededTimeout returns correct value", () => {
  const oldTask: QueuedTask = {
    taskId: "old-task",
    priorityClass: "standard",
    priorityValue: 500,
    enqueuedAt: Date.now() - 400000, // 6+ minutes ago
    waitedMs: 400000,
    canBePreempted: true,
    requestedResources: {},
  };

  // Standard has queueTimeout of 5m
  assert.equal(hasExceededTimeout(oldTask), true);
});

test("PriorityScheduler returns null when queue empty", () => {
  const scheduler = new PriorityScheduler();

  const task = scheduler.dequeue(10);

  assert.equal(task, null);
});
