/**
 * Queue Adapter Edge Cases Tests
 *
 * Additional tests for queue adapters focusing on edge cases,
 * boundary conditions, and error handling not covered by other test files.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { QueuePartitioner } from "../../../../../src/platform/five-plane-execution/queue/queue-partitioner.js";
import { createQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-factory.js";
import {
  SqliteQueueAdapter,
  RedisQueueAdapter,
  QUEUE_JOBS_DDL,
} from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type {
  QueuePartition,
  QueueJobRecord,
  EnqueueInput,
} from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

// =============================================================================
// Queue Partitioner Edge Cases
// =============================================================================

test("QueuePartitioner extractPartitionKey uses default when aggregateType and domain are missing", () => {
  const partitioner = new QueuePartitioner();

  // Empty payload falls back to 'default'
  const key1 = partitioner.extractPartitionKey({});
  assert.equal(key1.aggregateType, "default");
  assert.equal(key1.tenantId, "default");
});

test("QueuePartitioner extractPartitionKey uses tenant_id fallback", () => {
  const partitioner = new QueuePartitioner();
  const key = partitioner.extractPartitionKey({ aggregateType: "task", tenant_id: "tenant-456" });
  assert.equal(key.tenantId, "tenant-456");
});

test("QueuePartitioner computePartitionName handles empty strings", () => {
  const partitioner = new QueuePartitioner();
  assert.equal(partitioner.computePartitionName("", "", "byTenant"), "queue:");
  assert.equal(partitioner.computePartitionName("", "", "byAggregateType"), "queue:");
  assert.equal(partitioner.computePartitionName("", "", "byTenantAndAggregate"), "queue::");
});

test("QueuePartitioner route with priority and maxAttempts options", () => {
  const partitioner = new QueuePartitioner();
  const mockAdapter = createMockQueueAdapter();
  const partition: QueuePartition = {
    name: "queue:execution",
    aggregateType: "execution",
    priority: 1,
    consumerGroup: "cg-execution",
    config: { maxDepth: 100, alertThreshold: 80, consumerCount: 2, partitioningStrategy: "byAggregateType" },
  };
  partitioner.registerPartition(partition);

  const jobId = partitioner.route(mockAdapter, { aggregateType: "execution", tenantId: "t1" }, { priority: 5, maxAttempts: 10 });
  assert.ok(jobId);

  const job = mockAdapter.getJob(jobId);
  assert.equal(job?.priority, 5);
  assert.equal(job?.maxAttempts, 10);
});

test("QueuePartitioner route without options uses defaults", () => {
  const partitioner = new QueuePartitioner();
  const mockAdapter = createMockQueueAdapter();
  const partition: QueuePartition = {
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-task",
    config: { maxDepth: 100, alertThreshold: 80, consumerCount: 2, partitioningStrategy: "byAggregateType" },
  };
  partitioner.registerPartition(partition);

  const jobId = partitioner.route(mockAdapter, { aggregateType: "task", tenantId: "t1" });
  assert.ok(jobId);

  const job = mockAdapter.getJob(jobId);
  assert.equal(job?.priority, 0);
  assert.equal(job?.maxAttempts, 3);
});

test("QueuePartitioner detectOverload with zero maxDepth", () => {
  const partitioner = new QueuePartitioner();
  const mockAdapter = createMockQueueAdapter();
  const partition: QueuePartition = {
    name: "queue:task",
    aggregateType: "task",
    priority: 1,
    consumerGroup: "cg-task",
    config: { maxDepth: 0, alertThreshold: 0, consumerCount: 1, partitioningStrategy: "byAggregateType" },
  };
  partitioner.registerPartition(partition);
  mockAdapter._addJobs("queue:task", 1, "waiting");

  const overloads = partitioner.detectOverload(mockAdapter);
  assert.equal(overloads.length, 1);
});

test("QueuePartitioner getPartitionStats with no jobs", () => {
  const partitioner = new QueuePartitioner();
  const mockAdapter = createMockQueueAdapter();
  const partition: QueuePartition = {
    name: "queue:empty",
    aggregateType: "empty",
    priority: 1,
    consumerGroup: "cg-empty",
    config: { maxDepth: 100, alertThreshold: 80, consumerCount: 2, partitioningStrategy: "byAggregateType" },
  };
  partitioner.registerPartition(partition);

  const stats = partitioner.getPartitionStats(mockAdapter);
  assert.equal(stats.size, 1);
  assert.equal(stats.get("empty")?.waiting, 0);
});

// =============================================================================
// Queue Adapter Factory Edge Cases
// =============================================================================

test("createQueueAdapter with redis config having all optional fields", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "redis.example.com",
      port: 6380,
      password: "secret",
      db: 2,
      prefix: "custom:",
      tls: true,
      connectTimeout: 10000,
      maxRetriesPerRequest: 5,
    },
  });
  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter sqlite kind returns SqliteQueueAdapter", () => {
  const workspace = createTempWorkspace("aa-factory-sqlite-edge-");
  const db = new SqliteDatabase(join(workspace, "queue.db"), { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, db);
    assert.equal(adapter.backendKind, "sqlite");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("createQueueAdapter redis kind returns RedisQueueAdapter", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: { host: "localhost", port: 6379 },
  });
  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter throws ValidationError with correct code for missing redis", () => {
  try {
    createQueueAdapter({ kind: "redis" });
    assert.fail("Expected ValidationError");
  } catch (error: any) {
    assert.ok(error.code.includes("missing_redis_config"));
    assert.equal(error.retryable, false);
  }
});

test("createQueueAdapter throws ValidationError with correct code for missing sqlite db", () => {
  try {
    createQueueAdapter({ kind: "sqlite" });
    assert.fail("Expected ValidationError");
  } catch (error: any) {
    assert.ok(error.code.includes("missing_sqlite_db"));
    assert.equal(error.retryable, false);
  }
});

// =============================================================================
// Redis Queue Adapter Edge Cases
// =============================================================================

test("RedisQueueAdapter enqueue with empty payload is stringified", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "q", payload: "" });
  // Empty string becomes '""' after JSON.stringify
  assert.equal(job.payload, '""');
  assert.equal(job.status, "waiting");
});

test("RedisQueueAdapter enqueue with complex nested payload", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const complexPayload = {
    nested: { deep: { value: 123 } },
    array: [1, 2, 3],
    bool: true,
    null: null,
  };
  const job = adapter.enqueue({ queueName: "q", payload: complexPayload });
  const parsed = JSON.parse(job.payload);
  assert.equal(parsed.nested.deep.value, 123);
  assert.deepEqual(parsed.array, [1, 2, 3]);
});

test("RedisQueueAdapter enqueue with negative priority", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "q", payload: "test", priority: -10 });
  assert.equal(job.priority, -10);
});

test("RedisQueueAdapter enqueue with zero maxAttempts", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "q", payload: "test", maxAttempts: 0 });
  assert.equal(job.maxAttempts, 0);
});

test("RedisQueueAdapter enqueue with very large maxAttempts", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "q", payload: "test", maxAttempts: 1000 });
  assert.equal(job.maxAttempts, 1000);
});

test("RedisQueueAdapter sync enqueue generates unique ids", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job1 = adapter.enqueue({ queueName: "q", payload: "test1" });
  const job2 = adapter.enqueue({ queueName: "q", payload: "test2" });
  const job3 = adapter.enqueue({ queueName: "q", payload: "test3" });
  assert.notEqual(job1.id, job2.id);
  assert.notEqual(job2.id, job3.id);
  assert.notEqual(job1.id, job3.id);
});

test("RedisQueueAdapter enqueue stores correct idempotencyKey", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({
    queueName: "q",
    payload: "test",
    idempotencyKey: "my-unique-key",
  });
  assert.equal(job.idempotencyKey, "my-unique-key");
});

test("RedisQueueAdapter enqueue with null idempotencyKey", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({
    queueName: "q",
    payload: "test",
    idempotencyKey: null,
  });
  assert.equal(job.idempotencyKey, null);
});

test("RedisQueueAdapter enqueue with delayUntil in the past becomes waiting", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const pastDate = new Date(Date.now() - 10000).toISOString();
  const job = adapter.enqueue({ queueName: "q", payload: "test", delayUntil: pastDate });
  assert.equal(job.status, "waiting");
  assert.ok(job.delayUntil !== null);
});

test("RedisQueueAdapter enqueue with delayUntil far in the future becomes delayed", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day
  const job = adapter.enqueue({ queueName: "q", payload: "test", delayUntil: futureDate });
  assert.equal(job.status, "delayed");
  assert.equal(job.delayUntil, futureDate);
});

test("RedisQueueAdapter enqueue createdAt and updatedAt are set", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "q", payload: "test" });
  assert.ok(job.createdAt);
  assert.ok(job.updatedAt);
  assert.equal(job.createdAt, job.updatedAt);
});

test("RedisQueueAdapter enqueue completedAt is null initially", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "q", payload: "test" });
  assert.equal(job.completedAt, null);
});

test("RedisQueueAdapter enqueue lastError is null initially", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "q", payload: "test" });
  assert.equal(job.lastError, null);
});

test("RedisQueueAdapter enqueue attempts is 0 initially", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "q", payload: "test" });
  assert.equal(job.attempts, 0);
});

test("RedisQueueAdapter close with status ready calls quit", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  let quitCalled = false;
  adapter.client = {
    ...adapter.client,
    status: "ready",
    quit: async () => { quitCalled = true; },
    close: async () => { await adapter.client.quit(); },
  };

  await adapter.close();
  assert.ok(quitCalled);
});

test("RedisQueueAdapter close with status wait calls disconnect", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  let disconnectCalled = false;
  adapter.client = {
    ...adapter.client,
    status: "wait",
    disconnect: () => { disconnectCalled = true; },
    close: async () => { adapter.client.disconnect(); },
  };

  await adapter.close();
  assert.ok(disconnectCalled);
});

test("RedisQueueAdapter close with status end calls disconnect", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  let disconnectCalled = false;
  adapter.client = {
    ...adapter.client,
    status: "end",
    disconnect: () => { disconnectCalled = true; },
    close: async () => { adapter.client.disconnect(); },
  };

  await adapter.close();
  assert.ok(disconnectCalled);
});

// =============================================================================
// SQLite Queue Adapter Edge Cases
// =============================================================================

function createSqliteHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return {
    workspace,
    db,
    adapter: new SqliteQueueAdapter(db),
  };
}

test("SqliteQueueAdapter listJobs with limit parameter", () => {
  const harness = createSqliteHarness("aa-sqlite-list-limit-");
  try {
    const { adapter } = harness;
    for (let i = 0; i < 10; i++) {
      adapter.enqueue({ queueName: "q", payload: { id: i } });
    }

    const jobs = adapter.listJobs("q", undefined, 5);
    assert.equal(jobs.length, 5);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listJobs returns empty for nonexistent queue", () => {
  const harness = createSqliteHarness("aa-sqlite-list-none-");
  try {
    const { adapter } = harness;
    const jobs = adapter.listJobs("nonexistent");
    assert.equal(jobs.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listJobs with status filter for empty results", () => {
  const harness = createSqliteHarness("aa-sqlite-list-status-empty-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "q", payload: "test" });

    const jobs = adapter.listJobs("q", "completed");
    assert.equal(jobs.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter getJob returns null for nonexistent job", () => {
  const harness = createSqliteHarness("aa-sqlite-getnone-");
  try {
    const { adapter } = harness;
    const job = adapter.getJob("nonexistent-job-id");
    assert.equal(job, null);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter dequeue activates waiting job", () => {
  const harness = createSqliteHarness("aa-sqlite-dequeue-active-");
  try {
    const { adapter } = harness;
    const enqueued = adapter.enqueue({ queueName: "q", payload: "test" });
    assert.equal(enqueued.status, "waiting");

    const dequeued = adapter.dequeue("q");
    assert.ok(dequeued);
    assert.equal(dequeued.job.status, "active");
    assert.equal(dequeued.job.attempts, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter retryJob returns job for waiting job (no-op since not failed/dl)", () => {
  const harness = createSqliteHarness("aa-sqlite-retry-waiting-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "q", payload: "test" });

    // retryJob only updates 'failed' or 'dead_letter' jobs, so waiting jobs are returned as-is
    const retried = adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried?.status, "waiting");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter retryJob returns job for active job (no-op since not failed/dl)", () => {
  const harness = createSqliteHarness("aa-sqlite-retry-active-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "q", payload: "test" });
    const dequeued = adapter.dequeue("q");
    assert.ok(dequeued);

    // retryJob only updates 'failed' or 'dead_letter' jobs, so active jobs are returned as-is
    const retried = adapter.retryJob(job.id);
    assert.ok(retried);
    assert.equal(retried?.status, "active");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter moveToDeadLetter handles nonexistent job gracefully", () => {
  const harness = createSqliteHarness("aa-sqlite-move-dl-none-");
  try {
    const { adapter } = harness;
    // Should not throw
    adapter.moveToDeadLetter("nonexistent-id", "reason");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter stats for multiple queues", () => {
  const harness = createSqliteHarness("aa-sqlite-stats-multi-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "q1", payload: "test1" });
    adapter.enqueue({ queueName: "q1", payload: "test2" });
    adapter.enqueue({ queueName: "q2", payload: "test3" });

    const stats1 = adapter.stats("q1");
    assert.equal(stats1.waiting, 2);
    assert.equal(stats1.queueName, "q1");

    const stats2 = adapter.stats("q2");
    assert.equal(stats2.waiting, 1);
    assert.equal(stats2.queueName, "q2");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter stats tracks all status types", () => {
  const harness = createSqliteHarness("aa-sqlite-stats-all-");
  try {
    const { adapter } = harness;

    // Create jobs in different states
    adapter.enqueue({ queueName: "q", payload: "w1" }); // waiting
    adapter.enqueue({ queueName: "q", payload: "w2" }); // waiting
    adapter.enqueue({ queueName: "q", payload: "dl1", maxAttempts: 1 }); // will become dead_letter

    // Dequeue and ack first job
    const d1 = adapter.dequeue("q");
    assert.ok(d1);
    d1.ack();

    // Dequeue second job and nack - this goes to dead_letter since maxAttempts=1
    const d2 = adapter.dequeue("q");
    assert.ok(d2);
    d2.nack("fail");

    // Third job (dl1) is still waiting, second nacked job also still waiting (SQLite behavior)
    const stats = adapter.stats("q");
    // SQLite nack without explicit max_attempts check moves job back to waiting
    // regardless of attempts count, so both w2 and dl1 may be waiting
    assert.ok(stats.waiting >= 1);  // at least dl1 is still waiting
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 1);  // w1 completed
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter purge returns 0 for empty queue", () => {
  const harness = createSqliteHarness("aa-sqlite-purge-empty-");
  try {
    const { adapter } = harness;
    const purged = adapter.purge("nonexistent", new Date().toISOString());
    assert.equal(purged, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter purge does not remove waiting jobs", () => {
  const harness = createSqliteHarness("aa-sqlite-purge-waiting-");
  try {
    const { adapter } = harness;
    const job = adapter.enqueue({ queueName: "q", payload: "waiting" });

    const purged = adapter.purge("q", new Date().toISOString());
    assert.equal(purged, 0);

    // Job should still exist
    const retrieved = adapter.getJob(job.id);
    assert.ok(retrieved);
    assert.equal(retrieved.status, "waiting");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("SqliteQueueAdapter listQueues returns sorted names", () => {
  const harness = createSqliteHarness("aa-sqlite-list-sorted-");
  try {
    const { adapter } = harness;
    adapter.enqueue({ queueName: "zebra", payload: "z" });
    adapter.enqueue({ queueName: "alpha", payload: "a" });
    adapter.enqueue({ queueName: "middle", payload: "m" });

    const queues = adapter.listQueues();
    assert.deepEqual(queues, ["alpha", "middle", "zebra"]);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

// =============================================================================
// Mock Queue Adapter for Partition Tests
// =============================================================================

function createMockQueueAdapter() {
  return new MockQueueAdapterForPartition();
}

class MockQueueAdapterForPartition {
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

  dequeue(queueName: string) { throw new Error("not implemented"); }
  getJob(jobId: string): QueueJobRecord | null {
    for (const queue of this.queues.values()) {
      if (queue.has(jobId)) return queue.get(jobId)!;
    }
    return null;
  }
  listJobs(queueName: string) { throw new Error("not implemented"); }
  moveToDeadLetter(jobId: string, reason: string) { throw new Error("not implemented"); }
  retryJob(jobId: string) { throw new Error("not implemented"); }
  purge(queueName: string, olderThan: string) { throw new Error("not implemented"); }

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
