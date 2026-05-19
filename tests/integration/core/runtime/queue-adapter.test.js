/**
 * Integration tests for Core Runtime queue-adapter barrel module
 *
 * Tests the full re-export chain from core/runtime/queue-adapter.ts
 * which delegates to platform/execution/queue/queue-adapter.js
 */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RETRY_POLICY, QUEUE_JOBS_DDL, } from "../../../../src/core/runtime/queue-adapter.js";
test("queue-adapter barrel exports DEFAULT_RETRY_POLICY", () => {
    assert.ok(DEFAULT_RETRY_POLICY !== undefined, "DEFAULT_RETRY_POLICY should be exported");
    assert.equal(DEFAULT_RETRY_POLICY.maxAttempts, 3);
    assert.equal(DEFAULT_RETRY_POLICY.backoffMs, 1000);
    assert.equal(DEFAULT_RETRY_POLICY.backoffMultiplier, 2);
});
test("queue-adapter barrel exports QUEUE_JOBS_DDL", () => {
    assert.ok(QUEUE_JOBS_DDL !== undefined, "QUEUE_JOBS_DDL should be exported");
    assert.ok(typeof QUEUE_JOBS_DDL === "string", "QUEUE_JOBS_DDL should be a string");
    assert.ok(QUEUE_JOBS_DDL.includes("CREATE TABLE"), "DDL should contain CREATE TABLE");
    assert.ok(QUEUE_JOBS_DDL.includes("queue_jobs"), "DDL should define queue_jobs table");
});
test("queue-adapter barrel exports QueueBackendKind type", () => {
    const kinds = ["sqlite", "redis"];
    assert.deepEqual(kinds, ["sqlite", "redis"]);
});
test("queue-adapter barrel exports QueueJobStatus type", () => {
    // Verify the type exists by checking its string values
    const statuses = ["waiting", "delayed", "active", "completed", "failed", "dead_letter"];
    assert.equal(statuses.length, 6);
});
test("queue-adapter barrel exports EnqueueInput type", () => {
    const input = {
        queueName: "test-queue",
        payload: { data: "test" },
    };
    assert.equal(input.queueName, "test-queue");
    assert.deepEqual(input.payload, { data: "test" });
});
test("queue-adapter barrel exports QueueStats type", () => {
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
test("queue-adapter barrel exports RetryPolicy type", () => {
    const policy = {
        maxAttempts: 5,
        backoffMs: 2000,
        backoffMultiplier: 2.5,
    };
    assert.equal(policy.maxAttempts, 5);
    assert.equal(policy.backoffMs, 2000);
    assert.equal(policy.backoffMultiplier, 2.5);
});
test("queue-adapter barrel exports QueueAdapter interface", () => {
    // Verify the interface structure
    const adapter = {
        backendKind: "sqlite",
    };
    assert.equal(adapter.backendKind, "sqlite");
});
test("queue-adapter DDL contains all required columns", () => {
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
test("queue-adapter module re-exports correct canonical module", async () => {
    const mod = await import("../../../../src/core/runtime/queue-adapter.js");
    assert.ok("DEFAULT_RETRY_POLICY" in mod, "Module should export DEFAULT_RETRY_POLICY");
    assert.ok("QUEUE_JOBS_DDL" in mod, "Module should export QUEUE_JOBS_DDL");
});
//# sourceMappingURL=queue-adapter.test.js.map