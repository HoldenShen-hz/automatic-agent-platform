import assert from "node:assert/strict";
import test from "node:test";

import { RedisQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/redis-queue-adapter.js";
import type { QueueJobRecord, EnqueueInput } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

test("RedisQueueAdapter backendKind is redis [redis-queue-adapter]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  assert.equal(adapter.backendKind, "redis");
});

test("RedisQueueAdapter sync enqueue is not supported [redis-queue-adapter]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  assert.throws(() => adapter.enqueue({ queueName: "test-queue", payload: { taskId: "t1" } }), /sync_enqueue_not_supported/);
});

test("RedisQueueAdapter enqueueAsync accepts all input options [redis-queue-adapter]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
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

test("RedisQueueAdapter enqueueAsync handles delayed jobs [redis-queue-adapter]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
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

test("RedisQueueAdapter sync methods throw not-supported errors [redis-queue-adapter]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(() => adapter.enqueue({ queueName: "q", payload: "x" }), /sync_enqueue_not_supported/);
  assert.throws(() => adapter.dequeue("q"), /sync_dequeue_not_supported/);
  assert.throws(() => adapter.getJob("x"), /sync_getJob_not_supported/);
  assert.throws(() => adapter.listJobs("q"), /sync_listJobs_not_supported/);
  assert.throws(() => adapter.moveToDeadLetter("x", "r"), /sync_moveToDeadLetter_not_supported/);
  assert.throws(() => adapter.retryJob("x"), /sync_retryJob_not_supported/);
  assert.throws(() => adapter.purge("q", "2026-01-01"), /sync_purge_not_supported/);
  assert.throws(() => adapter.stats("q"), /sync_stats_not_supported/);
  assert.throws(() => adapter.listQueues(), /sync_listQueues_not_supported/);
});

test("RedisQueueAdapter config defaults [redis-queue-adapter]", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  assert.equal(adapter.backendKind, "redis");
});

test("RedisQueueAdapter config with all options [redis-queue-adapter]", () => {
  const adapter = new RedisQueueAdapter({
    host: "redis.example.com",
    port: 6380,
    password: "secret",
    db: 1,
    prefix: "queue:",
    tls: true,
  });
  assert.equal(adapter.backendKind, "redis");
});

test("RedisQueueAdapter enqueueAsync job structure is complete [redis-queue-adapter]", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379, driver: "memory" });
  const job = await adapter.enqueueAsync({ queueName: "q", payload: { test: true } });

  assert.ok(job.id);
  assert.ok(job.createdAt);
  assert.ok(job.updatedAt);
  assert.equal(job.lastError, null);
  assert.equal(job.completedAt, null);
  await adapter.close();
});
