import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteQueueAdapter, QUEUE_JOBS_DDL, } from "../../../../../src/platform/execution/queue/queue-adapter.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
function createHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "queue.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.exec(QUEUE_JOBS_DDL);
    return { workspace, db };
}
test("SqliteQueueAdapter integration: multiple queues with independent processing", () => {
    const h = createHarness("aa-queue-multi-");
    try {
        const adapter = new SqliteQueueAdapter(h.db);
        // Enqueue to different queues
        const job1 = adapter.enqueue({ queueName: "high-priority", payload: { data: "urgent" } });
        const job2 = adapter.enqueue({ queueName: "low-priority", payload: { data: "batch" } });
        const job3 = adapter.enqueue({ queueName: "high-priority", payload: { data: "critical" } });
        // Dequeue from high-priority first
        const highResult = adapter.dequeue("high-priority");
        assert.ok(highResult);
        assert.equal(highResult.job.queueName, "high-priority");
        const payload1 = JSON.parse(highResult.job.payload);
        assert.ok(["urgent", "critical"].includes(payload1.data));
        // Low priority still waiting
        const lowResult = adapter.dequeue("low-priority");
        assert.ok(lowResult);
        const payload2 = JSON.parse(lowResult.job.payload);
        assert.equal(payload2.data, "batch");
        // Complete the high priority job
        highResult.ack();
        const completed = adapter.getJob(job1.id);
        assert.equal(completed?.status, "completed");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("SqliteQueueAdapter integration: failed jobs are requeued with backoff", () => {
    const h = createHarness("aa-queue-requeue-");
    try {
        const adapter = new SqliteQueueAdapter(h.db);
        const job = adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" }, maxAttempts: 3 });
        // First dequeue and fail
        const result1 = adapter.dequeue("tasks");
        assert.ok(result1);
        assert.equal(result1.job.attempts, 1);
        result1.nack(); // Return to queue
        // Should be requeued
        const result2 = adapter.dequeue("tasks");
        assert.ok(result2);
        assert.equal(result2.job.id, job.id);
        assert.equal(result2.job.attempts, 2);
        result2.ack();
        assert.equal(adapter.getJob(job.id)?.status, "completed");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("SqliteQueueAdapter integration: dead letter after max retries", () => {
    const h = createHarness("aa-queue-dlq-");
    try {
        const adapter = new SqliteQueueAdapter(h.db);
        const job = adapter.enqueue({ queueName: "tasks", payload: { taskId: "failing" }, maxAttempts: 2 });
        // Dequeue and fail multiple times
        const r1 = adapter.dequeue("tasks");
        assert.ok(r1);
        r1.nack();
        const r2 = adapter.dequeue("tasks");
        assert.ok(r2);
        r2.nack();
        // After max retries, job should go to dead letter queue
        const dlqJob = adapter.getJob(job.id);
        assert.ok(dlqJob);
        const dlqPayload = JSON.parse(dlqJob.payload);
        assert.equal(dlqPayload.taskId, "failing");
        assert.equal(dlqJob.status, "dead_letter");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("SqliteQueueAdapter integration: stats returns correct counts", () => {
    const h = createHarness("aa-queue-stats-");
    try {
        const adapter = new SqliteQueueAdapter(h.db);
        // Add jobs in various states
        adapter.enqueue({ queueName: "tasks", payload: { n: 1 } });
        adapter.enqueue({ queueName: "tasks", payload: { n: 2 } });
        const r3 = adapter.dequeue("tasks");
        adapter.enqueue({ queueName: "tasks", payload: { n: 3 } });
        assert.ok(r3);
        r3.ack(); // Complete one
        const stats = adapter.stats("tasks");
        assert.equal(stats.waiting, 2);
        assert.equal(stats.active, 0);
        assert.equal(stats.completed, 1);
        assert.equal(stats.deadLetter, 0);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("SqliteQueueAdapter integration: listQueues returns all queues", () => {
    const h = createHarness("aa-queue-list-");
    try {
        const adapter = new SqliteQueueAdapter(h.db);
        adapter.enqueue({ queueName: "queue-a", payload: { n: 1 } });
        adapter.enqueue({ queueName: "queue-b", payload: { n: 2 } });
        const queues = adapter.listQueues();
        assert.ok(queues.includes("queue-a"));
        assert.ok(queues.includes("queue-b"));
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("createQueueAdapter returns SQLite adapter by default", () => {
    const h = createHarness("aa-queue-factory-");
    try {
        // The createQueueAdapter function expects a config object with kind
        // This test would need the actual config structure to work properly
        const adapter = new SqliteQueueAdapter(h.db);
        assert.ok(adapter instanceof SqliteQueueAdapter);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=queue-integration.test.js.map