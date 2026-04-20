import assert from "node:assert/strict";
import test from "node:test";

import { QueuePartitioner, type QueuePartition } from "../../../../../src/platform/execution/queue/queue-partitioner.js";
import type { QueueAdapter, QueueJobRecord } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";

// Mock QueueAdapter for testing
class MockQueueAdapter implements QueueAdapter {
  backendKind = "sqlite" as const;
  private queues: Map<string, Map<string, QueueJobRecord>> = new Map();
  private jobCounter = 0;

  enqueue(input): QueueJobRecord {
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

  dequeue(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue || queue.size === 0) return null;
    const first = queue.values().next().value;
    const job = { ...first, status: "active" as const };
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

  listJobs(queueName: string, status?, limit = 100): QueueJobRecord[] {
    const queue = this.queues.get(queueName);
    if (!queue) return [];
    return Array.from(queue.values()).slice(0, limit);
  }

  moveToDeadLetter(jobId: string, reason: string): void { /* noop */ }
  retryJob(jobId: string): QueueJobRecord | null { return null; }
  purge(queueName: string, olderThan: string): number { return 0; }

  stats(queueName: string) {
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

  _addJobs(queueName: string, count: number, status: QueueJobRecord["status"] = "waiting"): void {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, new Map());
    }
    const queue = this.queues.get(queueName)!;
    for (let i = 0; i < count; i++) {
      const job: QueueJobRecord = {
        id: `job-${++this.jobCounter}`,
        queueName,
        payload: "{}",
        status,
        priority: 0,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        delayUntil: null,
        idempotencyKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };
      queue.set(job.id, job);
    }
  }
}

test("QueuePartitioner extracts partition key from payload", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({ aggregateType: "task", tenantId: "tenant-123" });
  assert.equal(key.aggregateType, "task");
  assert.equal(key.tenantId, "tenant-123");
});

test("QueuePartitioner defaults to 'default' when no aggregate type", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({});
  assert.equal(key.aggregateType, "default");
});

test("QueuePartitioner computes partition names by strategy", () => {
  const partitioner = new QueuePartitioner();
  assert.equal(partitioner.computePartitionName("task", "tenant-1", "byTenant"), "queue:tenant-1");
  assert.equal(partitioner.computePartitionName("task", "tenant-1", "byAggregateType"), "queue:task");
  assert.equal(partitioner.computePartitionName("task", "tenant-1", "byTenantAndAggregate"), "queue:tenant-1:task");
});

test("QueuePartitioner registers and retrieves partitions", () => {
  const partitioner = new QueuePartitioner();
  const partition: QueuePartition = {
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-task",
    config: { maxDepth: 100, alertThreshold: 80, consumerCount: 2, partitioningStrategy: "byAggregateType" },
  };
  partitioner.registerPartition(partition);
  assert.equal(partitioner.getPartition("task"), partition);
  assert.equal(partitioner.getPartition("unregistered"), undefined);
});

test("QueuePartitioner routes jobs to correct partition", () => {
  const partitioner = new QueuePartitioner();
  const mockAdapter = new MockQueueAdapter();
  const partition: QueuePartition = {
    name: "queue:execution",
    aggregateType: "execution",
    priority: 1,
    consumerGroup: "cg-execution",
    config: { maxDepth: 100, alertThreshold: 80, consumerCount: 2, partitioningStrategy: "byAggregateType" },
  };
  partitioner.registerPartition(partition);

  const jobId = partitioner.route(mockAdapter, { aggregateType: "execution", tenantId: "t1" });
  assert.ok(jobId);
  assert.ok(mockAdapter.listQueues().includes("queue:execution"));
});

test("QueuePartitioner detects overload when partition exceeds maxDepth", () => {
  const partitioner = new QueuePartitioner();
  const mockAdapter = new MockQueueAdapter();
  const partition: QueuePartition = {
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-task",
    config: { maxDepth: 5, alertThreshold: 4, consumerCount: 1, partitioningStrategy: "byAggregateType" },
  };
  partitioner.registerPartition(partition);
  mockAdapter._addJobs("queue:task", 10, "waiting");

  const overloads = partitioner.detectOverload(mockAdapter);
  assert.equal(overloads.length, 1);
  assert.equal(overloads[0].aggregateType, "task");
});

test("QueuePartitioner returns empty overload array when no partition overloaded", () => {
  const partitioner = new QueuePartitioner();
  const mockAdapter = new MockQueueAdapter();
  const partition: QueuePartition = {
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-task",
    config: { maxDepth: 100, alertThreshold: 80, consumerCount: 2, partitioningStrategy: "byAggregateType" },
  };
  partitioner.registerPartition(partition);
  mockAdapter._addJobs("queue:task", 5, "waiting");

  const overloads = partitioner.detectOverload(mockAdapter);
  assert.equal(overloads.length, 0);
});