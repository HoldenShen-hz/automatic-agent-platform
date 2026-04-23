// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { AsyncExecutionRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/execution-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
test.skip("Async Repository Transactions", (group) => {
    let harness;
    group.beforeEach(() => {
        const workspace = createTempWorkspace("aa-async-txn-");
        const dbPath = join(workspace, "txn-test.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const adapter = new SqliteAsyncAdapter(db);
        harness = {
            workspace,
            dbPath,
            db,
            adapter,
            cleanup() {
                db.close();
                cleanupPath(workspace);
            },
        };
    });
    group.afterEach(() => {
        harness.cleanup();
    });
    test("transaction rolls back on error", async () => {
        const taskRepo = new AsyncTaskRepository(harness.adapter.asyncConnection);
        const task = {
            id: "txn-rollback-task",
            parentId: null,
            rootId: null,
            divisionId: "div-001",
            tenantId: "tenant-txn-rb",
            title: "Rollback Test",
            status: "queued",
            source: "test",
            priority: "medium",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: null,
            actualCostUsd: null,
            errorCode: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            completedAt: null,
        };
        await taskRepo.insertTask(task);
        // Execute a transaction that should fail midway
        try {
            await harness.adapter.transaction(async (conn) => {
                const execRepo = new AsyncExecutionRepository(conn);
                // Insert execution successfully
                const execution = {
                    id: "txn-rollback-exec",
                    taskId: "txn-rollback-task",
                    workflowId: "wf-txn",
                    parentExecutionId: null,
                    agentId: "agent-txn",
                    roleId: null,
                    runKind: "execute",
                    status: "pending",
                    inputRef: null,
                    traceId: null,
                    attempt: 1,
                    timeoutMs: 300000,
                    budgetUsdLimit: null,
                    requiresApproval: false,
                    sandboxMode: "standard",
                    allowedToolsJson: "[]",
                    allowedPathsJson: "[]",
                    maxRetries: 3,
                    retryBackoff: "exponential",
                    lastErrorCode: null,
                    lastErrorMessage: null,
                    startedAt: null,
                    finishedAt: null,
                    createdAt: "2026-04-23T10:00:00.000Z",
                    updatedAt: "2026-04-23T10:00:00.000Z",
                };
                await execRepo.insertExecution(execution);
                // Now insert with a duplicate ID to cause failure
                await execRepo.insertExecution(execution);
            });
            assert.fail("Expected transaction to fail");
        }
        catch {
            // Transaction should have rolled back
        }
        // Verify only the task exists (execution should have been rolled back)
        const retrieved = await taskRepo.getTask("txn-rollback-task");
        assert.equal(retrieved?.id, "txn-rollback-task");
        const execRepo = new AsyncExecutionRepository(harness.adapter.asyncConnection);
        const executions = await execRepo.listExecutionsByTask("txn-rollback-task");
        assert.equal(executions.length, 0, "Execution should have been rolled back");
    });
    test("transaction commits on success", async () => {
        const taskRepo = new AsyncTaskRepository(harness.adapter.asyncConnection);
        const task = {
            id: "txn-commit-task",
            parentId: null,
            rootId: null,
            divisionId: "div-001",
            tenantId: "tenant-txn-commit",
            title: "Commit Test",
            status: "queued",
            source: "test",
            priority: "medium",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: null,
            actualCostUsd: null,
            errorCode: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            completedAt: null,
        };
        await taskRepo.insertTask(task);
        const result = await harness.adapter.transaction(async (conn) => {
            const execRepo = new AsyncExecutionRepository(conn);
            const execution = {
                id: "txn-commit-exec",
                taskId: "txn-commit-task",
                workflowId: "wf-txn-commit",
                parentExecutionId: null,
                agentId: "agent-commit",
                roleId: null,
                runKind: "execute",
                status: "pending",
                inputRef: null,
                traceId: null,
                attempt: 1,
                timeoutMs: 300000,
                budgetUsdLimit: null,
                requiresApproval: false,
                sandboxMode: "standard",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 3,
                retryBackoff: "exponential",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: null,
                finishedAt: null,
                createdAt: "2026-04-23T10:00:00.000Z",
                updatedAt: "2026-04-23T10:00:00.000Z",
            };
            await execRepo.insertExecution(execution);
            return "success";
        });
        assert.equal(result, "success");
        const execRepo = new AsyncExecutionRepository(harness.adapter.asyncConnection);
        const executions = await execRepo.listExecutionsByTask("txn-commit-task");
        assert.equal(executions.length, 1);
        assert.equal(executions[0].id, "txn-commit-exec");
    });
    test("readTransaction for read-only operations", async () => {
        const taskRepo = new AsyncTaskRepository(harness.adapter.asyncConnection);
        const task = {
            id: "read-txn-task",
            parentId: null,
            rootId: null,
            divisionId: "div-001",
            tenantId: "tenant-read-txn",
            title: "Read Transaction Test",
            status: "queued",
            source: "test",
            priority: "medium",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: null,
            actualCostUsd: null,
            errorCode: null,
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            completedAt: null,
        };
        await taskRepo.insertTask(task);
        const result = await harness.adapter.readTransaction(async (conn) => {
            const readRepo = new AsyncTaskRepository(conn);
            const tasks = await readRepo.listTasks(10, "tenant-read-txn");
            return tasks.length;
        });
        assert.equal(result, 1);
    });
    test("multiple operations in single transaction", async () => {
        const taskRepo = new AsyncTaskRepository(harness.adapter.asyncConnection);
        const execRepo = new AsyncExecutionRepository(harness.adapter.asyncConnection);
        await harness.adapter.transaction(async (conn) => {
            const txnTaskRepo = new AsyncTaskRepository(conn);
            const txnExecRepo = new AsyncExecutionRepository(conn);
            // Insert multiple tasks in transaction
            for (let i = 0; i < 3; i++) {
                const task = {
                    id: `txn-multi-task-${i}`,
                    parentId: null,
                    rootId: null,
                    divisionId: "div-001",
                    tenantId: "tenant-multi",
                    title: `Multi Task ${i}`,
                    status: "queued",
                    source: "test",
                    priority: "medium",
                    inputJson: "{}",
                    normalizedInputJson: "{}",
                    outputJson: null,
                    estimatedCostUsd: null,
                    actualCostUsd: null,
                    errorCode: null,
                    createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
                    updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
                    completedAt: null,
                };
                await txnTaskRepo.insertTask(task);
            }
            // Insert execution linked to first task
            const execution = {
                id: "txn-multi-exec",
                taskId: "txn-multi-task-0",
                workflowId: "wf-multi",
                parentExecutionId: null,
                agentId: "agent-multi",
                roleId: null,
                runKind: "execute",
                status: "pending",
                inputRef: null,
                traceId: null,
                attempt: 1,
                timeoutMs: 300000,
                budgetUsdLimit: null,
                requiresApproval: false,
                sandboxMode: "standard",
                allowedToolsJson: "[]",
                allowedPathsJson: "[]",
                maxRetries: 3,
                retryBackoff: "exponential",
                lastErrorCode: null,
                lastErrorMessage: null,
                startedAt: null,
                finishedAt: null,
                createdAt: "2026-04-23T10:00:00.000Z",
                updatedAt: "2026-04-23T10:00:00.000Z",
            };
            await txnExecRepo.insertExecution(execution);
        });
        // Verify all data is committed
        const tasks = await taskRepo.listTasks(10, "tenant-multi");
        assert.equal(tasks.length, 3);
        const executions = await execRepo.listExecutionsByTask("txn-multi-task-0");
        assert.equal(executions.length, 1);
    });
});
//# sourceMappingURL=transaction.test.js.map