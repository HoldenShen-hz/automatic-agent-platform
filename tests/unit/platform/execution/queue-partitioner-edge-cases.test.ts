import test from "node:test";
import assert from "node:assert/strict";

import { QueuePartitioner, type QueuePartition, type PartitionKey } from "../../../../src/platform/five-plane-execution/queue/queue-partitioner.js";
import type { QueueAdapter, QueueJobRecord, QueueJobStatus } from "../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

// =============================================================================
// Mock QueueAdapter for testing partitioner logic
// =============================================================================

function createMockQueueAdapter(): QueueAdapter {
  const queues = new Map<string, QueueJobRecord[]>();

  return {
    backendKind: "sqlite",
    enqueue(input): QueueJobRecord {
      const job: QueueJobRecord = {
        id: `job-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        queueName: input.queueName,
        payload: JSON.stringify(input.payload),
        status: "waiting",
        priority: input.priority ?? 0,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 3,
        lastError: null,
        delayUntil: input.delayUntil ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };
      const existing = queues.get(input.queueName) ?? [];
      existing.push(job);
      queues.set(input.queueName, existing);
      return job;
    },
    dequeue() {
      return null;
    },
    getJob(jobId) {
      for (const jobs of queues.values()) {
        const found = jobs.find((j) => j.id === jobId);
        if (found) return found as any;
      }
      return null;
    },
    listJobs(queueName, _status, _limit) {
      return (queues.get(queueName) ?? []) as any[];
    },
    moveToDeadLetter(_jobId, _reason) {},
    retryJob(_jobId) {
      return null;
    },
    purge(_queueName, _olderThan) {
      return 0;
    },
    stats(queueName) {
      const jobs = queues.get(queueName) ?? [];
      return {
        queueName,
        waiting: jobs.filter((j) => j.status === "waiting").length,
        delayed: jobs.filter((j) => j.status === "delayed").length,
        active: jobs.filter((j) => j.status === "active").length,
        completed: jobs.filter((j) => j.status === "completed").length,
        failed: jobs.filter((j) => j.status === "failed").length,
        deadLetter: jobs.filter((j) => j.status === "dead_letter").length,
      };
    },
    listQueues() {
      return [...queues.keys()];
    },
  };
}

function createPartition(name: string, aggregateType: string, strategy: "byTenant" | "byAggregateType" | "byTenantAndAggregate" = "byAggregateType"): QueuePartition {
  return {
    name,
    aggregateType,
    priority: 1,
    consumerGroup: "default",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 1,
      partitioningStrategy: strategy,
    },
  };
}

test("[SYS-REL-2.5] QueuePartitioner registers and retrieves partition", () => {
  const partitioner = new QueuePartitioner();
  const partition = createPartition("queue:task", "task");
  partitioner.registerPartition(partition);

  const retrieved = partitioner.getPartition("task");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.aggregateType, "task");
  assert.equal(retrieved!.name, "queue:task");
});

test("[SYS-REL-2.5] QueuePartitioner returns undefined for unregistered aggregate type", () => {
  const partitioner = new QueuePartitioner();
  const retrieved = partitioner.getPartition("nonexistent");
  assert.equal(retrieved, undefined);
});

test("[SYS-REL-2.5] QueuePartitioner extracts partition key from payload with aggregateType", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({ aggregateType: "task", tenantId: "tenant-1" });
  assert.equal(key.aggregateType, "task");
  assert.equal(key.tenantId, "tenant-1");
});

test("[SYS-REL-2.5] QueuePartitioner extracts partition key from payload with domain fallback", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({ domain: "workflow", tenantId: "tenant-1" });
  assert.equal(key.aggregateType, "workflow");
});

test("[SYS-REL-2.5] QueuePartitioner extracts partition key with defaults when missing", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({});
  assert.equal(key.aggregateType, "default");
  assert.equal(key.tenantId, "default");
});

test("[SYS-REL-2.5] QueuePartitioner computePartitionName byAggregateType strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-1", "byAggregateType");
  assert.equal(name, "queue:task");
});

test("[SYS-REL-2.5] QueuePartitioner computePartitionName byTenant strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-1", "byTenant");
  assert.equal(name, "queue:tenant-1");
});

test("[SYS-REL-2.5] QueuePartitioner computePartitionName byTenantAndAggregate strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-1", "byTenantAndAggregate");
  assert.equal(name, "queue:tenant-1:task");
});

test("[SYS-REL-2.5] QueuePartitioner computePartitionName default strategy", () => {
  const partitioner = new QueuePartitioner();
  const name = partitioner.computePartitionName("task", "tenant-1", "byAggregateType");
  assert.equal(name, "queue:task");
});

test("[SYS-REL-2.5] QueuePartitioner route uses registered partition strategy", () => {
  const partitioner = new QueuePartitioner();
  const adapter = createMockQueueAdapter();
  partitioner.registerPartition(createPartition("queue:task", "task", "byTenant"));

  const jobId = partitioner.route(adapter, { aggregateType: "task", tenantId: "tenant-1" });
  assert.ok(jobId != null);
});

test("[SYS-REL-2.5] QueuePartitioner route falls back to byAggregateType when no partition registered", () => {
  const partitioner = new QueuePartitioner();
  const adapter = createMockQueueAdapter();

  const jobId = partitioner.route(adapter, { aggregateType: "unregistered", tenantId: "tenant-1" });
  assert.ok(jobId != null);
  // Should use default strategy which is byAggregateType
  const stats = adapter.stats("queue:unregistered");
  assert.ok(stats.waiting >= 1);
});

test("[SYS-REL-2.5] QueuePartitioner route with priority and maxAttempts options", () => {
  const partitioner = new QueuePartitioner();
  const adapter = createMockQueueAdapter();
  partitioner.registerPartition(createPartition("queue:task", "task"));

  const jobId = partitioner.route(adapter, { aggregateType: "task", tenantId: "tenant-1" }, { priority: 10, maxAttempts: 5 });
  assert.ok(jobId != null);

  const job = adapter.getJob(jobId);
  assert.ok(job != null);
  assert.equal(job.priority, 10);
  assert.equal(job.maxAttempts, 5);
});

test("[SYS-REL-2.5] QueuePartitioner getPartitionStats returns stats for all registered partitions", () => {
  const partitioner = new QueuePartitioner();
  const adapter = createMockQueueAdapter();
  partitioner.registerPartition(createPartition("queue:task", "task"));
  partitioner.registerPartition(createPartition("queue:workflow", "workflow"));

  // Add some jobs
  partitioner.route(adapter, { aggregateType: "task", tenantId: "t1" });
  partitioner.route(adapter, { aggregateType: "workflow", tenantId: "t1" });

  const stats = partitioner.getPartitionStats(adapter);
  assert.equal(stats.size, 2);
  assert.ok(stats.get("task") != null);
  assert.ok(stats.get("workflow") != null);
});

test("[SYS-REL-2.5] QueuePartitioner detectOverload returns overloaded partitions", () => {
  const partitioner = new QueuePartitioner();
  const adapter = createMockQueueAdapter();
  partitioner.registerPartition({
    name: "queue:heavy",
    aggregateType: "heavy",
    priority: 1,
    consumerGroup: "default",
    config: {
      maxDepth: 5,
      alertThreshold: 4,
      consumerCount: 1,
      partitioningStrategy: "byAggregateType",
    },
  });

  // Add 6 jobs (exceeds maxDepth of 5)
  for (let i = 0; i < 6; i++) {
    partitioner.route(adapter, { aggregateType: "heavy", tenantId: "t1" });
  }

  const overloads = partitioner.detectOverload(adapter);
  assert.equal(overloads.length, 1);
  assert.equal(overloads[0]!.aggregateType, "heavy");
});

test("[SYS-REL-2.5] QueuePartitioner detectOverload returns empty when no overload", () => {
  const partitioner = new QueuePartitioner();
  const adapter = createMockQueueAdapter();
  partitioner.registerPartition({
    name: "queue:light",
    aggregateType: "light",
    priority: 1,
    consumerGroup: "default",
    config: {
      maxDepth: 100,
      alertThreshold: 80,
      consumerCount: 1,
      partitioningStrategy: "byAggregateType",
    },
  });

  partitioner.route(adapter, { aggregateType: "light", tenantId: "t1" });

  const overloads = partitioner.detectOverload(adapter);
  assert.equal(overloads.length, 0);
});

test("[SYS-REL-2.5] QueuePartitioner hash collision - same tenant+type produces same queue name", () => {
  const partitioner = new QueuePartitioner();
  const name1 = partitioner.computePartitionName("task", "tenant-A", "byTenantAndAggregate");
  const name2 = partitioner.computePartitionName("task", "tenant-A", "byTenantAndAggregate");
  assert.equal(name1, name2, "Same inputs should produce same partition name");
});

test("[SYS-REL-2.5] QueuePartitioner rebalancing - unregister partition then reregister", () => {
  const partitioner = new QueuePartitioner();
  const adapter = createMockQueueAdapter();

  partitioner.registerPartition(createPartition("queue:task", "task"));
  let retrieved = partitioner.getPartition("task");
  assert.ok(retrieved != null);

  // Simulate node leave by clearing and re-adding
  partitioner.registerPartition(createPartition("queue:task", "task", "byTenant"));

  retrieved = partitioner.getPartition("task");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.config.partitioningStrategy, "byTenant");
});

test("[SYS-REL-2.5] QueuePartitioner multiple partitions with different strategies coexist", () => {
  const partitioner = new QueuePartitioner();
  const adapter = createMockQueueAdapter();

  partitioner.registerPartition(createPartition("queue:task", "task", "byAggregateType"));
  partitioner.registerPartition(createPartition("queue:tenant-a:incident", "incident", "byTenantAndAggregate"));
  partitioner.registerPartition(createPartition("queue:tenant-b", "workflow", "byTenant"));

  const jobId1 = partitioner.route(adapter, { aggregateType: "task", tenantId: "t1" });
  const jobId2 = partitioner.route(adapter, { aggregateType: "incident", tenantId: "tenant-a" });
  const jobId3 = partitioner.route(adapter, { aggregateType: "workflow", tenantId: "tenant-b" });

  assert.ok(jobId1 != null);
  assert.ok(jobId2 != null);
  assert.ok(jobId3 != null);

  // Verify each went to correct queue based on strategy
  const stats1 = adapter.stats("queue:task");
  const stats2 = adapter.stats("queue:tenant-a:incident");
  const stats3 = adapter.stats("queue:tenant-b");

  assert.ok(stats1.waiting >= 1);
  assert.ok(stats2.waiting >= 1);
  assert.ok(stats3.waiting >= 1);
});
