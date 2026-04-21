import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("sqlite database nested transactions roll back only the inner savepoint", () => {
    const workspace = createTempWorkspace("aa-sqlite-db-");
    const dbPath = join(workspace, "nested-transaction.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const now = nowIso();
        db.transaction(() => {
            store.insertTask({
                id: "task-outer",
                parentId: null,
                rootId: "task-outer",
                divisionId: "general_ops",
                title: "outer task",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            assert.throws(() => {
                db.transaction(() => {
                    store.insertTask({
                        id: "task-inner",
                        parentId: null,
                        rootId: "task-inner",
                        divisionId: "general_ops",
                        title: "inner task",
                        status: "queued",
                        source: "user",
                        priority: "normal",
                        inputJson: "{}",
                        normalizedInputJson: "{}",
                        outputJson: null,
                        estimatedCostUsd: 0,
                        actualCostUsd: 0,
                        errorCode: null,
                        createdAt: now,
                        updatedAt: now,
                        completedAt: null,
                    });
                    throw new Error("inner rollback");
                });
            }, /inner rollback/);
            store.insertTask({
                id: "task-after",
                parentId: null,
                rootId: "task-after",
                divisionId: "general_ops",
                title: "task after inner rollback",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        assert.equal(store.getTask("task-outer")?.title, "outer task");
        assert.equal(store.getTask("task-inner"), null);
        assert.equal(store.getTask("task-after")?.title, "task after inner rollback");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("sqlite database read transactions keep an authoritative snapshot during concurrent writes", () => {
    const workspace = createTempWorkspace("aa-sqlite-db-");
    const dbPath = join(workspace, "read-transaction.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const writerDb = new SqliteDatabase(dbPath);
        writerDb.migrate();
        const writerStore = new AuthoritativeTaskStore(writerDb);
        const createdAt = "2026-04-07T10:00:00.000Z";
        db.transaction(() => {
            store.insertTask({
                id: "task-read-snapshot",
                parentId: null,
                rootId: "task-read-snapshot",
                divisionId: "general_ops",
                title: "read snapshot task",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt,
                updatedAt: createdAt,
                completedAt: null,
            });
            store.insertWorkflowState({
                taskId: "task-read-snapshot",
                divisionId: "general_ops",
                workflowId: "single_agent_minimal",
                currentStepIndex: 0,
                status: "running",
                outputsJson: "{}",
                lastErrorCode: null,
                retryCount: 0,
                resumableFromStep: null,
                startedAt: createdAt,
                updatedAt: createdAt,
            });
        });
        const observed = db.readTransaction(() => {
            assert.equal(store.getTask("task-read-snapshot")?.status, "in_progress");
            writerDb.transaction(() => {
                writerStore.updateTaskStatus("task-read-snapshot", "done", "2026-04-07T10:01:00.000Z", null, "2026-04-07T10:01:00.000Z");
                writerStore.updateWorkflowState("task-read-snapshot", "completed", 1, JSON.stringify({ final: true }), "2026-04-07T10:01:00.000Z");
            });
            return {
                taskStatus: store.getTask("task-read-snapshot")?.status ?? null,
                workflowStatus: store.getWorkflowState("task-read-snapshot")?.status ?? null,
            };
        });
        assert.equal(observed.taskStatus, "in_progress");
        assert.equal(observed.workflowStatus, "running");
        assert.equal(store.getTask("task-read-snapshot")?.status, "done");
        assert.equal(store.getWorkflowState("task-read-snapshot")?.status, "completed");
        writerDb.close();
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("sqlite database fail-closes competing root write transactions with a stable contention error", () => {
    const workspace = createTempWorkspace("aa-sqlite-db-");
    const dbPath = join(workspace, "write-contention.db");
    try {
        const primaryDb = new SqliteDatabase(dbPath, { busyTimeoutMs: 50 });
        primaryDb.migrate();
        const primaryStore = new AuthoritativeTaskStore(primaryDb);
        const contenderDb = new SqliteDatabase(dbPath, { busyTimeoutMs: 1 });
        contenderDb.migrate();
        const contenderStore = new AuthoritativeTaskStore(contenderDb);
        const now = nowIso();
        primaryDb.transaction(() => {
            primaryStore.insertTask({
                id: "task-primary-writer",
                parentId: null,
                rootId: "task-primary-writer",
                divisionId: "general_ops",
                title: "primary writer task",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            let contentionError = null;
            try {
                contenderDb.transaction(() => {
                    contenderStore.insertTask({
                        id: "task-contender-writer",
                        parentId: null,
                        rootId: "task-contender-writer",
                        divisionId: "general_ops",
                        title: "contender writer task",
                        status: "queued",
                        source: "user",
                        priority: "normal",
                        inputJson: "{}",
                        normalizedInputJson: "{}",
                        outputJson: null,
                        estimatedCostUsd: 0,
                        actualCostUsd: 0,
                        errorCode: null,
                        createdAt: now,
                        updatedAt: now,
                        completedAt: null,
                    });
                });
            }
            catch (error) {
                contentionError = error;
            }
            assert.match(contentionError instanceof Error ? contentionError.message : String(contentionError), /sqlite\.write_contention:/);
            assert.equal(contentionError instanceof Error ? contentionError.name : null, "SqliteWriteContentionError");
            assert.equal(contentionError != null && typeof contentionError === "object" && "code" in contentionError
                ? String(contentionError.code)
                : null, "sqlite.write_contention");
            assert.equal(contenderStore.getTask("task-contender-writer"), null);
        });
        contenderDb.transaction(() => {
            contenderStore.insertTask({
                id: "task-contender-writer",
                parentId: null,
                rootId: "task-contender-writer",
                divisionId: "general_ops",
                title: "contender writer task",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        assert.equal(primaryStore.getTask("task-primary-writer")?.title, "primary writer task");
        assert.equal(contenderStore.getTask("task-contender-writer")?.title, "contender writer task");
        contenderDb.close();
        primaryDb.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=sqlite-database.test.js.map