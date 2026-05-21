/**
 * Unit tests for task-queue.ts legacy queue contracts
 * Tests src/platform/five-plane-interface/scheduler/task-queue.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import types to verify they are exported and usable
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

// ============================================================
// TaskQueueConfig Tests
// ============================================================

test("TaskQueueConfig requires queueName and maxSize", () => {
  const config: TaskQueueConfig = {
    queueName: "test_queue",
    maxSize: 1000,
  };

  assert.equal(config.queueName, "test_queue");
  assert.equal(config.maxSize, 1000);
});

test("TaskQueueConfig with all optional fields", () => {
  const config: TaskQueueConfig = {
    queueName: "full_config_queue",
    maxSize: 5000,
    priorityLevels: 10,
    timeout: 60000,
    retryPolicy: {
      maxAttempts: 5,
      backoffMs: 2000,
      backoffMultiplier: 2.0,
      maxBackoffMs: 60000,
      jitter: true,
    },
  };

  assert.equal(config.queueName, "full_config_queue");
  assert.equal(config.maxSize, 5000);
  assert.equal(config.priorityLevels, 10);
  assert.equal(config.timeout, 60000);
  assert.deepEqual(config.retryPolicy, {
    maxAttempts: 5,
    backoffMs: 2000,
    backoffMultiplier: 2.0,
    maxBackoffMs: 60000,
    jitter: true,
  });
});

test("TaskQueueConfig retryPolicy without optional fields", () => {
  const config: TaskQueueConfig = {
    queueName: "minimal_retry_queue",
    maxSize: 500,
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
    },
  };

  assert.equal(config.retryPolicy!.maxAttempts, 3);
  assert.equal(config.retryPolicy!.backoffMs, 1000);
  assert.equal(config.retryPolicy!.backoffMultiplier, undefined);
  assert.equal(config.retryPolicy!.maxBackoffMs, undefined);
  assert.equal(config.retryPolicy!.jitter, undefined);
});

test("TaskQueueConfig default-like structure", () => {
  const config: TaskQueueConfig = {
    queueName: "default_queue",
    maxSize: 100,
    priorityLevels: 3,
    timeout: 30000,
  };

  assert.equal(config.queueName, "default_queue");
  assert.equal(config.maxSize, 100);
  assert.equal(config.priorityLevels, 3);
  assert.equal(config.timeout, 30000);
  assert.equal(config.retryPolicy, undefined);
});

// ============================================================
// TaskQueueItem Tests
// ============================================================

test("TaskQueueItem with all fields", () => {
  const item: TaskQueueItem = {
    taskId: "task_qi_1",
    priority: 100,
    enqueuedAt: "2026-05-01T10:00:00.000Z",
    payload: { action: "process", data: { key: "value" } },
  };

  assert.equal(item.taskId, "task_qi_1");
  assert.equal(item.priority, 100);
  assert.equal(item.enqueuedAt, "2026-05-01T10:00:00.000Z");
  assert.deepEqual(item.payload, { action: "process", data: { key: "value" } });
});

test("TaskQueueItem with nested payload", () => {
  const item: TaskQueueItem = {
    taskId: "task_nested",
    priority: 50,
    enqueuedAt: "2026-05-01T12:00:00.000Z",
    payload: {
      workflowId: "wf_123",
      steps: [
        { stepId: "step_1", action: "approve" },
        { stepId: "step_2", action: "execute" },
      ],
    },
  };

  assert.equal(item.taskId, "task_nested");
  assert.ok(Array.isArray(item.payload.steps));
  assert.equal(item.payload.steps.length, 2);
});

test("TaskQueueItem with empty payload", () => {
  const item: TaskQueueItem = {
    taskId: "task_empty",
    priority: 0,
    enqueuedAt: "2026-05-01T09:00:00.000Z",
    payload: {},
  };

  assert.deepEqual(item.payload, {});
});

test("TaskQueueItem with numeric priority bounds", () => {
  const lowPriority: TaskQueueItem = {
    taskId: "task_low",
    priority: 0,
    enqueuedAt: "2026-05-01T09:00:00.000Z",
    payload: {},
  };

  const highPriority: TaskQueueItem = {
    taskId: "task_high",
    priority: 9999,
    enqueuedAt: "2026-05-01T09:00:00.000Z",
    payload: {},
  };

  assert.equal(lowPriority.priority, 0);
  assert.equal(highPriority.priority, 9999);
});

// ============================================================
// TaskQueuePartition Tests
// ============================================================

test("TaskQueuePartition with all fields", () => {
  const partition: TaskQueuePartition = {
    partitionId: "partition_abc",
    queueName: "tasks",
    workerId: "worker_xyz",
    currentLoad: 25,
    maxLoad: 100,
  };

  assert.equal(partition.partitionId, "partition_abc");
  assert.equal(partition.queueName, "tasks");
  assert.equal(partition.workerId, "worker_xyz");
  assert.equal(partition.currentLoad, 25);
  assert.equal(partition.maxLoad, 100);
});

test("TaskQueuePartition load calculation", () => {
  const partition: TaskQueuePartition = {
    partitionId: "part_load",
    queueName: "tasks",
    workerId: "worker_load",
    currentLoad: 75,
    maxLoad: 100,
  };

  const loadPercentage = (partition.currentLoad / partition.maxLoad) * 100;
  assert.equal(loadPercentage, 75);
});

test("TaskQueuePartition at capacity", () => {
  const partition: TaskQueuePartition = {
    partitionId: "part_full",
    queueName: "tasks",
    workerId: "worker_full",
    currentLoad: 100,
    maxLoad: 100,
  };

  const loadPercentage = (partition.currentLoad / partition.maxLoad) * 100;
  assert.equal(loadPercentage, 100);
});

test("TaskQueuePartition empty", () => {
  const partition: TaskQueuePartition = {
    partitionId: "part_empty",
    queueName: "tasks",
    workerId: "worker_empty",
    currentLoad: 0,
    maxLoad: 50,
  };

  assert.equal(partition.currentLoad, 0);
  assert.equal(partition.maxLoad, 50);
});

test("TaskQueuePartition load distribution across multiple partitions", () => {
  const partitions: TaskQueuePartition[] = [
    { partitionId: "p1", queueName: "tasks", workerId: "w1", currentLoad: 10, maxLoad: 100 },
    { partitionId: "p2", queueName: "tasks", workerId: "w2", currentLoad: 20, maxLoad: 100 },
    { partitionId: "p3", queueName: "tasks", workerId: "w3", currentLoad: 30, maxLoad: 100 },
  ];

  const totalLoad = partitions.reduce((sum, p) => sum + p.currentLoad, 0);
  const avgLoad = totalLoad / partitions.length;

  assert.equal(totalLoad, 60);
  assert.equal(avgLoad, 20);
});

// ============================================================
// TaskSchedulerConfig Tests
// ============================================================

test("TaskSchedulerConfig with round-robin strategy", () => {
  const config: TaskSchedulerConfig = {
    schedulerId: "scheduler_rr",
    numPartitions: 4,
    strategy: "round-robin",
    enabled: true,
  };

  assert.equal(config.strategy, "round-robin");
  assert.equal(config.numPartitions, 4);
  assert.equal(config.enabled, true);
});

test("TaskSchedulerConfig with least-loaded strategy", () => {
  const config: TaskSchedulerConfig = {
    schedulerId: "scheduler_ll",
    numPartitions: 8,
    strategy: "least-loaded",
    enabled: true,
  };

  assert.equal(config.strategy, "least-loaded");
});

test("TaskSchedulerConfig with random strategy", () => {
  const config: TaskSchedulerConfig = {
    schedulerId: "scheduler_rand",
    numPartitions: 2,
    strategy: "random",
    enabled: false,
  };

  assert.equal(config.strategy, "random");
  assert.equal(config.enabled, false);
});

test("TaskSchedulerConfig with priority strategy", () => {
  const config: TaskSchedulerConfig = {
    schedulerId: "scheduler_prio",
    numPartitions: 16,
    strategy: "priority",
    enabled: true,
  };

  assert.equal(config.strategy, "priority");
});

test("TaskSchedulerConfig all strategies are valid", () => {
  const strategies: TaskSchedulerConfig["strategy"][] = ["round-robin", "least-loaded", "random", "priority"];

  for (const strategy of strategies) {
    const config: TaskSchedulerConfig = {
      schedulerId: `scheduler_${strategy}`,
      numPartitions: 4,
      strategy,
      enabled: true,
    };
    assert.equal(config.strategy, strategy);
  }
});

// ============================================================
// QueueMetrics Tests
// ============================================================

test("QueueMetrics with all fields", () => {
  const metrics: QueueMetrics = {
    queueName: "tasks",
    depth: 150,
    enqueuedPerMinute: 30,
    dequeuedPerMinute: 25,
    averageWaitTimeMs: 450,
  };

  assert.equal(metrics.queueName, "tasks");
  assert.equal(metrics.depth, 150);
  assert.equal(metrics.enqueuedPerMinute, 30);
  assert.equal(metrics.dequeuedPerMinute, 25);
  assert.equal(metrics.averageWaitTimeMs, 450);
});

test("QueueMetrics with zero activity", () => {
  const metrics: QueueMetrics = {
    queueName: "idle_queue",
    depth: 0,
    enqueuedPerMinute: 0,
    dequeuedPerMinute: 0,
    averageWaitTimeMs: 0,
  };

  assert.equal(metrics.depth, 0);
  assert.equal(metrics.enqueuedPerMinute, 0);
  assert.equal(metrics.dequeuedPerMinute, 0);
  assert.equal(metrics.averageWaitTimeMs, 0);
});

test("QueueMetrics throughput calculation", () => {
  const metrics: QueueMetrics = {
    queueName: "throughput_test",
    depth: 100,
    enqueuedPerMinute: 60,
    dequeuedPerMinute: 60,
    averageWaitTimeMs: 500,
  };

  const netGrowth = metrics.enqueuedPerMinute - metrics.dequeuedPerMinute;
  assert.equal(netGrowth, 0);
});

test("QueueMetrics growing queue detection", () => {
  const metrics: QueueMetrics = {
    queueName: "growing_queue",
    depth: 200,
    enqueuedPerMinute: 100,
    dequeuedPerMinute: 50,
    averageWaitTimeMs: 1000,
  };

  const netGrowth = metrics.enqueuedPerMinute - metrics.dequeuedPerMinute;
  assert.ok(netGrowth > 0);
  assert.ok(metrics.depth > 100);
});

// ============================================================
// PartitionAssignment Tests
// ============================================================

test("PartitionAssignment with all fields", () => {
  const assignment: PartitionAssignment = {
    partitionId: "part_active",
    assignedTo: "worker_active",
    assignedAt: "2026-05-01T08:00:00.000Z",
    expiresAt: "2026-05-01T10:00:00.000Z",
  };

  assert.equal(assignment.partitionId, "part_active");
  assert.equal(assignment.assignedTo, "worker_active");
  assert.equal(assignment.assignedAt, "2026-05-01T08:00:00.000Z");
  assert.equal(assignment.expiresAt, "2026-05-01T10:00:00.000Z");
});

test("PartitionAssignment expiration check - expired", () => {
  const assignment: PartitionAssignment = {
    partitionId: "part_exp",
    assignedTo: "worker_exp",
    assignedAt: "2026-05-01T06:00:00.000Z",
    expiresAt: "2026-05-01T08:00:00.000Z",
  };

  const now = "2026-05-01T09:00:00.000Z";
  const isExpired = assignment.expiresAt <= now;
  assert.equal(isExpired, true);
});

test("PartitionAssignment expiration check - not expired", () => {
  const assignment: PartitionAssignment = {
    partitionId: "part_valid",
    assignedTo: "worker_valid",
    assignedAt: "2026-05-01T10:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
  };

  const now = "2026-05-01T11:00:00.000Z";
  const isExpired = assignment.expiresAt <= now;
  assert.equal(isExpired, false);
});

test("PartitionAssignment expiration check - exactly at expiry", () => {
  const assignment: PartitionAssignment = {
    partitionId: "part_exact",
    assignedTo: "worker_exact",
    assignedAt: "2026-05-01T08:00:00.000Z",
    expiresAt: "2026-05-01T10:00:00.000Z",
  };

  const now = "2026-05-01T10:00:00.000Z";
  const isExpired = assignment.expiresAt <= now;
  assert.equal(isExpired, true);
});

// ============================================================
// RetryPolicy Tests
// ============================================================

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
  assert.equal(policy.jitter, true);
});

test("RetryPolicy minimal structure", () => {
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

test("RetryPolicy exponential backoff calculation without jitter", () => {
  const policy: RetryPolicy = {
    maxAttempts: 4,
    backoffMs: 1000,
    backoffMultiplier: 2.0,
  };

  const delays: number[] = [];
  for (let i = 0; i < policy.maxAttempts; i++) {
    delays.push(policy.backoffMs * Math.pow(policy.backoffMultiplier, i));
  }

  assert.deepEqual(delays, [1000, 2000, 4000, 8000]);
});

test("RetryPolicy with maxBackoffMs cap", () => {
  const policy: RetryPolicy = {
    maxAttempts: 5,
    backoffMs: 10000,
    backoffMultiplier: 2.0,
    maxBackoffMs: 30000,
  };

  // Without cap, 5th attempt would be 160000ms
  const calculatedDelay = policy.backoffMs * Math.pow(policy.backoffMultiplier, 4);
  const cappedDelay = Math.min(calculatedDelay, policy.maxBackoffMs!);

  assert.equal(calculatedDelay, 160000);
  assert.equal(cappedDelay, 30000);
});

test("RetryPolicy with jitter enabled", () => {
  const policy: RetryPolicy = {
    maxAttempts: 3,
    backoffMs: 1000,
    jitter: true,
  };

  assert.equal(policy.jitter, true);
  // With jitter, delays would vary, so we just verify the flag
});

test("RetryPolicy with jitter disabled", () => {
  const policy: RetryPolicy = {
    maxAttempts: 3,
    backoffMs: 1000,
    jitter: false,
  };

  assert.equal(policy.jitter, false);
});

// ============================================================
// TaskDequeueResult Tests
// ============================================================

test("TaskDequeueResult with all fields", () => {
  const result: TaskDequeueResult = {
    taskId: "task_deq_1",
    partitionId: "partition_deq_1",
    dequeuedAt: "2026-05-01T14:30:00.000Z",
    waitTimeMs: 150,
  };

  assert.equal(result.taskId, "task_deq_1");
  assert.equal(result.partitionId, "partition_deq_1");
  assert.equal(result.dequeuedAt, "2026-05-01T14:30:00.000Z");
  assert.equal(result.waitTimeMs, 150);
});

test("TaskDequeueResult with zero waitTimeMs", () => {
  const result: TaskDequeueResult = {
    taskId: "task_instant",
    partitionId: "partition_instant",
    dequeuedAt: "2026-05-01T14:30:00.000Z",
    waitTimeMs: 0,
  };

  assert.equal(result.waitTimeMs, 0);
});

test("TaskDequeueResult with long waitTimeMs", () => {
  const result: TaskDequeueResult = {
    taskId: "task_long_wait",
    partitionId: "partition_long_wait",
    dequeuedAt: "2026-05-01T14:30:00.000Z",
    waitTimeMs: 300000, // 5 minutes
  };

  assert.equal(result.waitTimeMs, 300000);
});

// ============================================================
// Integration-style Tests
// ============================================================

test("Queue config with retry policy calculates max delay", () => {
  const config: TaskQueueConfig = {
    queueName: "retry_calc_queue",
    maxSize: 1000,
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      backoffMultiplier: 2.0,
      maxBackoffMs: 10000,
    },
  };

  const maxDelay = config.retryPolicy!.backoffMs * Math.pow(config.retryPolicy!.backoffMultiplier, config.retryPolicy!.maxAttempts - 1);
  assert.equal(maxDelay, 4000);
});

test("Scheduler with multiple partitions tracks load correctly", () => {
  const schedulerConfig: TaskSchedulerConfig = {
    schedulerId: "multi_partition_scheduler",
    numPartitions: 4,
    strategy: "least-loaded",
    enabled: true,
  };

  const partitions: TaskQueuePartition[] = [
    { partitionId: "p1", queueName: "tasks", workerId: "w1", currentLoad: 10, maxLoad: 100 },
    { partitionId: "p2", queueName: "tasks", workerId: "w2", currentLoad: 50, maxLoad: 100 },
    { partitionId: "p3", queueName: "tasks", workerId: "w3", currentLoad: 30, maxLoad: 100 },
    { partitionId: "p4", queueName: "tasks", workerId: "w4", currentLoad: 90, maxLoad: 100 },
  ];

  // Find least loaded partition
  let leastLoaded = partitions[0]!;
  for (const partition of partitions) {
    if (partition.currentLoad < leastLoaded.currentLoad) {
      leastLoaded = partition;
    }
  }

  assert.equal(leastLoaded.partitionId, "p1");
  assert.equal(leastLoaded.currentLoad, 10);
  assert.equal(schedulerConfig.numPartitions, 4);
});

test("Metrics reflect queue health", () => {
  const metrics: QueueMetrics = {
    queueName: "health_check",
    depth: 80,
    enqueuedPerMinute: 20,
    dequeuedPerMinute: 15,
    averageWaitTimeMs: 250,
  };

  // Health indicator: positive net growth means queue is growing
  const netGrowth = metrics.enqueuedPerMinute - metrics.dequeuedPerMinute;
  assert.equal(netGrowth, 5);

  // Queue depth threshold check
  const highWaterMark = 100;
  const isHealthy = metrics.depth < highWaterMark && netGrowth >= 0;
  assert.equal(isHealthy, true);
});

test("Partition assignment with TTL calculation", () => {
  const assignment: PartitionAssignment = {
    partitionId: "ttl_part",
    assignedTo: "worker_ttl",
    assignedAt: "2026-05-01T10:00:00.000Z",
    expiresAt: "2026-05-01T11:00:00.000Z",
  };

  const assignedAtMs = new Date(assignment.assignedAt).getTime();
  const expiresAtMs = new Date(assignment.expiresAt).getTime();
  const ttlMs = expiresAtMs - assignedAtMs;
  const ttlMinutes = ttlMs / (60 * 1000);

  assert.equal(ttlMs, 3600000); // 1 hour in ms
  assert.equal(ttlMinutes, 60);
});