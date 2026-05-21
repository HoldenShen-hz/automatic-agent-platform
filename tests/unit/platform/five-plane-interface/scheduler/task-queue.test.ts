import { strict as assert } from "node:assert";
import { test } from "node:test";
import type {
  TaskQueueConfig,
  TaskQueueItem,
  TaskQueuePartition,
  TaskSchedulerConfig,
  QueueMetrics,
  PartitionAssignment,
  RetryPolicy,
  TaskDequeueResult,
} from "../../../../../src/platform/five-plane-interface/scheduler/task-queue.js";

test("TaskQueueConfig has required fields", () => {
  const config: TaskQueueConfig = {
    queueName: "test-queue",
    maxSize: 100,
  };
  assert.equal(config.queueName, "test-queue");
  assert.equal(config.maxSize, 100);
});

test("TaskQueueItem has required fields", () => {
  const item: TaskQueueItem = {
    taskId: "task_123",
    priority: 5,
    enqueuedAt: "2026-05-01T00:00:00.000Z",
    payload: { key: "value" },
  };
  assert.equal(item.taskId, "task_123");
  assert.equal(item.priority, 5);
  assert.equal(item.enqueuedAt, "2026-05-01T00:00:00.000Z");
  assert.deepEqual(item.payload, { key: "value" });
});

test("TaskQueuePartition has required fields", () => {
  const partition: TaskQueuePartition = {
    partitionId: "part_1",
    queueName: "test-queue",
    workerId: "worker_1",
    currentLoad: 10,
    maxLoad: 50,
  };
  assert.equal(partition.partitionId, "part_1");
  assert.equal(partition.queueName, "test-queue");
  assert.equal(partition.workerId, "worker_1");
  assert.equal(partition.currentLoad, 10);
  assert.equal(partition.maxLoad, 50);
});

test("TaskSchedulerConfig supports all strategy types", () => {
  const strategies: TaskSchedulerConfig["strategy"][] = [
    "round-robin",
    "least-loaded",
    "random",
    "priority",
  ];

  for (const strategy of strategies) {
    const config: TaskSchedulerConfig = {
      schedulerId: "scheduler_1",
      numPartitions: 4,
      strategy,
      enabled: true,
    };
    assert.equal(config.strategy, strategy);
  }
});

test("TaskSchedulerConfig enabled flag controls scheduler state", () => {
  const enabledConfig: TaskSchedulerConfig = {
    schedulerId: "scheduler_1",
    numPartitions: 4,
    strategy: "round-robin",
    enabled: true,
  };
  assert.ok(enabledConfig.enabled);

  const disabledConfig: TaskSchedulerConfig = {
    schedulerId: "scheduler_1",
    numPartitions: 4,
    strategy: "round-robin",
    enabled: false,
  };
  assert.ok(!disabledConfig.enabled);
});

test("QueueMetrics tracks queue statistics", () => {
  const metrics: QueueMetrics = {
    queueName: "test-queue",
    depth: 42,
    enqueuedPerMinute: 10,
    dequeuedPerMinute: 8,
    averageWaitTimeMs: 500,
  };
  assert.equal(metrics.queueName, "test-queue");
  assert.equal(metrics.depth, 42);
  assert.equal(metrics.enqueuedPerMinute, 10);
  assert.equal(metrics.dequeuedPerMinute, 8);
  assert.equal(metrics.averageWaitTimeMs, 500);
});

test("PartitionAssignment has expiration tracking", () => {
  const assignment: PartitionAssignment = {
    partitionId: "part_1",
    assignedTo: "worker_1",
    assignedAt: "2026-05-01T00:00:00.000Z",
    expiresAt: "2026-05-01T01:00:00.000Z",
  };
  assert.equal(assignment.partitionId, "part_1");
  assert.equal(assignment.assignedTo, "worker_1");
  assert.equal(assignment.assignedAt, "2026-05-01T00:00:00.000Z");
  assert.equal(assignment.expiresAt, "2026-05-01T01:00:00.000Z");
});

test("RetryPolicy with all fields", () => {
  const policy: RetryPolicy = {
    maxAttempts: 5,
    backoffMs: 1000,
    backoffMultiplier: 2.0,
    maxBackoffMs: 30000,
    jitter: true,
  };
  assert.equal(policy.maxAttempts, 5);
  assert.equal(policy.backoffMs, 1000);
  assert.equal(policy.backoffMultiplier, 2.0);
  assert.equal(policy.maxBackoffMs, 30000);
  assert.ok(policy.jitter);
});

test("RetryPolicy with only required fields", () => {
  const policy: RetryPolicy = {
    maxAttempts: 3,
    backoffMs: 500,
  };
  assert.equal(policy.maxAttempts, 3);
  assert.equal(policy.backoffMs, 500);
  assert.equal(policy.backoffMultiplier, undefined);
  assert.equal(policy.maxBackoffMs, undefined);
  assert.equal(policy.jitter, undefined);
});

test("TaskDequeueResult tracks dequeue operation", () => {
  const result: TaskDequeueResult = {
    taskId: "task_123",
    partitionId: "part_1",
    dequeuedAt: "2026-05-01T00:05:00.000Z",
    waitTimeMs: 300000,
  };
  assert.equal(result.taskId, "task_123");
  assert.equal(result.partitionId, "part_1");
  assert.equal(result.dequeuedAt, "2026-05-01T00:05:00.000Z");
  assert.equal(result.waitTimeMs, 300000);
});
