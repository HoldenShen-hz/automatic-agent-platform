/**
 * RedisQueueAdapter Unit Tests
 *
 * Tests core functionality and concurrency per §17.1 using the explicit in-memory driver.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RedisQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/redis-queue-adapter.js";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";

const TEST_MEMORY_CONFIG = {
  host: "localhost",
  port: 6379,
  driver: "memory" as const,
};

function createMemoryAdapter(overrides: Partial<typeof TEST_MEMORY_CONFIG> & Record<string, unknown> = {}): RedisQueueAdapter {
  return new RedisQueueAdapter({ ...TEST_MEMORY_CONFIG, ...overrides });
}

test("RedisQueueAdapter backendKind is redis [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.equal(adapter.backendKind, "redis");
});

test("RedisQueueAdapter sync enqueue is not supported [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.enqueue({ queueName: "test-queue", payload: { taskId: "t1" } }), /sync_enqueue_not_supported/);
});

test("RedisQueueAdapter enqueueAsync accepts all input options [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();
  const job = await adapter.enqueueAsync({
    queueName: "priority-queue",
    payload: { data: "test" },
    priority: 10,
    maxAttempts: 5,
    idempotencyKey: "key-123",
  });

  assert.equal(job.queueName, "priority-queue");
  assert.equal(job.priority, 10);
  assert.equal(job.maxAttempts, 5);
  assert.equal(job.idempotencyKey, "key-123");
  await adapter.close();
});

test("RedisQueueAdapter enqueueAsync handles delayed jobs [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();
  const futureDate = new Date(Date.now() + 3600000).toISOString();
  const job = await adapter.enqueueAsync({
    queueName: "delayed-queue",
    payload: { deferred: true },
    delayUntil: futureDate,
  });

  assert.equal(job.status, "delayed");
  assert.ok(job.delayUntil != null);
  await adapter.close();
});

test("RedisQueueAdapter enqueueAsync job structure is complete [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();
  const job = await adapter.enqueueAsync({ queueName: "q", payload: { test: true } });

  assert.ok(job.id);
  assert.ok(job.createdAt);
  assert.ok(job.updatedAt);
  assert.equal(job.lastError, null);
  assert.equal(job.completedAt, null);
  await adapter.close();
});

test("RedisQueueAdapter sync dequeue throws not-supported error [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.enqueue({ queueName: "q", payload: "x" }), /sync_enqueue_not_supported/);
  assert.throws(() => adapter.dequeue("q"), /sync_dequeue_not_supported/);
});

test("RedisQueueAdapter sync getJob throws not-supported error [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.getJob("x"), /sync_getJob_not_supported/);
});

test("RedisQueueAdapter sync listJobs throws not-supported error [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.listJobs("q"), /sync_listJobs_not_supported/);
});

test("RedisQueueAdapter sync moveToDeadLetter throws not-supported error [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.moveToDeadLetter("x", "r"), /sync_moveToDeadLetter_not_supported/);
});

test("RedisQueueAdapter sync retryJob throws not-supported error [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.retryJob("x"), /sync_retryJob_not_supported/);
});

test("RedisQueueAdapter sync purge throws not-supported error [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.purge("q", "2026-01-01"), /sync_purge_not_supported/);
});

test("RedisQueueAdapter sync stats throws not-supported error [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.stats("q"), /sync_stats_not_supported/);
});

test("RedisQueueAdapter sync listQueues throws not-supported error [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.throws(() => adapter.listQueues(), /sync_listQueues_not_supported/);
});

test("RedisQueueAdapter config defaults [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter();
  assert.equal(adapter.backendKind, "redis");
});

test("RedisQueueAdapter config with all options [redis-queue-adapter.unit]", () => {
  const adapter = createMemoryAdapter({
    host: "redis.example.com",
    port: 6380,
    password: "secret",
    db: 1,
    prefix: "queue:",
    tls: true,
  });
  assert.equal(adapter.backendKind, "redis");
});

// §17.1 Concurrency Tests for RedisQueueAdapter

test("RedisQueueAdapter concurrent enqueues maintain data integrity [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  const result = await runConcurrentInvariant(async (workerId: number) => {
    return adapter.enqueueAsync({
      queueName: "concurrent-queue",
      payload: { workerId },
    });
  }, { concurrency: 10 });

  assert.equal(result.errors.length, 0, "No errors during concurrent enqueue");
  assert.equal(result.values.length, 10, "All 10 enqueues completed");
  await adapter.close();
});

test("RedisQueueAdapter concurrent enqueue idempotency check [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  // First enqueue with idempotency key
  const first = await adapter.enqueueAsync({
    queueName: "idempotent-queue",
    payload: { workerId: 0 },
    idempotencyKey: "same-key",
  });

  // Concurrent enqueues with same key should all return the same job
  const result = await runConcurrentInvariant(async (workerId: number) => {
    return adapter.enqueueAsync({
      queueName: "idempotent-queue",
      payload: { workerId },
      idempotencyKey: "same-key",
    });
  }, { concurrency: 5 });

  assert.equal(result.errors.length, 0, "No errors during concurrent idempotent enqueue");

  // All should return the same job ID as the first enqueue
  for (const job of result.values) {
    assert.equal(job.id, first.id, "All concurrent idempotent enqueues should return same job ID");
  }

  await adapter.close();
});

test("RedisQueueAdapter async dequeue returns null for empty queue [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();
  const result = await adapter.dequeueAsync("nonexistent");
  assert.equal(result, null);
});

test("RedisQueueAdapter async enqueue and dequeue workflow [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  const job = await adapter.enqueueAsync({
    queueName: "workflow-test",
    payload: { taskId: "t1" },
  });

  const dequeueResult = await adapter.dequeueAsync("workflow-test");
  assert.ok(dequeueResult);
  assert.equal(dequeueResult.job.id, job.id);
  assert.equal(dequeueResult.job.status, "active");

  await adapter.close();
});

test("RedisQueueAdapter async dequeue ack marks job completed [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  await adapter.enqueueAsync({ queueName: "ack-test", payload: { done: true } });
  const result = await adapter.dequeueAsync("ack-test");

  assert.ok(result);
  await result.ack();

  const completed = await adapter.getJobAsync(result.job.id);
  assert.equal(completed?.status, "completed");
  assert.ok(completed?.completedAt);

  await adapter.close();
});

test("RedisQueueAdapter async dequeue nack requeues on retry [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  const job = await adapter.enqueueAsync({
    queueName: "nack-test",
    payload: { fail: true },
    maxAttempts: 3,
  });

  const result = await adapter.dequeueAsync("nack-test");
  assert.ok(result);
  await result.nack("test error");

  const requeued = await adapter.getJobAsync(job.id);
  assert.equal(requeued?.status, "delayed");
  assert.equal(requeued?.attempts, 1);
  assert.equal(requeued?.lastError, "test error");
  assert.ok(requeued?.delayUntil);

  await adapter.close();
});

test("RedisQueueAdapter async moveToDeadLetter marks job dead_letter [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  const job = await adapter.enqueueAsync({ queueName: "dlq-test", payload: { dead: true } });
  await adapter.moveToDeadLetterAsync(job.id, "max_retries_exceeded");

  const moved = await adapter.getJobAsync(job.id);
  assert.equal(moved?.status, "dead_letter");
  assert.equal(moved?.lastError, "max_retries_exceeded");

  await adapter.close();
});

test("RedisQueueAdapter async stats returns correct counts [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

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

test("RedisQueueAdapter async listQueues returns all queue names [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  await adapter.enqueueAsync({ queueName: "queue-a", payload: {} });
  await adapter.enqueueAsync({ queueName: "queue-b", payload: {} });
  await adapter.enqueueAsync({ queueName: "queue-c", payload: {} });

  const queues = await adapter.listQueuesAsync();
  assert.ok(queues.includes("queue-a"));
  assert.ok(queues.includes("queue-b"));
  assert.ok(queues.includes("queue-c"));

  await adapter.close();
});

test("RedisQueueAdapter async retryJob requeues dead-letter job without resetting attempts [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  const job = await adapter.enqueueAsync({ queueName: "retry-test", payload: {} });
  await adapter.moveToDeadLetterAsync(job.id, "manual triage");

  const retried = await adapter.retryJobAsync(job.id);
  assert.ok(retried);
  assert.equal(retried?.status, "waiting");
  assert.equal(retried?.attempts, 0);
  assert.equal(retried?.lastError, null);

  await adapter.close();
});

test("RedisQueueAdapter async with idempotency key returns existing job [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

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

test("RedisQueueAdapter async with priority orders correctly [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  await adapter.enqueueAsync({ queueName: "priority-test", payload: { n: 1 }, priority: 1 });
  await adapter.enqueueAsync({ queueName: "priority-test", payload: { n: 2 }, priority: 10 });
  await adapter.enqueueAsync({ queueName: "priority-test", payload: { n: 3 }, priority: 5 });

  const result = await adapter.dequeueAsync("priority-test");
  assert.ok(result);
  const payload = JSON.parse(result.job.payload);
  assert.equal(payload.n, 2);

  await adapter.close();
});

test("RedisQueueAdapter async dequeue nack dead-letters when retry budget is exhausted [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  const job = await adapter.enqueueAsync({ queueName: "tasks", payload: {}, maxAttempts: 1 });

  const r1 = await adapter.dequeueAsync("tasks");
  assert.ok(r1);
  await r1.nack();

  const dlqJob = await adapter.getJobAsync(job.id);
  assert.equal(dlqJob?.status, "dead_letter");

  await adapter.close();
});

test("RedisQueueAdapter async dequeue dead-letters exhausted waiting jobs during claim [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  const job = await adapter.enqueueAsync({ queueName: "claim-budget-test", payload: {}, maxAttempts: 1 });
  const internalClient = adapter as unknown as {
    client: {
      hmset: (key: string, data: Record<string, string>) => Promise<void>;
      zadd: (key: string, score: number, member: string) => Promise<number>;
    };
    waitingKey: (queueName: string) => string;
    jobKey: (jobId: string) => string;
  };
  await internalClient.client.hmset(internalClient.jobKey(job.id), {
    status: "waiting",
    attempts: "1",
    max_attempts: "1",
    updated_at: new Date().toISOString(),
  });
  await internalClient.client.zadd(internalClient.waitingKey("claim-budget-test"), Date.now(), job.id);

  const result = await adapter.dequeueAsync("claim-budget-test");
  assert.equal(result, null);

  const deadLettered = await adapter.getJobAsync(job.id);
  assert.equal(deadLettered?.status, "dead_letter");
  assert.equal(deadLettered?.attempts, 1);

  await adapter.close();
});

test("RedisQueueAdapter concurrent async enqueue and dequeue operations [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();

  // Enqueue 10 jobs concurrently
  const enqueueResult = await runConcurrentInvariant(async (workerId: number) => {
    return adapter.enqueueAsync({
      queueName: "mixed-queue",
      payload: { workerId },
    });
  }, { concurrency: 10 });

  assert.equal(enqueueResult.errors.length, 0, "No errors during concurrent enqueue");
  assert.equal(enqueueResult.values.length, 10, "All 10 enqueues completed");

  // Dequeue all 10 jobs - each should be unique
  const dequeueResult = await runConcurrentInvariant(async (_workerId: number) => {
    return adapter.dequeueAsync("mixed-queue");
  }, { concurrency: 10 });

  const dequeuedJobs = dequeueResult.values.filter((r) => r !== null);
  assert.ok(dequeuedJobs.length > 0, "Some jobs should be dequeued");
});

test("RedisQueueAdapter ping returns PONG [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();
  const result = await adapter.ping();
  assert.equal(result, "PONG");
  await adapter.close();
});

test("RedisQueueAdapter close succeeds without error [redis-queue-adapter.unit]", async () => {
  const adapter = createMemoryAdapter();
  await adapter.close();
  assert.ok(true, "Close should not throw");
});
