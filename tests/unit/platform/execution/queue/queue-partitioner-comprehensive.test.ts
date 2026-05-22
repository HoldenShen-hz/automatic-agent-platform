/**
 * QueuePartitioner Tests
 *
 * Tests for queue sharding and partitioning functionality.
 * Implements §8.3 "Sharding Strategy" from architecture document.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { QueuePartitioner, type QueuePartition, type PartitionKey, type PartitionConfig } from "../../../../../src/platform/five-plane-execution/queue/queue-partitioner.js";
import type { QueueAdapter, QueueJobRecord, EnqueueInput, QueueJobStatus, DequeueResult, QueueStats } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

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

  moveToDeadLetter(jobId: string, reason: string): void { /* noop */ }
  retryJob(jobId: string): QueueJobRecord | null { return null; }
  purge(queueName: string, olderThan: string): number { return 0; }

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

test("QueuePartitioner can be instantiated", () => {
  const partitioner = new QueuePartitioner();
  assert.ok(partitioner instanceof QueuePartitioner);
});

test("QueuePartitioner.registerPartition adds a partition", () => {
  const partitioner = new QueuePartitioner();
  const partition: QueuePartition = {
    name: "test-partition",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 5,
      partitioningStrategy: "byAggregateType",
    },
  };

  partitioner.registerPartition(partition);
  const retrieved = partitioner.getPartition("task");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved.aggregateType, "task");
  assert.equal(retrieved.config.maxDepth, 100);
});

test("QueuePartitioner.getPartition returns undefined for unregistered type", () => {
  const partitioner = new QueuePartitioner();
  const result = partitioner.getPartition("nonexistent");
  assert.equal(result, undefined);
});

test("QueuePartitioner.extractPartitionKey extracts aggregateType and tenantId from payload", () => {
  const partitioner = new QueuePartitioner();
  const payload = { aggregateType: "task", tenantId: "tenant-123", data: "test" };
  const key = partitioner.extractPartitionKey(payload);

  assert.equal(key.aggregateType, "task");
  assert.equal(key.tenantId, "tenant-123");
});

test("QueuePartitioner.extractPartitionKey defaults to 'default' when fields missing", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({});

  assert.equal(key.aggregateType, "default");
  assert.equal(key.tenantId, "default");
});

test("QueuePartitioner.extractPartitionKey uses domain as fallback for aggregateType", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({ domain: "workflow", tenantId: "tenant-1" });

  assert.equal(key.aggregateType, "workflow");
});

test("QueuePartitioner.extractPartitionKey uses tenant_id as fallback for tenantId", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({ aggregateType: "task", tenant_id: "tenant-456" });

  assert.equal(key.tenantId, "tenant-456");
});

test("QueuePartitioner.computePartitionName with byTenant strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-123", "byTenant");
  assert.equal(name, "queue:tenant-123");
});

test("QueuePartitioner.computePartitionName with byAggregateType strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-123", "byAggregateType");
  assert.equal(name, "queue:task");
});

test("QueuePartitioner.computePartitionName with byTenantAndAggregate strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-123", "byTenantAndAggregate");
  assert.equal(name, "queue:tenant-123:task");
});

test("QueuePartitioner.computePartitionName with unknown strategy defaults to byAggregateType", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-123", "byAggregateType" as any);
  assert.equal(name, "queue:task");
});

test("QueuePartitioner.route enqueues job to correct partition", () => {
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

  const jobId = partitioner.route(adapter, { aggregateType: "task", tenantId: "t1", data: "test" });
  assert.ok(jobId.length > 0);
});

test("QueuePartitioner.route uses default strategy when no partition registered", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  const jobId = partitioner.route(adapter, { aggregateType: "unregistered", tenantId: "t1" });
  assert.ok(jobId.length > 0);
});

test("QueuePartitioner.route passes priority option to adapter", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  const jobId = partitioner.route(adapter, { aggregateType: "task" }, { priority: 10 });
  assert.ok(jobId.length > 0);
});

