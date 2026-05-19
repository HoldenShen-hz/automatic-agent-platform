/**
 * @fileoverview Tests for Core Runtime Queue Adapter types
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RETRY_POLICY, QUEUE_JOBS_DDL, } from "../../../../src/core/runtime/queue-adapter.js";
// ---------------------------------------------------------------------------
// QueueBackendKind
// ---------------------------------------------------------------------------
test("QueueBackendKind supports sqlite and redis", () => {
    const kinds = ["sqlite", "redis"];
    assert.equal(kinds.length, 2);
});
// ---------------------------------------------------------------------------
// QueueJobStatus
// ---------------------------------------------------------------------------
test("QueueJobStatus covers all job lifecycle states", () => {
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
// ---------------------------------------------------------------------------
// DefaultRetryPolicy
// ---------------------------------------------------------------------------
test("DEFAULT_RETRY_POLICY has correct structure", () => {
    assert.equal(DEFAULT_RETRY_POLICY.maxAttempts, 3);
    assert.equal(DEFAULT_RETRY_POLICY.backoffMs, 1000);
    assert.equal(DEFAULT_RETRY_POLICY.backoffMultiplier, 2);
});
test("DEFAULT_RETRY_POLICY values are sensible for retry scenarios", () => {
    assert.ok(DEFAULT_RETRY_POLICY.maxAttempts > 0);
    assert.ok(DEFAULT_RETRY_POLICY.backoffMs > 0);
    assert.ok(DEFAULT_RETRY_POLICY.backoffMultiplier >= 1);
});
// ---------------------------------------------------------------------------
// QueueAdapter interface contract
// ---------------------------------------------------------------------------
test("QueueAdapter interface requires backendKind", () => {
    // This is a compile-time check test - we verify the type includes backendKind
    // Since we can't create an interface directly, we verify through the types
    const adapter = {
        backendKind: "sqlite",
    };
    assert.equal(adapter.backendKind, "sqlite");
});
test("EnqueueInput can be constructed with required fields", () => {
    const input = {
        queueName: "test-queue",
        payload: { data: "test" },
    };
    assert.equal(input.queueName, "test-queue");
    assert.deepEqual(input.payload, { data: "test" });
});
test("EnqueueInput supports all optional fields", () => {
    const input = {
        queueName: "test-queue",
        payload: { data: "test" },
        priority: 10,
        maxAttempts: 5,
        delayUntil: "2026-04-27T00:00:00.000Z",
        idempotencyKey: "key-123",
    };
    assert.equal(input.priority, 10);
    assert.equal(input.maxAttempts, 5);
    assert.equal(input.delayUntil, "2026-04-27T00:00:00.000Z");
    assert.equal(input.idempotencyKey, "key-123");
});
test("QueueStats structure", () => {
    const stats = {
        queueName: "test-queue",
        waiting: 5,
        delayed: 2,
        active: 1,
        completed: 100,
        failed: 3,
        deadLetter: 1,
    };
    assert.equal(stats.queueName, "test-queue");
    assert.equal(stats.waiting, 5);
    assert.equal(stats.completed, 100);
});
test("RetryPolicy structure", () => {
    const policy = {
        maxAttempts: 5,
        backoffMs: 2000,
        backoffMultiplier: 2.5,
    };
    assert.equal(policy.maxAttempts, 5);
    assert.equal(policy.backoffMs, 2000);
    assert.equal(policy.backoffMultiplier, 2.5);
});
// ---------------------------------------------------------------------------
// QUEUE_JOBS_DDL
// ---------------------------------------------------------------------------
test("QUEUE_JOBS_DDL contains expected CREATE TABLE statement", () => {
    assert.ok(QUEUE_JOBS_DDL.includes("CREATE TABLE"));
    assert.ok(QUEUE_JOBS_DDL.includes("queue_jobs"));
});
test("QUEUE_JOBS_DDL defines all required columns", () => {
    const requiredColumns = [
        "id",
        "queue_name",
        "payload",
        "status",
        "priority",
        "attempts",
        "max_attempts",
        "last_error",
        "delay_until",
        "idempotency_key",
        "created_at",
        "updated_at",
        "completed_at",
    ];
    for (const col of requiredColumns) {
        assert.ok(QUEUE_JOBS_DDL.includes(col), `QUEUE_JOBS_DDL should include column: ${col}`);
    }
});
test("QUEUE_JOBS_DDL includes indexes", () => {
    assert.ok(QUEUE_JOBS_DDL.includes("CREATE INDEX"));
    assert.ok(QUEUE_JOBS_DDL.includes("idx_queue_jobs_queue_status_priority"));
});
test("QUEUE_JOBS_DDL includes unique index for idempotency", () => {
    assert.ok(QUEUE_JOBS_DDL.includes("idx_queue_jobs_idempotency"));
});
//# sourceMappingURL=queue-adapter.test.js.map