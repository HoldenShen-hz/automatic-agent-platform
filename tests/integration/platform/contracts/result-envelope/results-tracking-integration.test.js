/**
 * Integration Test: Results Tracking
 *
 * Verifies result record persistence and retrieval
 * for task execution results.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("results tracking: task result can be stored and retrieved", () => {
    const workspace = createTempWorkspace("aa-results-");
    try {
        const dbPath = join(workspace, "results.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskId = newId("task");
        const now = nowIso();
        // Create task
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Results tracking test",
                status: "done",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: JSON.stringify({ result: "success", data: { key: "value" } }),
                estimatedCostUsd: 0.05,
                actualCostUsd: 0.03,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: now,
            });
        });
        // Retrieve task with result
        const task = store.getTask(taskId);
        assert.ok(task, "Task should exist");
        assert.equal(task.status, "done");
        assert.ok(task.outputJson, "Task should have output");
        const output = JSON.parse(task.outputJson);
        assert.equal(output.result, "success", "Output should contain result");
        assert.deepEqual(output.data, { key: "value" }, "Output data should match");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("results tracking: task cost tracking is accurate", () => {
    const workspace = createTempWorkspace("aa-cost-tracking-");
    try {
        const dbPath = join(workspace, "cost-tracking.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskId = newId("task");
        const now = nowIso();
        // Create task with estimated cost
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Cost tracking test",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0.10,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        // Update with actual cost
        db.connection
            .prepare(`UPDATE tasks SET actual_cost_usd = ?, updated_at = ? WHERE id = ?`)
            .run(0.075, nowIso(), taskId);
        const task = store.getTask(taskId);
        assert.ok(task, "Task should exist");
        assert.equal(task.estimatedCostUsd, 0.10, "Estimated cost should be 0.10");
        assert.equal(task.actualCostUsd, 0.075, "Actual cost should be 0.075");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("results tracking: failed task records error code", () => {
    const workspace = createTempWorkspace("aa-failed-task-");
    try {
        const dbPath = join(workspace, "failed-task.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskId = newId("task");
        const now = nowIso();
        // Create failed task
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Failed task test",
                status: "failed",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: "task.execution_failed",
                createdAt: now,
                updatedAt: now,
                completedAt: now,
            });
        });
        const task = store.getTask(taskId);
        assert.ok(task, "Task should exist");
        assert.equal(task.status, "failed", "Task status should be failed");
        assert.equal(task.errorCode, "task.execution_failed", "Error code should be recorded");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("results tracking: cancelled task is properly recorded", () => {
    const workspace = createTempWorkspace("aa-cancelled-task-");
    try {
        const dbPath = join(workspace, "cancelled-task.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const taskId = newId("task");
        const now = nowIso();
        // Create cancelled task
        db.transaction(() => {
            store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Cancelled task test",
                status: "cancelled",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: "task.cancelled_by_user",
                createdAt: now,
                updatedAt: now,
                completedAt: now,
            });
        });
        const task = store.getTask(taskId);
        assert.ok(task, "Task should exist");
        assert.equal(task.status, "cancelled", "Task status should be cancelled");
        assert.equal(task.errorCode, "task.cancelled_by_user", "Cancellation reason should be recorded");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=results-tracking-integration.test.js.map