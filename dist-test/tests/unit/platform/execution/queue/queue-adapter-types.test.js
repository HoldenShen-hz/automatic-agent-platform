import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RETRY_POLICY, QUEUE_JOBS_DDL, } from "../../../../../src/platform/execution/queue/queue-adapter-types.js";
test("DEFAULT_RETRY_POLICY has correct values", () => {
    assert.equal(DEFAULT_RETRY_POLICY.maxAttempts, 3);
    assert.equal(DEFAULT_RETRY_POLICY.backoffMs, 1000);
    assert.equal(DEFAULT_RETRY_POLICY.backoffMultiplier, 2);
});
test("QueueJobStatus type accepts all valid values", () => {
    const statuses = [
        "waiting",
        "delayed",
        "active",
        "completed",
        "failed",
        "dead_letter",
    ];
    assert.equal(statuses.length, 6);
});
test("QueueBackendKind type accepts all valid values", () => {
    const kinds = ["sqlite", "redis"];
    assert.equal(kinds.length, 2);
});
test("QueueJobRecord structure is correct", () => {
    const record = {
        id: "job_123",
        queueName: "default",
        payload: '{"task":"test"}',
        status: "waiting",
        priority: 0,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        delayUntil: null,
        idempotencyKey: "idempotent_key",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        completedAt: null,
    };
    assert.equal(record.id, "job_123");
    assert.equal(record.queueName, "default");
    assert.equal(record.status, "waiting");
    assert.equal(record.priority, 0);
    assert.equal(record.attempts, 0);
    assert.equal(record.maxAttempts, 3);
});
test("QueueJobRecord allows completed status with completedAt", () => {
    const record = {
        id: "job_completed",
        queueName: "priority",
        payload: '{"result":"done"}',
        status: "completed",
        priority: 10,
        attempts: 1,
        maxAttempts: 3,
        lastError: null,
        delayUntil: null,
        idempotencyKey: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
        completedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.status, "completed");
    assert.ok(record.completedAt !== null);
});
test("QueueJobRecord allows failed status with lastError", () => {
    const record = {
        id: "job_failed",
        queueName: "default",
        payload: '{"task":"failing"}',
        status: "failed",
        priority: 0,
        attempts: 3,
        maxAttempts: 3,
        lastError: "Connection timeout",
        delayUntil: null,
        idempotencyKey: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:05:00.000Z",
        completedAt: null,
    };
    assert.equal(record.status, "failed");
    assert.equal(record.lastError, "Connection timeout");
    assert.equal(record.attempts, 3);
});
test("QueueJobRecord allows delayed status with delayUntil", () => {
    const record = {
        id: "job_delayed",
        queueName: "background",
        payload: '{"deferred":true}',
        status: "delayed",
        priority: -1,
        attempts: 0,
        maxAttempts: 2,
        lastError: null,
        delayUntil: "2026-04-14T01:00:00.000Z",
        idempotencyKey: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        completedAt: null,
    };
    assert.equal(record.status, "delayed");
    assert.ok(record.delayUntil !== null);
    assert.ok(record.delayUntil > record.createdAt);
});
test("QueueJobRecord allows dead_letter status", () => {
    const record = {
        id: "job_dead",
        queueName: "critical",
        payload: '{" irrecoverable":true}',
        status: "dead_letter",
        priority: 100,
        attempts: 5,
        maxAttempts: 3,
        lastError: "Max attempts exceeded",
        delayUntil: null,
        idempotencyKey: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:10:00.000Z",
        completedAt: null,
    };
    assert.equal(record.status, "dead_letter");
    assert.equal(record.priority, 100);
});
test("EnqueueInput structure is correct", () => {
    const input = {
        queueName: "high_priority",
        payload: { taskId: "task_123" },
        priority: 10,
        maxAttempts: 5,
        delayUntil: "2026-04-14T12:00:00.000Z",
        idempotencyKey: "unique_key",
    };
    assert.equal(input.queueName, "high_priority");
    assert.deepEqual(input.payload, { taskId: "task_123" });
    assert.equal(input.priority, 10);
    assert.equal(input.maxAttempts, 5);
});
test("EnqueueInput allows minimal definition", () => {
    const input = {
        queueName: "minimal_queue",
        payload: "simple payload",
    };
    assert.equal(input.queueName, "minimal_queue");
    assert.equal(input.priority, undefined);
    assert.equal(input.maxAttempts, undefined);
    assert.equal(input.delayUntil, undefined);
    assert.equal(input.idempotencyKey, undefined);
});
test("QueueStats structure is correct", () => {
    const stats = {
        queueName: "test_queue",
        waiting: 10,
        delayed: 5,
        active: 2,
        completed: 100,
        failed: 3,
        deadLetter: 1,
    };
    assert.equal(stats.queueName, "test_queue");
    assert.equal(stats.waiting, 10);
    assert.equal(stats.completed, 100);
});
test("QueueStats allows zero values", () => {
    const stats = {
        queueName: "empty_queue",
        waiting: 0,
        delayed: 0,
        active: 0,
        completed: 0,
        failed: 0,
        deadLetter: 0,
    };
    assert.equal(stats.waiting, 0);
    assert.equal(stats.completed, 0);
});
test("RetryPolicy structure is correct", () => {
    const policy = {
        maxAttempts: 5,
        backoffMs: 2000,
        backoffMultiplier: 1.5,
    };
    assert.equal(policy.maxAttempts, 5);
    assert.equal(policy.backoffMs, 2000);
    assert.equal(policy.backoffMultiplier, 1.5);
});
test("RetryPolicy allows DEFAULT_RETRY_POLICY values", () => {
    const policy = {
        maxAttempts: DEFAULT_RETRY_POLICY.maxAttempts,
        backoffMs: DEFAULT_RETRY_POLICY.backoffMs,
        backoffMultiplier: DEFAULT_RETRY_POLICY.backoffMultiplier,
    };
    assert.equal(policy.maxAttempts, 3);
    assert.equal(policy.backoffMs, 1000);
    assert.equal(policy.backoffMultiplier, 2);
});
test("QUEUE_JOBS_DDL contains expected SQL statements", () => {
    assert.ok(QUEUE_JOBS_DDL.includes("CREATE TABLE"));
    assert.ok(QUEUE_JOBS_DDL.includes("queue_jobs"));
    assert.ok(QUEUE_JOBS_DDL.includes("idx_queue_jobs_queue_status_priority"));
});
test("RedisQueueConfig structure is correct", () => {
    const config = {
        host: "localhost",
        port: 6379,
        password: "secret",
        db: 0,
        prefix: "queue:",
        tls: true,
    };
    assert.equal(config.host, "localhost");
    assert.equal(config.port, 6379);
    assert.equal(config.password, "secret");
    assert.equal(config.db, 0);
    assert.equal(config.prefix, "queue:");
    assert.equal(config.tls, true);
});
test("RedisQueueConfig allows minimal definition", () => {
    const config = {
        host: "redis.example.com",
        port: 6380,
    };
    assert.equal(config.host, "redis.example.com");
    assert.equal(config.port, 6380);
    assert.equal(config.password, undefined);
    assert.equal(config.db, undefined);
    assert.equal(config.prefix, undefined);
    assert.equal(config.tls, undefined);
});
test("QueueBackendConfig structure is correct", () => {
    const config = {
        kind: "redis",
        redis: {
            host: "localhost",
            port: 6379,
        },
    };
    assert.equal(config.kind, "redis");
    assert.ok(config.redis !== undefined);
});
test("QueueBackendConfig allows sqlite kind", () => {
    const config = {
        kind: "sqlite",
    };
    assert.equal(config.kind, "sqlite");
    assert.equal(config.redis, undefined);
});
test("DequeueResult structure is correct", () => {
    let acked = false;
    let nacked = false;
    const job = {
        id: "job_result_test",
        queueName: "test_queue",
        payload: '{"action":"process"}',
        status: "active",
        priority: 5,
        attempts: 1,
        maxAttempts: 3,
        lastError: null,
        delayUntil: null,
        idempotencyKey: "idempotent_123",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        completedAt: null,
    };
    const result = {
        job,
        ack: () => { acked = true; },
        nack: (error) => { nacked = true; },
    };
    assert.equal(result.job.id, "job_result_test");
    assert.equal(typeof result.ack, "function");
    assert.equal(typeof result.nack, "function");
    result.ack();
    assert.equal(acked, true);
});
test("DequeueResult nack accepts optional error message", () => {
    let capturedError;
    const job = {
        id: "job_nack_test",
        queueName: "test_queue",
        payload: '{}',
        status: "active",
        priority: 0,
        attempts: 1,
        maxAttempts: 3,
        lastError: null,
        delayUntil: null,
        idempotencyKey: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        completedAt: null,
    };
    const result = {
        job,
        ack: () => { },
        nack: (error) => { capturedError = error; },
    };
    result.nack("Connection timeout");
    assert.equal(capturedError, "Connection timeout");
});
test("DequeueResult nack works without error argument", () => {
    let nacked = false;
    const job = {
        id: "job_nack_no_err",
        queueName: "test_queue",
        payload: '{}',
        status: "active",
        priority: 0,
        attempts: 1,
        maxAttempts: 3,
        lastError: null,
        delayUntil: null,
        idempotencyKey: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        completedAt: null,
    };
    const result = {
        job,
        ack: () => { },
        nack: () => { nacked = true; },
    };
    result.nack();
    assert.equal(nacked, true);
});
test("QueueAdapter interface is satisfied by mock implementation", () => {
    const mockAdapter = {
        backendKind: "sqlite",
        enqueue: (input) => ({
            id: "enqueued_job",
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
        }),
        dequeue: () => null,
        getJob: () => null,
        listJobs: () => [],
        moveToDeadLetter: () => { },
        retryJob: () => null,
        purge: () => 0,
        stats: () => ({
            queueName: "test",
            waiting: 0,
            delayed: 0,
            active: 0,
            completed: 0,
            failed: 0,
            deadLetter: 0,
        }),
        listQueues: () => ["test"],
    };
    assert.equal(mockAdapter.backendKind, "sqlite");
    const job = mockAdapter.enqueue({ queueName: "test", payload: { data: "value" } });
    assert.equal(job.queueName, "test");
    assert.deepEqual(JSON.parse(job.payload), { data: "value" });
});
test("QUEUE_JOBS_DDL contains all expected schema elements", () => {
    assert.ok(QUEUE_JOBS_DDL.includes("CREATE TABLE"));
    assert.ok(QUEUE_JOBS_DDL.includes("queue_jobs"));
    assert.ok(QUEUE_JOBS_DDL.includes("id TEXT PRIMARY KEY"));
    assert.ok(QUEUE_JOBS_DDL.includes("queue_name TEXT NOT NULL"));
    assert.ok(QUEUE_JOBS_DDL.includes("payload TEXT NOT NULL"));
    assert.ok(QUEUE_JOBS_DDL.includes("status TEXT NOT NULL DEFAULT 'waiting'"));
    assert.ok(QUEUE_JOBS_DDL.includes("priority INTEGER NOT NULL DEFAULT 0"));
    assert.ok(QUEUE_JOBS_DDL.includes("attempts INTEGER NOT NULL DEFAULT 0"));
    assert.ok(QUEUE_JOBS_DDL.includes("max_attempts INTEGER NOT NULL DEFAULT 3"));
    assert.ok(QUEUE_JOBS_DDL.includes("last_error TEXT NULL"));
    assert.ok(QUEUE_JOBS_DDL.includes("delay_until TEXT NULL"));
    assert.ok(QUEUE_JOBS_DDL.includes("idempotency_key TEXT NULL"));
    assert.ok(QUEUE_JOBS_DDL.includes("created_at TEXT NOT NULL"));
    assert.ok(QUEUE_JOBS_DDL.includes("updated_at TEXT NOT NULL"));
    assert.ok(QUEUE_JOBS_DDL.includes("completed_at TEXT NULL"));
    assert.ok(QUEUE_JOBS_DDL.includes("idx_queue_jobs_queue_status_priority"));
    assert.ok(QUEUE_JOBS_DDL.includes("idx_queue_jobs_idempotency"));
});
//# sourceMappingURL=queue-adapter-types.test.js.map