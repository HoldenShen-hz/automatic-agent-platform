/**
 * @fileoverview Comprehensive edge case tests for QueueAdapterFactory
 *
 * Tests error handling, edge cases, and boundary conditions for the
 * createQueueAdapter factory function.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { createQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-factory.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { QUEUE_JOBS_DDL } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "queue-factory-edge-cases.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);
  return { workspace, db };
}

test("createQueueAdapter throws ValidationError with code queue.missing_redis_config when redis kind has no config", () => {
  try {
    createQueueAdapter({ kind: "redis" });
    assert.fail("Expected ValidationError to be thrown");
  } catch (error: any) {
    assert.ok(error instanceof ValidationError, "Expected ValidationError instance");
    assert.ok(error.code.includes("queue.missing_redis_config"), `Expected code to include queue.missing_redis_config, got: ${error.code}`);
    assert.equal(error.retryable, false);
  }
});

test("createQueueAdapter throws ValidationError with code queue.missing_sqlite_db when sqlite kind has no db", () => {
  try {
    createQueueAdapter({ kind: "sqlite" });
    assert.fail("Expected ValidationError to be thrown");
  } catch (error: any) {
    assert.ok(error instanceof ValidationError, "Expected ValidationError instance");
    assert.ok(error.code.includes("queue.missing_sqlite_db"), `Expected code to include queue.missing_sqlite_db, got: ${error.code}`);
    assert.equal(error.retryable, false);
  }
});

test("createQueueAdapter creates RedisQueueAdapter with minimal redis config", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "localhost",
      port: 6379,
    },
  });

  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter creates RedisQueueAdapter with full redis config", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "redis.example.com",
      port: 6380,
      password: "secret_password",
      db: 1,
      prefix: "queue:",
      tls: true,
    },
  });

  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter creates RedisQueueAdapter with only host and port", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "redis-server",
      port: 6379,
    },
  });

  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter creates SqliteQueueAdapter with provided database", () => {
  const h = createHarness("aa-factory-sqlite-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    assert.equal(adapter.backendKind, "sqlite");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter creates SqliteQueueAdapter with custom migration plan", () => {
  const h = createHarness("aa-factory-sqlite-migration-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    assert.equal(adapter.backendKind, "sqlite");

    // Enqueue a job to verify adapter works
    const job = adapter.enqueue({ queueName: "test", payload: { data: "test" } });
    assert.equal(job.queueName, "test");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter redis config with all optional TLS options", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "localhost",
      port: 6379,
      tls: {
        rejectUnauthorized: false,
      },
    },
  });

  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter redis config with unix socket path", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: {
      host: "/var/run/redis.sock",
      port: 6379,
    },
  });

  assert.equal(adapter.backendKind, "redis");
});

test("createQueueAdapter sqlite adapter enqueues and dequeues jobs", () => {
  const h = createHarness("aa-factory-functional-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    assert.equal(adapter.backendKind, "sqlite");

    const job = adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
    assert.equal(job.queueName, "tasks");
    assert.equal(job.status, "waiting");

    const result = adapter.dequeue("tasks");
    assert.ok(result);
    assert.equal(result.job.id, job.id);

    result.ack();
    const completed = adapter.getJob(job.id);
    assert.equal(completed?.status, "completed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter sqlite adapter with multiple queue names", () => {
  const h = createHarness("aa-factory-multi-queue-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);

    adapter.enqueue({ queueName: "queue-a", payload: "a" });
    adapter.enqueue({ queueName: "queue-b", payload: "b" });
    adapter.enqueue({ queueName: "queue-a", payload: "a2" });

    const queues = adapter.listQueues();
    assert.ok(queues.includes("queue-a"));
    assert.ok(queues.includes("queue-b"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter validates config.kind is required", () => {
  // @ts-expect-error - testing invalid config
  try {
    createQueueAdapter({});
    assert.fail("Expected error for missing kind");
  } catch (error: any) {
    assert.ok(error instanceof ValidationError);
  }
});

test("createQueueAdapter redis config host is required", () => {
  try {
    createQueueAdapter({
      kind: "redis",
      redis: {
        port: 6379,
      },
    });
    assert.fail("Expected ValidationError");
  } catch (error: any) {
    assert.ok(error instanceof ValidationError);
  }
});

test("createQueueAdapter redis config port is required", () => {
  try {
    createQueueAdapter({
      kind: "redis",
      redis: {
        host: "localhost",
      },
    });
    assert.fail("Expected ValidationError");
  } catch (error: any) {
    assert.ok(error instanceof ValidationError);
  }
});

test("createQueueAdapter sqlite adapter handles priority ordering", () => {
  const h = createHarness("aa-factory-priority-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);

    adapter.enqueue({ queueName: "q", payload: "low", priority: 1 });
    adapter.enqueue({ queueName: "q", payload: "high", priority: 10 });
    adapter.enqueue({ queueName: "q", payload: "medium", priority: 5 });

    const r1 = adapter.dequeue("q");
    assert.equal(JSON.parse(r1!.job.payload), "high");
    r1!.ack();

    const r2 = adapter.dequeue("q");
    assert.equal(JSON.parse(r2!.job.payload), "medium");
    r2!.ack();

    const r3 = adapter.dequeue("q");
    assert.equal(JSON.parse(r3!.job.payload), "low");
    r3!.ack();
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter sqlite adapter handles idempotency keys", () => {
  const h = createHarness("aa-factory-idempotent-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);

    const j1 = adapter.enqueue({ queueName: "q", payload: "first", idempotencyKey: "key-1" });
    const j2 = adapter.enqueue({ queueName: "q", payload: "duplicate", idempotencyKey: "key-1" });

    assert.equal(j1.id, j2.id);
    assert.equal(adapter.listJobs("q").length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter sqlite adapter handles delayed jobs", () => {
  const h = createHarness("aa-factory-delayed-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const pastDate = new Date(Date.now() - 1_000).toISOString();

    adapter.enqueue({ queueName: "q", payload: "future", delayUntil: futureDate });
    adapter.enqueue({ queueName: "q", payload: "ready", delayUntil: pastDate });

    const r1 = adapter.dequeue("q");
    assert.ok(r1);
    assert.equal(JSON.parse(r1.job.payload), "ready");

    const stats = adapter.stats("q");
    assert.equal(stats.delayed, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter sqlite adapter moveToDeadLetter works", () => {
  const h = createHarness("aa-factory-dl-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    const job = adapter.enqueue({ queueName: "q", payload: "poison" });
    adapter.moveToDeadLetter(job.id, "poison_message");

    const dl = adapter.getJob(job.id);
    assert.equal(dl?.status, "dead_letter");
    assert.equal(dl?.lastError, "poison_message");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter sqlite adapter retryJob resets dead-letter job", () => {
  const h = createHarness("aa-factory-retry-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    const job = adapter.enqueue({ queueName: "q", payload: "retry-me", maxAttempts: 1 });

    const r1 = adapter.dequeue("q");
    r1!.nack("fail");
    assert.equal(adapter.getJob(job.id)?.status, "dead_letter");

    const retried = adapter.retryJob(job.id);
    assert.equal(retried?.status, "waiting");
    assert.equal(retried?.attempts, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter sqlite adapter stats returns correct counts", () => {
  const h = createHarness("aa-factory-stats-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    adapter.enqueue({ queueName: "q", payload: "a" });
    adapter.enqueue({ queueName: "q", payload: "b" });
    const r = adapter.dequeue("q");
    r!.ack();

    const stats = adapter.stats("q");
    assert.equal(stats.waiting, 1);
    assert.equal(stats.completed, 1);
    assert.equal(stats.queueName, "q");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter sqlite adapter listJobs filters by status", () => {
  const h = createHarness("aa-factory-listjobs-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    adapter.enqueue({ queueName: "q", payload: "a" });
    adapter.enqueue({ queueName: "q", payload: "b" });
    const r = adapter.dequeue("q");
    r!.ack();

    const waiting = adapter.listJobs("q", "waiting");
    assert.equal(waiting.length, 1);
    const completed = adapter.listJobs("q", "completed");
    assert.equal(completed.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter sqlite adapter purge removes old jobs", () => {
  const h = createHarness("aa-factory-purge-");
  try {
    const adapter = createQueueAdapter({ kind: "sqlite" }, h.db);
    const job = adapter.enqueue({ queueName: "q", payload: "old" });
    const r = adapter.dequeue("q");
    r!.ack();

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const purged = adapter.purge("q", future);
    assert.equal(purged, 1);
    assert.equal(adapter.getJob(job.id), null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("createQueueAdapter redis throws for unsupported sync operations", () => {
  const adapter = createQueueAdapter({
    kind: "redis",
    redis: { host: "localhost", port: 6379 },
  });

  assert.equal(adapter.backendKind, "redis");

  // enqueue works synchronously
  const job = adapter.enqueue({ queueName: "q", payload: { test: true } });
  assert.ok(job);

  // All sync methods throw not-supported errors
  assert.throws(() => adapter.dequeue("q"), /sync_dequeue_not_supported/);
  assert.throws(() => adapter.getJob("x"), /sync_getJob_not_supported/);
  assert.throws(() => adapter.listJobs("q"), /sync_listJobs_not_supported/);
  assert.throws(() => adapter.moveToDeadLetter("x", "r"), /sync_moveToDeadLetter_not_supported/);
  assert.throws(() => adapter.retryJob("x"), /sync_retryJob_not_supported/);
  assert.throws(() => adapter.purge("q", "2026-01-01"), /sync_purge_not_supported/);
  assert.throws(() => adapter.stats("q"), /sync_stats_not_supported/);
  assert.throws(() => adapter.listQueues(), /sync_listQueues_not_supported/);
});