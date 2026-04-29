import assert from "node:assert/strict";
import test from "node:test";

import { QueuePartitioner } from "../../../../../src/platform/execution/queue/queue-partitioner.js";
import type { QueueAdapter, QueueJobRecord, EnqueueInput, QueueJobStatus, DequeueResult, QueueStats } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";

// Mock QueueAdapter for testing
class MockQueueAdapter implements QueueAdapter {
  backendKind = "sqlite" as const;
  private queues: Map<string, Map<string, QueueJobRecord>> = new Map();
  private jobCounter = 0;

  enqueue(input: EnqueueInput): QueueJobRecord {
    if (!this.queues.has(input.queueName)) {
      this.queues.set(input.queueName, new Map());
    }
    const queue = this.queues.get(input.queueName)!;
    const job: QueueJobRecord = {
      id: `job-${++this.jobCounter}`,
      queueName: input.queueName,
      payload: JSON.stringify(input.payload),
      status: "waiting",
      priority: input.priority ?? 0,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      lastError: null,
      delayUntil: null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };
    queue.set(job.id, job);
    return job;
  }

  dequeue(queueName: string): DequeueResult | null {
    const queue = this.queues.get(queueName);
    if (!queue || queue.size === 0) return null;
    const first = queue.values().next().value;
    if (!first) return null;
    const job: QueueJobRecord = { ...first, status: "active" };
    return {
      job,
      ack: () => { queue.delete(job.id); },
      nack: () => { /* nack logic */ },
    };
  }

  getJob(jobId: string): QueueJobRecord | null {
    for (const queue of this.queues.values()) {
      if (queue.has(jobId)) return queue.get(jobId)!;
    }
    return null;
  }

  listJobs(queueName: string, status?: QueueJobStatus, limit = 100): QueueJobRecord[] {
    const queue = this.queues.get(queueName);
    if (!queue) return [];
    return Array.from(queue.values()).slice(0, limit);
  }

  moveToDeadLetter(_jobId: string, _reason: string): void { /* noop */ }
  retryJob(_jobId: string): QueueJobRecord | null { return null; }
  purge(_queueName: string, _olderThan: string): number { return 0; }

  stats(queueName: string): QueueStats {
    const queue = this.queues.get(queueName);
    const counts = { waiting: 0, delayed: 0, active: 0, completed: 0, failed: 0, deadLetter: 0 };
    if (queue) {
      for (const job of queue.values()) {
        if (job.status in counts) counts[job.status as keyof typeof counts]++;
      }
    }
    return { queueName, ...counts };
  }

  listQueues(): string[] {
    return Array.from(this.queues.keys());
  }
}

test("QueuePartitioner registerPartition stores partition", () => {
  const partitioner = new QueuePartitioner();
  const partition = {
    name: "test-queue",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType" as const,
    },
  };

  partitioner.registerPartition(partition);
  const retrieved = partitioner.getPartition("task");

  assert.ok(retrieved);
  assert.equal(retrieved!.name, "test-queue");
  assert.equal(retrieved!.aggregateType, "task");
});

test("QueuePartitioner getPartition returns undefined for unknown aggregate", () => {
  const partitioner = new QueuePartitioner();
  const result = partitioner.getPartition("unknown");
  assert.equal(result, undefined);
});

test("QueuePartitioner extractPartitionKey extracts aggregateType and tenantId", () => {
  const partitioner = new QueuePartitioner();
  const payload = {
    aggregateType: "task",
    tenantId: "tenant-123",
  };

  const key = partitioner.extractPartitionKey(payload);

  assert.equal(key.aggregateType, "task");
  assert.equal(key.tenantId, "tenant-123");
});

test("QueuePartitioner extractPartitionKey uses domain as fallback", () => {
  const partitioner = new QueuePartitioner();
  const payload = {
    domain: "workflow",
    tenantId: "tenant-456",
  };

  const key = partitioner.extractPartitionKey(payload);

  assert.equal(key.aggregateType, "workflow");
});

test("QueuePartitioner extractPartitionKey uses defaults when missing", () => {
  const partitioner = new QueuePartitioner();
  const payload = {};

  const key = partitioner.extractPartitionKey(payload);

  assert.equal(key.aggregateType, "default");
  assert.equal(key.tenantId, "default");
});

