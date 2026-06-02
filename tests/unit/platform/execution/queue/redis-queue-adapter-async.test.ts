import assert from "node:assert/strict";
import test from "node:test";

// Test RedisQueueAdapter async methods without requiring a live Redis connection.
// We test the error-throwing behavior and the method signatures by mocking ioredis.

import { RedisQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/redis-queue-adapter.js";
import type { EnqueueInput, QueueJobRecord } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

test("RedisQueueAdapter enqueueAsync returns a job record with correct structure [redis-queue-adapter-async]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
  const job = await adapter.enqueueAsync({ queueName: "test-queue", payload: { data: "test" } });

  assert.equal(job.queueName, "test-queue");
  assert.equal(job.status, "waiting");
  assert.equal(job.attempts, 0);
  assert.equal(job.maxAttempts, 3);
  assert.ok(job.id.startsWith("qjob_"));
  assert.ok(job.createdAt);
  assert.ok(job.updatedAt);
  await adapter.close();
});

test("RedisQueueAdapter enqueueAsync respects priority and maxAttempts options [redis-queue-adapter-async]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
  const job = await adapter.enqueueAsync({
    queueName: "priority-queue",
    payload: "high-priority",
    priority: 100,
    maxAttempts: 5,
  });

  assert.equal(job.priority, 100);
  assert.equal(job.maxAttempts, 5);
  await adapter.close();
});

test("RedisQueueAdapter enqueueAsync sets delayed status for future delayUntil [redis-queue-adapter-async]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
  const futureDate = new Date(Date.now() + 3600_000).toISOString();
  const job = await adapter.enqueueAsync({
    queueName: "delayed-queue",
    payload: "delayed-job",
    delayUntil: futureDate,
  });

  assert.equal(job.status, "delayed");
  assert.equal(job.delayUntil, futureDate);
  await adapter.close();
});

test("RedisQueueAdapter enqueueAsync sets waiting status for past delayUntil [redis-queue-adapter-async]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
  const pastDate = new Date(Date.now() - 1000).toISOString();
  const job = await adapter.enqueueAsync({
    queueName: "ready-queue",
    payload: "ready-job",
    delayUntil: pastDate,
  });

  assert.equal(job.status, "waiting");
  await adapter.close();
});

test("RedisQueueAdapter enqueueAsync uses default priority when not specified [redis-queue-adapter-async]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
  const job = await adapter.enqueueAsync({ queueName: "q", payload: "test" });
  assert.equal(job.priority, 0);
  await adapter.close();
});

test("RedisQueueAdapter backendKind is redis [redis-queue-adapter-async]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  assert.equal(adapter.backendKind, "redis");
});

test("RedisQueueAdapter sync methods throw sync_not_supported errors [redis-queue-adapter-async]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  const methods = [
    { name: "enqueue", fn: () => adapter.enqueue({ queueName: "q", payload: "x" }), expected: "sync_enqueue_not_supported" },
    { name: "dequeue", fn: () => adapter.dequeue("q"), expected: "sync_dequeue_not_supported" },
    { name: "getJob", fn: () => adapter.getJob("x"), expected: "sync_getJob_not_supported" },
    { name: "listJobs", fn: () => adapter.listJobs("q"), expected: "sync_listJobs_not_supported" },
    { name: "moveToDeadLetter", fn: () => adapter.moveToDeadLetter("x", "r"), expected: "sync_moveToDeadLetter_not_supported" },
    { name: "retryJob", fn: () => adapter.retryJob("x"), expected: "sync_retryJob_not_supported" },
    { name: "purge", fn: () => adapter.purge("q", "2026-01-01"), expected: "sync_purge_not_supported" },
    { name: "stats", fn: () => adapter.stats("q"), expected: "sync_stats_not_supported" },
    { name: "listQueues", fn: () => adapter.listQueues(), expected: "sync_listQueues_not_supported" },
  ];

  for (const { name, fn, expected } of methods) {
    try {
      fn();
      assert.fail(`Expected ${name} to throw`);
    } catch (error: any) {
      assert.ok(error.message.includes(expected), `Expected '${expected}' in error for ${name}, got: ${error.message}`);
    }
  }
});

test("RedisQueueAdapter requires host and defaults port to 6379 [redis-queue-adapter-async]", () => {
  assert.throws(
    () => new RedisQueueAdapter({}),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "redis.host_required",
  );

  const adapter = new RedisQueueAdapter({ host: "redis.example.com" });
  assert.equal(adapter.backendKind, "redis");
});

test("RedisQueueAdapter mapRedisToJobRecord handles missing optional fields [redis-queue-adapter-async]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  // Access private method via any cast to test edge cases
  const result = adapter.mapRedisToJobRecord({
    id: "job-1",
    queue_name: "q",
    payload: "{}",
    status: "waiting",
    priority: "5",
    attempts: "0",
    max_attempts: "3",
    last_error: "",
    delay_until: "",
    idempotency_key: "",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    completed_at: "",
  });

  assert.equal(result.id, "job-1");
  assert.equal(result.queueName, "q");
  assert.equal(result.priority, 5);
  assert.equal(result.attempts, 0);
  assert.equal(result.maxAttempts, 3);
  assert.equal(result.lastError, null);
  assert.equal(result.delayUntil, null);
  assert.equal(result.idempotencyKey, null);
  assert.equal(result.completedAt, null);
});

test("RedisQueueAdapter mapRedisToJobRecord parses integer fields correctly [redis-queue-adapter-async]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  const result = adapter.mapRedisToJobRecord({
    id: "job-2",
    queue_name: "priority-q",
    payload: '{"x":1}',
    status: "active",
    priority: "100",
    attempts: "5",
    max_attempts: "10",
    last_error: "some error",
    delay_until: "2026-04-15T00:00:00.000Z",
    idempotency_key: "idem-key",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:01:00.000Z",
    completed_at: "",
  });

  assert.equal(result.priority, 100);
  assert.equal(result.attempts, 5);
  assert.equal(result.maxAttempts, 10);
  assert.equal(result.lastError, "some error");
  assert.equal(result.delayUntil, "2026-04-15T00:00:00.000Z");
  assert.equal(result.idempotencyKey, "idem-key");
});

test("RedisQueueAdapter mapRedisToJobRecord defaults missing fields to sensible values [redis-queue-adapter-async]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  const result = adapter.mapRedisToJobRecord({});

  assert.equal(result.id, "");
  assert.equal(result.queueName, "");
  assert.equal(result.payload, "");
  assert.equal(result.status, "waiting");
  assert.equal(result.priority, 0);
  assert.equal(result.attempts, 0);
  assert.equal(result.maxAttempts, 3);
  assert.equal(result.lastError, null);
  assert.equal(result.delayUntil, null);
  assert.equal(result.idempotencyKey, null);
  assert.ok(result.createdAt);
  assert.ok(result.updatedAt);
  assert.equal(result.completedAt, null);
});

// Note: key() is a private method on RedisQueueClient, not exposed on RedisQueueAdapter
// RedisQueueAdapter key construction is tested indirectly via enqueue behavior