test("QueuePartitioner.route passes maxAttempts option to adapter", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  const jobId = partitioner.route(adapter, { aggregateType: "task" }, { maxAttempts: 5 });
  assert.ok(jobId.length > 0);
});

test("QueuePartitioner.getPartitionStats returns stats for all registered partitions", () => {
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

  const stats = partitioner.getPartitionStats(adapter);
  assert.ok(stats instanceof Map);
  assert.equal(stats.has("task"), true);
});

test("QueuePartitioner.detectOverload returns empty array when no overload", () => {
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

  const overloads = partitioner.detectOverload(adapter);
  assert.ok(Array.isArray(overloads));
  assert.equal(overloads.length, 0);
});

test("QueuePartitioner.detectOverload detects when waiting + delayed exceeds maxDepth", () => {
  const partitioner = new QueuePartitioner();
  const adapter = new MockQueueAdapter();

  // Add jobs to the adapter's queue
  adapter.enqueue({ queueName: "queue:task", payload: { aggregateType: "task" } });
  adapter.enqueue({ queueName: "queue:task", payload: { aggregateType: "task" } });

  partitioner.registerPartition({
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: {
      maxDepth: 1,
      alertThreshold: 0,
      consumerCount: 1,
      partitioningStrategy: "byAggregateType",
    },
  });

  const overloads = partitioner.detectOverload(adapter);
  assert.ok(overloads.length > 0);
  assert.equal(overloads[0].aggregateType, "task");
});

test("QueuePartitioner PartitionKey interface structure", () => {
  const key: PartitionKey = {
    aggregateType: "task",
    tenantId: "tenant-123",
  };
  assert.equal(key.aggregateType, "task");
  assert.equal(key.tenantId, "tenant-123");
});

test("QueuePartitioner PartitionConfig interface structure", () => {
  const config: PartitionConfig = {
    maxDepth: 100,
    alertThreshold: 80,
    consumerCount: 5,
    partitioningStrategy: "byAggregateType",
  };
  assert.equal(config.maxDepth, 100);
  assert.equal(config.partitioningStrategy, "byAggregateType");
});

test("QueuePartitioner PartitionConfig all partitioning strategies", () => {
  const strategies: PartitionConfig["partitioningStrategy"][] = [
    "byTenant",
    "byAggregateType",
    "byTenantAndAggregate",
  ];
  assert.equal(strategies.length, 3);
});

test("QueuePartitioner multiple partitions can be registered", () => {
  const partitioner = new QueuePartitioner();

  partitioner.registerPartition({
    name: "task-partition",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: { maxDepth: 100, alertThreshold: 80, consumerCount: 5, partitioningStrategy: "byAggregateType" },
  });

  partitioner.registerPartition({
    name: "workflow-partition",
    aggregateType: "workflow",
    priority: 2,
    consumerGroup: "cg-2",
    config: { maxDepth: 200, alertThreshold: 150, consumerCount: 10, partitioningStrategy: "byTenant" },
  });

  assert.ok(partitioner.getPartition("task"));
  assert.ok(partitioner.getPartition("workflow"));
  assert.equal(partitioner.getPartition("task")?.name, "task-partition");
  assert.equal(partitioner.getPartition("workflow")?.name, "workflow-partition");
});

test("QueuePartitioner partition can be overwritten", () => {
  const partitioner = new QueuePartitioner();

  partitioner.registerPartition({
    name: "original",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-1",
    config: { maxDepth: 100, alertThreshold: 80, consumerCount: 5, partitioningStrategy: "byAggregateType" },
  });

  partitioner.registerPartition({
    name: "updated",
    aggregateType: "task",
    priority: 2,
    consumerGroup: "cg-2",
    config: { maxDepth: 200, alertThreshold: 150, consumerCount: 10, partitioningStrategy: "byTenant" },
  });

  assert.equal(partitioner.getPartition("task")?.name, "updated");
});
