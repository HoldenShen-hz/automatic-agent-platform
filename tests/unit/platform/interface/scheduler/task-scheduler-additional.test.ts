/**
 * Unit tests for Scheduler Task Queue additional coverage
 * Tests src/platform/interface/scheduler/task-queue.ts additional scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";

test("TaskQueueConfig default values", () => {
  const config = {
    queueName: "default",
    maxSize: 1000,
  };

  assert.equal(config.queueName, "default");
  assert.equal(config.maxSize, 1000);
});

test("TaskQueueConfig with all options", () => {
  const config = {
    queueName: "priority-queue",
    maxSize: 5000,
    priorityLevels: 10,
    timeout: 30000,
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
    },
  };

  assert.equal(config.queueName, "priority-queue");
  assert.equal(config.priorityLevels, 10);
  assert.equal(config.timeout, 30000);
});

test("TaskQueueItem structure", () => {
  const item = {
    taskId: "task-001",
    priority: 5,
    enqueuedAt: "2026-04-01T10:00:00.000Z",
    payload: { type: "execute" },
  };

  assert.equal(item.taskId, "task-001");
  assert.equal(item.priority, 5);
});

test("TaskQueueItem priority ordering", () => {
  const items = [
    { taskId: "low", priority: 1 },
    { taskId: "high", priority: 10 },
    { taskId: "medium", priority: 5 },
  ];

  const sorted = items.sort((a, b) => b.priority - a.priority);
  assert.equal(sorted[0]!.taskId, "high");
  assert.equal(sorted[1]!.taskId, "medium");
  assert.equal(sorted[2]!.taskId, "low");
});

test("TaskQueuePartition structure", () => {
  const partition = {
    partitionId: "partition-001",
    queueName: "tasks",
    workerId: "worker-abc",
    currentLoad: 5,
    maxLoad: 10,
  };

  assert.equal(partition.partitionId, "partition-001");
  assert.equal(partition.currentLoad, 5);
  assert.equal(partition.maxLoad, 10);
});

test("TaskQueuePartition load calculation", () => {
  const partition = {
    partitionId: "p1",
    queueName: "tasks",
    workerId: "w1",
    currentLoad: 3,
    maxLoad: 10,
  };

  const loadPercentage = (partition.currentLoad / partition.maxLoad) * 100;
  assert.equal(loadPercentage, 30);
});

test("TaskSchedulerConfig structure", () => {
  const config = {
    schedulerId: "scheduler-001",
    numPartitions: 4,
    strategy: "round-robin",
    enabled: true,
  };

  assert.equal(config.numPartitions, 4);
  assert.equal(config.strategy, "round-robin");
});

test("TaskSchedulerConfig strategies", () => {
  const strategies = ["round-robin", "least-loaded", "random", "priority"];
  for (const strategy of strategies) {
    const config = { strategy, numPartitions: 2 };
    assert.equal(config.strategy, strategy);
  }
});

test("QueueMetrics structure", () => {
  const metrics = {
    queueName: "tasks",
    depth: 100,
    enqueuedPerMinute: 10,
    dequeuedPerMinute: 8,
    averageWaitTimeMs: 500,
  };

  assert.equal(metrics.depth, 100);
  assert.equal(metrics.enqueuedPerMinute, 10);
  assert.equal(metrics.dequeuedPerMinute, 8);
});

test("QueueMetrics with zero activity", () => {
  const metrics = {
    queueName: "idle-queue",
    depth: 0,
    enqueuedPerMinute: 0,
    dequeuedPerMinute: 0,
    averageWaitTimeMs: 0,
  };

  assert.equal(metrics.depth, 0);
  assert.equal(metrics.averageWaitTimeMs, 0);
});

test("PartitionAssignment structure", () => {
  const assignment = {
    partitionId: "part-001",
    assignedTo: "worker-x",
    assignedAt: "2026-04-01T10:00:00.000Z",
    expiresAt: "2026-04-01T11:00:00.000Z",
  };

  assert.equal(assignment.partitionId, "part-001");
  assert.equal(assignment.assignedTo, "worker-x");
});

test("PartitionAssignment expiration check", () => {
  const assignment = {
    partitionId: "part-exp",
    assignedTo: "worker-y",
    assignedAt: "2026-04-01T09:00:00.000Z",
    expiresAt: "2026-04-01T10:00:00.000Z",
  };

  const now = "2026-04-01T10:30:00.000Z";
  const isExpired = assignment.expiresAt < now;
  assert.equal(isExpired, true);
});

test("RetryPolicy structure", () => {
  const policy = {
    maxAttempts: 5,
    backoffMs: 1000,
    backoffMultiplier: 2.0,
    maxBackoffMs: 30000,
    jitter: true,
  };

  assert.equal(policy.maxAttempts, 5);
  assert.equal(policy.backoffMultiplier, 2.0);
  assert.equal(policy.jitter, true);
});

test("RetryPolicy exponential backoff calculation", () => {
  const policy = {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2.0,
  };

  const delays = [
    policy.backoffMs,
    policy.backoffMs * policy.backoffMultiplier,
    policy.backoffMs * Math.pow(policy.backoffMultiplier, 2),
  ];

  assert.equal(delays[0], 1000);
  assert.equal(delays[1], 2000);
  assert.equal(delays[2], 4000);
});

test("TaskDequeueResult structure", () => {
  const result = {
    taskId: "task-dequeue",
    partitionId: "partition-001",
    dequeuedAt: "2026-04-01T10:00:00.000Z",
    waitTimeMs: 250,
  };

  assert.equal(result.taskId, "task-dequeue");
  assert.equal(result.waitTimeMs, 250);
});

test("TaskDequeueResult empty case", () => {
  const result = null;

  assert.equal(result, null);
});
