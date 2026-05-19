/**
 * Queue Adapter Integration Tests
 *
 * Integration tests for SqliteQueueAdapter and RedisQueueAdapter with real stores.
 * Includes concurrency tests per §17.1.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/sqlite-queue-adapter.js";
import { RedisQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/redis-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";

// Set test mode to use in-memory Redis mock
const previousRunningTests = process.env.AA_RUNNING_TESTS;
process.env.AA_RUNNING_TESTS = "1";
test.after(() => {
  if (previousRunningTests === undefined) {
    delete process.env.AA_RUNNING_TESTS;
    return;
  }
  process.env.AA_RUNNING_TESTS = previousRunningTests;
});

function createSqliteHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db, adapter: new SqliteQueueAdapter(db) };
}

// SqliteQueueAdapter Integration Tests

test("SqliteQueueAdapter integration: enqueue creates job record", () => {
  const h = createSqliteHarness("aa-int-enqueue-");
  try {
    const job = h.adapter.enqueue({
      queueName: "test-queue",
      payload: { message: "hello" },
    });

    assert.ok(job.id.startsWith("qjob_"));
    assert.equal(job.queueName, "test-queue");
    assert.equal(job.status, "waiting");
    assert.equal(job.attempts, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: dequeue returns waiting job", () => {
  const h = createSqliteHarness("aa-int-dequeue-");
  try {
    h.adapter.enqueue({ queueName: "dequeue-test", payload: { order: 1 } });
    h.adapter.enqueue({ queueName: "dequeue-test", payload: { order: 2 } });

    const result = h.adapter.dequeue("dequeue-test");

    assert.ok(result);
    assert.equal(result.job.status, "active");
    assert.equal(result.job.attempts, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: dequeue ack marks job completed", () => {
  const h = createSqliteHarness("aa-int-ack-");
  try {
    h.adapter.enqueue({ queueName: "ack-test", payload: { done: true } });
    const result = h.adapter.dequeue("ack-test");

    assert.ok(result);
    result.ack();

    const completed = h.adapter.getJob(result.job.id);
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completedAt);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: dequeue nack requeues on retry", () => {
  const h = createSqliteHarness("aa-int-nack-");
  try {
    const job = h.adapter.enqueue({
      queueName: "nack-test",
      payload: { fail: true },
      maxAttempts: 3,
    });
    const result = h.adapter.dequeue("nack-test");

    assert.ok(result);
    result.nack("test error");

    const requeued = h.adapter.getJob(job.id);
    assert.equal(requeued?.status, "waiting");
    assert.equal(requeued?.attempts, 1);
    assert.equal(requeued?.lastError, "test error");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: moveToDeadLetter marks job dead_letter", () => {
  const h = createSqliteHarness("aa-int-dlq-");
  try {
    const job = h.adapter.enqueue({ queueName: "dlq-test", payload: { dead: true } });
    h.adapter.moveToDeadLetter(job.id, "max_retries_exceeded");

    const moved = h.adapter.getJob(job.id);
    assert.equal(moved?.status, "dead_letter");
    assert.equal(moved?.lastError, "max_retries_exceeded");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: stats returns correct counts", () => {
  const h = createSqliteHarness("aa-int-stats-");
  try {
    h.adapter.enqueue({ queueName: "stats-test", payload: { a: 1 } });
    h.adapter.enqueue({ queueName: "stats-test", payload: { b: 2 } });
    h.adapter.enqueue({ queueName: "stats-test", payload: { c: 3 } });

    const stats = h.adapter.stats("stats-test");

    assert.equal(stats.waiting, 3);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: listQueues returns all queue names", () => {
  const h = createSqliteHarness("aa-int-listq-");
  try {
    h.adapter.enqueue({ queueName: "queue-a", payload: {} });
    h.adapter.enqueue({ queueName: "queue-b", payload: {} });
    h.adapter.enqueue({ queueName: "queue-c", payload: {} });

    const queues = h.adapter.listQueues();

    assert.ok(queues.includes("queue-a"));
    assert.ok(queues.includes("queue-b"));
    assert.ok(queues.includes("queue-c"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: retryJob resets failed job", () => {
  const h = createSqliteHarness("aa-int-retry-");
  try {
    // Use maxAttempts=1 so that after one nack (attempts becomes 1), the job goes to dead_letter
    // rather than waiting, making it eligible for retryJob to reset
    const job = h.adapter.enqueue({ queueName: "retry-test", payload: {}, maxAttempts: 1 });
    const result = h.adapter.dequeue("retry-test");
    result.nack("failed");

    const retried = h.adapter.retryJob(job.id);

    assert.ok(retried);
    assert.equal(retried?.status, "waiting");
    assert.equal(retried?.attempts, 0);
    assert.equal(retried?.lastError, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: idempotency key returns existing job", () => {
  const h = createSqliteHarness("aa-int-idempotent-");
  try {
    const first = h.adapter.enqueue({
      queueName: "idempotent-test",
      payload: { unique: true },
      idempotencyKey: "key-123",
    });

    const second = h.adapter.enqueue({
      queueName: "idempotent-test",
      payload: { different: true },
      idempotencyKey: "key-123",
    });

    assert.equal(first.id, second.id);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: priority orders correctly", () => {
  const h = createSqliteHarness("aa-int-priority-");
  try {
    h.adapter.enqueue({ queueName: "priority-test", payload: { n: 1 }, priority: 1 });
    h.adapter.enqueue({ queueName: "priority-test", payload: { n: 2 }, priority: 10 });
    h.adapter.enqueue({ queueName: "priority-test", payload: { n: 3 }, priority: 5 });

    const result = h.adapter.dequeue("priority-test");

    assert.ok(result);
    const payload = JSON.parse(result.job.payload);
    assert.equal(payload.n, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: multiple queues with independent processing", () => {
  const h = createSqliteHarness("aa-int-multi-");
  try {
    const job1 = h.adapter.enqueue({ queueName: "high-priority", payload: { data: "urgent" } });
    const job2 = h.adapter.enqueue({ queueName: "low-priority", payload: { data: "batch" } });
    h.adapter.enqueue({ queueName: "high-priority", payload: { data: "critical" } });

    const highResult = h.adapter.dequeue("high-priority");
    assert.ok(highResult);
    assert.equal(highResult.job.queueName, "high-priority");

    const lowResult = h.adapter.dequeue("low-priority");
    assert.ok(lowResult);
    const payload2 = JSON.parse(lowResult.job.payload);
    assert.equal(payload2.data, "batch");

    highResult.ack();
    const completed = h.adapter.getJob(job1.id);
    assert.equal(completed?.status, "completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: failed jobs are requeued with backoff", () => {
  const h = createSqliteHarness("aa-int-requeue-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" }, maxAttempts: 3 });

    const result1 = h.adapter.dequeue("tasks");
    assert.ok(result1);
    assert.equal(result1.job.attempts, 1);

    result1.nack();

    const result2 = h.adapter.dequeue("tasks");
    assert.ok(result2);
    assert.equal(result2.job.id, job.id);
    assert.equal(result2.job.attempts, 2);

    result2.ack();
    assert.equal(h.adapter.getJob(job.id)?.status, "completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter integration: dead letter after max retries", () => {
  const h = createSqliteHarness("aa-int-dlq-max-");
  try {
    const job = h.adapter.enqueue({ queueName: "tasks", payload: { taskId: "failing" }, maxAttempts: 2 });

    const r1 = h.adapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack();

    const r2 = h.adapter.dequeue("tasks");
    assert.ok(r2);
    r2.nack();

    const dlqJob = h.adapter.getJob(job.id);
    assert.ok(dlqJob);
    const dlqPayload = JSON.parse(dlqJob.payload);
    assert.equal(dlqPayload.taskId, "failing");
    assert.equal(dlqJob.status, "dead_letter");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// RedisQueueAdapter Integration Tests

test("RedisQueueAdapter integration: enqueueAsync creates job record", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  const job = await adapter.enqueueAsync({
    queueName: "test-queue",
    payload: { message: "hello" },
  });

  assert.ok(job.id.startsWith("qjob_"));
  assert.equal(job.queueName, "test-queue");
  assert.equal(job.status, "waiting");

  await adapter.close();
});

test("RedisQueueAdapter integration: dequeueAsync returns waiting job", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  await adapter.enqueueAsync({ queueName: "dequeue-test", payload: { order: 1 } });
  await adapter.enqueueAsync({ queueName: "dequeue-test", payload: { order: 2 } });

  const result = await adapter.dequeueAsync("dequeue-test");

  assert.ok(result);
  assert.equal(result.job.status, "active");

  await adapter.close();
});

test("RedisQueueAdapter integration: dequeueAsync ack marks job completed", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  await adapter.enqueueAsync({ queueName: "ack-test", payload: { done: true } });
  const result = await adapter.dequeueAsync("ack-test");

  assert.ok(result);
  await result.ack();

  const completed = await adapter.getJobAsync(result.job.id);
  assert.equal(completed?.status, "completed");
  assert.ok(completed?.completedAt);

  await adapter.close();
});

test("RedisQueueAdapter integration: dequeueAsync nack requeues on retry", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  const job = await adapter.enqueueAsync({
    queueName: "nack-test",
    payload: { fail: true },
    maxAttempts: 3,
  });
  const result = await adapter.dequeueAsync("nack-test");

  assert.ok(result);
  await result.nack("test error");

  const requeued = await adapter.getJobAsync(job.id);
  assert.equal(requeued?.status, "waiting");
  assert.equal(requeued?.attempts, 1);
  assert.equal(requeued?.lastError, "test error");

  await adapter.close();
});

test("RedisQueueAdapter integration: moveToDeadLetterAsync marks job dead_letter", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  const job = await adapter.enqueueAsync({ queueName: "dlq-test", payload: { dead: true } });
  await adapter.moveToDeadLetterAsync(job.id, "max_retries_exceeded");

  const moved = await adapter.getJobAsync(job.id);
  assert.equal(moved?.status, "dead_letter");
  assert.equal(moved?.lastError, "max_retries_exceeded");

  await adapter.close();
});

test("RedisQueueAdapter integration: statsAsync returns correct counts", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  await adapter.enqueueAsync({ queueName: "stats-test", payload: { a: 1 } });
  await adapter.enqueueAsync({ queueName: "stats-test", payload: { b: 2 } });
  await adapter.enqueueAsync({ queueName: "stats-test", payload: { c: 3 } });

  const stats = await adapter.statsAsync("stats-test");

  assert.equal(stats.waiting, 3);
  assert.equal(stats.active, 0);
  assert.equal(stats.completed, 0);
  assert.equal(stats.queueName, "stats-test");

  await adapter.close();
});

test("RedisQueueAdapter integration: listQueuesAsync returns all queue names", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  await adapter.enqueueAsync({ queueName: "queue-a", payload: {} });
  await adapter.enqueueAsync({ queueName: "queue-b", payload: {} });
  await adapter.enqueueAsync({ queueName: "queue-c", payload: {} });

  const queues = await adapter.listQueuesAsync();
  assert.ok(queues.includes("queue-a"));
  assert.ok(queues.includes("queue-b"));
  assert.ok(queues.includes("queue-c"));

  await adapter.close();
});

test("RedisQueueAdapter integration: retryJobAsync resets failed job", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  const job = await adapter.enqueueAsync({ queueName: "retry-test", payload: {} });
  const result = await adapter.dequeueAsync("retry-test");
  await result.nack("failed");

  const retried = await adapter.retryJobAsync(job.id);

  assert.ok(retried);
  assert.equal(retried?.status, "waiting");
  assert.equal(retried?.attempts, 0);
  assert.equal(retried?.lastError, null);

  await adapter.close();
});

test("RedisQueueAdapter integration: idempotency key returns existing job", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  const first = await adapter.enqueueAsync({
    queueName: "idempotent-test",
    payload: { unique: true },
    idempotencyKey: "key-123",
  });

  const second = await adapter.enqueueAsync({
    queueName: "idempotent-test",
    payload: { different: true },
    idempotencyKey: "key-123",
  });

  assert.equal(first.id, second.id);

  await adapter.close();
});

test("RedisQueueAdapter integration: priority orders correctly", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  await adapter.enqueueAsync({ queueName: "priority-test", payload: { n: 1 }, priority: 1 });
  await adapter.enqueueAsync({ queueName: "priority-test", payload: { n: 2 }, priority: 10 });
  await adapter.enqueueAsync({ queueName: "priority-test", payload: { n: 3 }, priority: 5 });

  const result = await adapter.dequeueAsync("priority-test");

  assert.ok(result);
  const payload = JSON.parse(result.job.payload);
  assert.equal(payload.n, 2);

  await adapter.close();
});

// §17.1 Concurrency Integration Tests

test("SqliteQueueAdapter concurrent enqueue integration", async () => {
  const h = createSqliteHarness("aa-int-conc-enqueue-");
  try {
    const result = await runConcurrentInvariant(async (workerId: number) => {
      return h.adapter.enqueue({
        queueName: "concurrent-queue",
        payload: { workerId },
      });
    }, { concurrency: 10 });

    assert.equal(result.errors.length, 0, "No errors during concurrent enqueue");
    assert.equal(result.values.length, 10, "All 10 enqueues completed");

    const jobs = h.adapter.listJobs("concurrent-queue");
    assert.equal(jobs.length, 10, "All jobs persisted");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter concurrent dequeue integration", async () => {
  const h = createSqliteHarness("aa-int-conc-dequeue-");
  try {
    for (let i = 0; i < 20; i++) {
      h.adapter.enqueue({ queueName: "race-queue", payload: { index: i } });
    }

    const result = await runConcurrentInvariant(async (_workerId: number) => {
      return h.adapter.dequeue("race-queue");
    }, { concurrency: 10 });

    const dequeuedJobs = result.values.filter((r) => r !== null);
    assert.equal(dequeuedJobs.length, 10, "Exactly 10 jobs dequeued concurrently");

    const uniqueIds = new Set(dequeuedJobs.map((r) => r!.job.id));
    assert.equal(uniqueIds.size, 10, "All dequeued jobs have unique IDs");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SqliteQueueAdapter concurrent idempotency integration", async () => {
  const h = createSqliteHarness("aa-int-conc-idempotent-");
  try {
    const result = await runConcurrentInvariant(async (workerId: number) => {
      return h.adapter.enqueue({
        queueName: "idempotent-queue",
        payload: { workerId },
        idempotencyKey: "same-key",
      });
    }, { concurrency: 5 });

    assert.equal(result.errors.length, 0, "No errors during concurrent idempotent enqueue");

    const jobs = h.adapter.listJobs("idempotent-queue");
    assert.equal(jobs.length, 1, "Only one job created despite concurrent duplicate keys");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("RedisQueueAdapter concurrent enqueue integration", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  const result = await runConcurrentInvariant(async (workerId: number) => {
    return adapter.enqueueAsync({
      queueName: "concurrent-queue",
      payload: { workerId },
    });
  }, { concurrency: 10 });

  assert.equal(result.errors.length, 0, "No errors during concurrent enqueue");
  assert.equal(result.values.length, 10, "All 10 enqueues completed");

  const jobs = await adapter.listJobsAsync("concurrent-queue");
  assert.equal(jobs.length, 10, "All jobs persisted");

  await adapter.close();
});

test("RedisQueueAdapter concurrent dequeue integration", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  for (let i = 0; i < 20; i++) {
    await adapter.enqueueAsync({ queueName: "race-queue", payload: { index: i } });
  }

  const result = await runConcurrentInvariant(async (_workerId: number) => {
    return adapter.dequeueAsync("race-queue");
  }, { concurrency: 10 });

  const dequeuedJobs = result.values.filter((r) => r !== null);
  assert.ok(dequeuedJobs.length > 0, "Some jobs should be dequeued");

  await adapter.close();
});

test("RedisQueueAdapter concurrent mixed operations integration", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  const enqueueResult = await runConcurrentInvariant(async (workerId: number) => {
    return adapter.enqueueAsync({
      queueName: "mixed-queue",
      payload: { workerId },
    });
  }, { concurrency: 10 });

  assert.equal(enqueueResult.errors.length, 0, "No errors during concurrent enqueue");

  const dequeueResult = await runConcurrentInvariant(async (_workerId: number) => {
    return adapter.dequeueAsync("mixed-queue");
  }, { concurrency: 10 });

  const dequeuedJobs = dequeueResult.values.filter((r) => r !== null);
  assert.equal(dequeuedJobs.length, 10, "Exactly 10 jobs dequeued");

  await adapter.close();
});
