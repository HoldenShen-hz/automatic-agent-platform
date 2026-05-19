/**
 * Concurrency Tests: SqliteQueueAdapter Race Conditions
 *
 * Tests concurrent access patterns in the SQLite queue adapter.
 * Uses node:test and the concurrent-runner helper.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { SqliteQueueAdapter, QUEUE_JOBS_DDL } from "../../../../src/platform/execution/queue/queue-adapter.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { runConcurrentInvariant } from "../../../helpers/concurrent-runner.js";
function createQueueContext(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = `${workspace}/queue-concurrent.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.exec(QUEUE_JOBS_DDL);
    return { workspace, db };
}
// =============================================================================
// Concurrent Dequeue Tests - Race Condition Detection
// =============================================================================
test("concurrent dequeue: multiple workers racing for same job", async () => {
    const ctx = createQueueContext("aa-queue-race-");
    try {
        const queueAdapter = new SqliteQueueAdapter(ctx.db);
        // Enqueue a single job
        queueAdapter.enqueue({
            queueName: "race-test",
            payload: { workerId: null, task: "single_job" },
        });
        // Race 10 concurrent workers trying to dequeue
        const result = await runConcurrentInvariant(async (_workerId) => {
            const dequeued = [];
            const result = queueAdapter.dequeue("race-test");
            if (result) {
                dequeued.push(result.job.id);
                result.ack();
            }
            return dequeued;
        }, { concurrency: 10 });
        // Exactly ONE worker should get the job
        const totalDequed = result.values.reduce((sum, ids) => sum + ids.length, 0);
        assert.equal(totalDequed, 1, `Expected exactly 1 dequeue, got ${totalDequed}`);
        assert.equal(result.errors.length, 0, "No errors should occur");
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("concurrent dequeue: multiple jobs distributed across workers", async () => {
    const ctx = createQueueContext("aa-queue-multi-");
    try {
        const queueAdapter = new SqliteQueueAdapter(ctx.db);
        // Enqueue 5 jobs
        const jobCount = 5;
        for (let i = 0; i < jobCount; i++) {
            queueAdapter.enqueue({
                queueName: "multi-job",
                payload: { index: i, task: `job_${i}` },
            });
        }
        // Race 10 concurrent workers trying to dequeue
        const result = await runConcurrentInvariant(async (_workerId) => {
            const dequeued = [];
            const r = queueAdapter.dequeue("multi-job");
            if (r) {
                dequeued.push(r.job.id);
                r.ack();
            }
            return dequeued;
        }, { concurrency: 10 });
        // All 5 jobs should be dequeued exactly once
        const totalDequed = result.values.reduce((sum, ids) => sum + ids.length, 0);
        assert.equal(totalDequed, jobCount, `Expected ${jobCount} dequeues, got ${totalDequed}`);
        // Check no duplicate job IDs
        const allIds = result.values.flat();
        const uniqueIds = new Set(allIds);
        assert.equal(uniqueIds.size, jobCount, "All job IDs should be unique");
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("concurrent dequeue: no two workers get same job (invariant)", async () => {
    const ctx = createQueueContext("aa-queue-invariant-");
    try {
        const queueAdapter = new SqliteQueueAdapter(ctx.db);
        // Enqueue 3 jobs
        const jobCount = 3;
        for (let i = 0; i < jobCount; i++) {
            queueAdapter.enqueue({
                queueName: "invariant-test",
                payload: { index: i },
            });
        }
        // 10 workers compete for 3 jobs
        const result = await runConcurrentInvariant(async (_workerId) => {
            const r = queueAdapter.dequeue("invariant-test");
            if (r) {
                const payload = JSON.parse(r.job.payload);
                r.ack();
                return payload.index;
            }
            return null;
        }, { concurrency: 10 });
        // Collect all returned job indices
        const receivedJobs = result.values.filter((v) => v !== null);
        // Invariant: no duplicate indices
        const uniqueJobs = new Set(receivedJobs);
        assert.equal(uniqueJobs.size, receivedJobs.length, "No job should be received twice");
        // We should have received exactly 3 jobs
        assert.equal(receivedJobs.length, jobCount, `Expected ${jobCount} jobs, got ${receivedJobs.length}`);
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("concurrent dequeue: high contention with many jobs", async () => {
    const ctx = createQueueContext("aa-queue-contention-");
    try {
        const queueAdapter = new SqliteQueueAdapter(ctx.db);
        // Enqueue 20 jobs
        const jobCount = 20;
        for (let i = 0; i < jobCount; i++) {
            queueAdapter.enqueue({
                queueName: "contention",
                payload: { index: i },
            });
        }
        // 20 workers racing
        const result = await runConcurrentInvariant(async (_workerId) => {
            const r = queueAdapter.dequeue("contention");
            if (r) {
                const idx = JSON.parse(r.job.payload).index;
                r.ack();
                return idx;
            }
            return null;
        }, { concurrency: 20 });
        const receivedJobs = result.values.filter((v) => v !== null);
        const uniqueJobs = new Set(receivedJobs);
        assert.equal(receivedJobs.length, jobCount, "All jobs should be dequeued");
        assert.equal(uniqueJobs.size, jobCount, "No duplicate jobs");
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("concurrent enqueue: multiple threads adding jobs simultaneously", async () => {
    const ctx = createQueueContext("aa-queue-enqueue-");
    try {
        const queueAdapter = new SqliteQueueAdapter(ctx.db);
        const result = await runConcurrentInvariant(async (workerId) => {
            queueAdapter.enqueue({
                queueName: "enqueue-test",
                payload: { workerId, timestamp: Date.now() },
            });
            return workerId;
        }, { concurrency: 15 });
        assert.equal(result.errors.length, 0, "No errors during concurrent enqueue");
        assert.equal(result.values.length, 15, "All 15 enqueues should complete");
        const stats = queueAdapter.stats("enqueue-test");
        assert.equal(stats.waiting, 15, "All 15 jobs should be in waiting state");
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("concurrent ack: same job cannot be acked twice", async () => {
    const ctx = createQueueContext("aa-queue-double-ack-");
    try {
        const queueAdapter = new SqliteQueueAdapter(ctx.db);
        queueAdapter.enqueue({
            queueName: "ack-test",
            payload: { task: "ack_race" },
        });
        const dequeueResult = queueAdapter.dequeue("ack-test");
        assert.ok(dequeueResult, "Should get a job");
        // Simulate concurrent ack calls (should not happen in practice but tests robustness)
        const ackResult = await runConcurrentInvariant(async (_workerId) => {
            try {
                dequeueResult.ack();
                return "acked";
            }
            catch {
                return "failed";
            }
        }, { concurrency: 5 });
        // At least one ack should succeed
        const acked = ackResult.values.filter((v) => v === "acked").length;
        assert.ok(acked >= 1, "At least one ack should succeed");
        const stats = queueAdapter.stats("ack-test");
        assert.equal(stats.completed, 1, "Job should be marked completed");
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
//# sourceMappingURL=queue-adapter-concurrent.test.js.map