/**
 * Queue Partitioner Integration Tests
 *
 * Tests the queue partitioning logic for dispatch sharding.
 * Uses SQLite-based queue adapter for integration testing.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteQueueAdapter, QUEUE_JOBS_DDL } from "../../../../../src/platform/execution/queue/queue-adapter.js";
import { QueuePartitioner } from "../../../../../src/platform/execution/queue/queue-partitioner.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createQueueHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "partition-queue.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db };
}

test("QueuePartitioner: registerPartition and getPartition round-trip", () => {
  const h = createQueueHarness("aa-partitioner-register-");
  try {
    const partitioner = new QueuePartitioner();
    partitioner.registerPartition({
      name: "queue:tenant-a",
      aggregateType: "task",
      priority: 10,
      consumerGroup: "cg-1",
      config: {
        maxDepth: 100,
        alertThreshold: 80,
        consumerCount: 2,
        partitioningStrategy: "byTenant",
      },
    });

    const retrieved = partitioner.getPartition("task");
    assert.ok(retrieved, "Partition should be retrievable");
    assert.equal(retrieved!.name, "queue:tenant-a");
    assert.equal(retrieved!.aggregateType, "task");
    assert.equal(retrieved!.config.partitioningStrategy, "byTenant");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueuePartitioner: extractPartitionKey handles various payload shapes", () => {
  const partitioner = new QueuePartitioner();

  // with aggregateType and tenantId
  const key1 = partitioner.extractPartitionKey({ aggregateType: "task", tenantId: "tenant-1" });
  assert.equal(key1.aggregateType, "task");
  assert.equal(key1.tenantId, "tenant-1");

  // with domain alias
  const key2 = partitioner.extractPartitionKey({ domain: "workflow", tenant_id: "tenant-2" });
  assert.equal(key2.aggregateType, "workflow");
  assert.equal(key2.tenantId, "tenant-2");

  // with missing fields (defaults)
  const key3 = partitioner.extractPartitionKey({});
  assert.equal(key3.aggregateType, "default");
  assert.equal(key3.tenantId, "default");
});

test("QueuePartitioner: computePartitionName respects partitioning strategy", () => {
  const partitioner = new QueuePartitioner();

  assert.equal(
    partitioner.computePartitionName("task", "tenant-a", "byTenant"),
    "queue:tenant-a",
  );
  assert.equal(
    partitioner.computePartitionName("task", "tenant-a", "byAggregateType"),
    "queue:task",
  );
  assert.equal(
    partitioner.computePartitionName("task", "tenant-a", "byTenantAndAggregate"),
    "queue:tenant-a:task",
  );
  assert.equal(
    partitioner.computePartitionName("task", "tenant-a", "byAggregateType"),
    "queue:task",
  );
});

test("QueuePartitioner: route enqueues to correct partition", () => {
  const h = createQueueHarness("aa-partitioner-route-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const partitioner = new QueuePartitioner();

    partitioner.registerPartition({
      name: "queue:task",
      aggregateType: "task",
      priority: 5,
      consumerGroup: "cg-task",
      config: {
        maxDepth: 50,
        alertThreshold: 40,
        consumerCount: 1,
        partitioningStrategy: "byAggregateType",
      },
    });

    const jobId = partitioner.route(adapter, { aggregateType: "task", tenantId: "tenant-x", data: "hello" });
    assert.ok(jobId, "Route should return a job ID");

    const job = adapter.getJob(jobId);
    assert.ok(job, "Job should be persisted");
    assert.equal(job!.queueName, "queue:task");
    const payload = JSON.parse(job!.payload);
    assert.equal(payload.data, "hello");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueuePartitioner: route uses default queue when no partition registered", () => {
  const h = createQueueHarness("aa-partitioner-default-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const partitioner = new QueuePartitioner();

    // No partition registered - should fall back to byAggregateType
    const jobId = partitioner.route(adapter, { aggregateType: "unknown", tenantId: "tenant-y" });
    assert.ok(jobId);

    const job = adapter.getJob(jobId);
    assert.ok(job);
    assert.equal(job!.queueName, "queue:unknown");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueuePartitioner: route respects priority and maxAttempts options", () => {
  const h = createQueueHarness("aa-partitioner-options-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const partitioner = new QueuePartitioner();

    const jobId = partitioner.route(
      adapter,
      { aggregateType: "task", tenantId: "tenant-z" },
      { priority: 99, maxAttempts: 5 },
    );
    assert.ok(jobId);

    const job = adapter.getJob(jobId);
    assert.ok(job);
    assert.equal(job!.priority, 99);
    assert.equal(job!.maxAttempts, 5);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueuePartitioner: getPartitionStats returns stats for all registered partitions", () => {
  const h = createQueueHarness("aa-partitioner-stats-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const partitioner = new QueuePartitioner();

    partitioner.registerPartition({
      name: "queue:task",
      aggregateType: "task",
      priority: 5,
      consumerGroup: "cg-task",
      config: { maxDepth: 100, alertThreshold: 80, consumerCount: 1, partitioningStrategy: "byAggregateType" },
    });
    partitioner.registerPartition({
      name: "queue:workflow",
      aggregateType: "workflow",
      priority: 3,
      consumerGroup: "cg-workflow",
      config: { maxDepth: 200, alertThreshold: 160, consumerCount: 2, partitioningStrategy: "byAggregateType" },
    });

    // Enqueue some jobs
    partitioner.route(adapter, { aggregateType: "task", tenantId: "t1" });
    partitioner.route(adapter, { aggregateType: "task", tenantId: "t2" });
    partitioner.route(adapter, { aggregateType: "workflow", tenantId: "t3" });

    const stats = partitioner.getPartitionStats(adapter);

    assert.equal(stats.size, 2);
    const taskStats = stats.get("task");
    assert.ok(taskStats, "task partition stats should exist");
    assert.equal(taskStats.waiting, 2);
    const workflowStats = stats.get("workflow");
    assert.ok(workflowStats, "workflow partition stats should exist");
    assert.equal(workflowStats.waiting, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueuePartitioner: detectOverload identifies partitions exceeding max depth", () => {
  const h = createQueueHarness("aa-partitioner-overload-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const partitioner = new QueuePartitioner();

    partitioner.registerPartition({
      name: "queue:task",
      aggregateType: "task",
      priority: 5,
      consumerGroup: "cg-task",
      config: { maxDepth: 2, alertThreshold: 1, consumerCount: 1, partitioningStrategy: "byAggregateType" },
    });
    partitioner.registerPartition({
      name: "queue:workflow",
      aggregateType: "workflow",
      priority: 3,
      consumerGroup: "cg-workflow",
      config: { maxDepth: 100, alertThreshold: 80, consumerCount: 1, partitioningStrategy: "byAggregateType" },
    });

    // Fill task partition beyond maxDepth (2)
    partitioner.route(adapter, { aggregateType: "task", tenantId: "t1" });
    partitioner.route(adapter, { aggregateType: "task", tenantId: "t2" });
    partitioner.route(adapter, { aggregateType: "task", tenantId: "t3" }); // This exceeds maxDepth=2

    const overloads = partitioner.detectOverload(adapter);

    assert.equal(overloads.length, 1);
    assert.equal(overloads[0].aggregateType, "task");
    assert.equal(overloads[0].stats.waiting, 3);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueuePartitioner: detectOverload returns empty when all partitions healthy", () => {
  const h = createQueueHarness("aa-partitioner-healthy-");
  try {
    const adapter = new SqliteQueueAdapter(h.db);
    const partitioner = new QueuePartitioner();

    partitioner.registerPartition({
      name: "queue:task",
      aggregateType: "task",
      priority: 5,
      consumerGroup: "cg-task",
      config: { maxDepth: 100, alertThreshold: 80, consumerCount: 1, partitioningStrategy: "byAggregateType" },
    });

    partitioner.route(adapter, { aggregateType: "task", tenantId: "t1" });

    const overloads = partitioner.detectOverload(adapter);
    assert.equal(overloads.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("QueuePartitioner: idempotent re-registration updates existing partition", () => {
  const h = createQueueHarness("aa-partitioner-reregister-");
  try {
    const partitioner = new QueuePartitioner();

    partitioner.registerPartition({
      name: "queue:v1",
      aggregateType: "task",
      priority: 5,
      consumerGroup: "cg-v1",
      config: { maxDepth: 50, alertThreshold: 40, consumerCount: 1, partitioningStrategy: "byAggregateType" },
    });

    // Re-register with different config
    partitioner.registerPartition({
      name: "queue:v2",
      aggregateType: "task",
      priority: 10,
      consumerGroup: "cg-v2",
      config: { maxDepth: 100, alertThreshold: 90, consumerCount: 2, partitioningStrategy: "byAggregateType" },
    });

    const retrieved = partitioner.getPartition("task");
    assert.ok(retrieved);
    assert.equal(retrieved!.name, "queue:v2");
    assert.equal(retrieved!.config.maxDepth, 100);
    assert.equal(retrieved!.config.consumerCount, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});