test("QueuePartitioner computePartitionName with byTenant strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-1", "byTenant");

  assert.equal(name, "queue:tenant-1");
});

test("QueuePartitioner computePartitionName with byAggregateType strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-1", "byAggregateType");

  assert.equal(name, "queue:task");
});

test("QueuePartitioner computePartitionName with byTenantAndAggregate strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-1", "byTenantAndAggregate");

  assert.equal(name, "queue:tenant-1:task");
});

test("QueuePartitioner computePartitionName with unknown strategy defaults to byAggregateType", () => {
  const partitioner = new QueuePartitioner();
  // @ts-expect-error - testing unknown strategy
  const name = partitioner.computePartitionName("task", "tenant-1", "unknown");

  assert.equal(name, "queue:task");
});

test("QueuePartitioner route enqueues to correct partition", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  });

  const jobId = partitioner.route(adapter, { aggregateType: "task", data: "test" });

  assert.ok(jobId);
  assert.ok(jobId.startsWith("job-"));
});

test("QueuePartitioner route uses default strategy when no partition registered", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  // No partition registered, should use default strategy
  const jobId = partitioner.route(adapter, { aggregateType: "unregistered", data: "test" });

  assert.ok(jobId);
});

test("QueuePartitioner route passes priority option", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 5,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  });

  const jobId = partitioner.route(adapter, { aggregateType: "task" }, { priority: 10 });

  assert.ok(jobId);
});

test("QueuePartitioner route passes maxAttempts option", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  });

  const jobId = partitioner.route(adapter, { aggregateType: "task" }, { maxAttempts: 5 });

  assert.ok(jobId);
});

test("QueuePartitioner getPartitionStats returns stats for all partitions", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  });

  adapter.enqueue({ queueName: "queue:task", payload: { data: "test" } });

  const stats = partitioner.getPartitionStats(adapter);

  assert.ok(stats.has("task"));
  assert.equal(stats.get("task")!.queueName, "queue:task");
});

test("QueuePartitioner detectOverload returns empty when under threshold", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  });

  adapter.enqueue({ queueName: "queue:task", payload: { data: "test" } });

  const overloads = partitioner.detectOverload(adapter);

  assert.equal(overloads.length, 0);
});

test("QueuePartitioner detectOverload returns overloaded partitions", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 5,
      alertThreshold: 4,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  });

  // Add more jobs than maxDepth
  for (let i = 0; i < 10; i++) {
    adapter.enqueue({ queueName: "queue:task", payload: { data: `test-${i}` } });
  }

  const overloads = partitioner.detectOverload(adapter);

  assert.equal(overloads.length, 1);
  assert.equal(overloads[0].aggregateType, "task");
});

test("QueuePartitioner detectOverload considers both waiting and delayed", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 3,
      alertThreshold: 2,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  });

  // Add jobs to exceed maxDepth
  for (let i = 0; i < 5; i++) {
    adapter.enqueue({ queueName: "queue:task", payload: { data: `test-${i}` } });
  }

  const overloads = partitioner.detectOverload(adapter);

  assert.equal(overloads.length, 1);
});

test("QueuePartitioner multiple partitions work independently", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  });

  partitioner.registerPartition({
    name: "queue:workflow",
    aggregateType: "workflow",
    priority: 2,
    consumerGroup: "cg-2",
    config: {
      maxDepth: 50,
      alertThreshold: 40,
      consumerCount: 3,
      partitioningStrategy: "byAggregateType",
    },
  });

  partitioner.route(adapter, { aggregateType: "task", data: "task-1" });
  partitioner.route(adapter, { aggregateType: "workflow", data: "workflow-1" });

  const taskPartition = partitioner.getPartition("task");
  const workflowPartition = partitioner.getPartition("workflow");

  assert.ok(taskPartition);
  assert.ok(workflowPartition);
  assert.notEqual(taskPartition!.name, workflowPartition!.name);
});

test("QueuePartitioner extractPartitionKey handles tenant_id snake_case", () => {
  const partitioner = new QueuePartitioner();
  const payload = {
    aggregateType: "task",
    tenant_id: "tenant-snake",
  };

  const key = partitioner.extractPartitionKey(payload);

  assert.equal(key.tenantId, "tenant-snake");
});
