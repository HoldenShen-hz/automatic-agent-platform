/**
 * E2E Task Lifecycle Tests
 *
 * End-to-end tests covering the full task lifecycle from creation through
 * completion, including dispatch, execution, and approval flows.
 *
 * These tests use an in-process database and real service bootstrap,
 * verifying the complete integration path.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
function makeTaskCommand(taskId, fromStatus, toStatus, traceId, executionId = null) {
    return {
        entityKind: "task",
        entityId: taskId,
        fromStatus,
        toStatus,
        executionId,
        reasonCode: "e2e_test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
    };
}
function makeExecCommand(executionId, fromStatus, toStatus, traceId) {
    return {
        entityKind: "execution",
        entityId: executionId,
        fromStatus,
        toStatus,
        reasonCode: "e2e_test",
        traceId,
        actorType: "agent",
        occurredAt: nowIso(),
    };
}
function createE2eHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "e2e.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    return { workspace, db, store };
}
function insertExecutionOnly(db, store, taskId, executionId, traceId) {
    const now = nowIso();
    db.transaction(() => {
        store.insertExecution({
            id: executionId,
            taskId,
            workflowId: "single_agent_minimal",
            parentExecutionId: null,
            agentId: "agent-1",
            roleId: "general_executor",
            runKind: "task_run",
            status: "executing",
            inputRef: null,
            traceId,
            attempt: 1,
            timeoutMs: 1000,
            budgetUsdLimit: 1,
            requiresApproval: 0,
            sandboxMode: "workspace_write",
            allowedToolsJson: "[]",
            allowedPathsJson: "[]",
            maxRetries: 0,
            retryBackoff: "none",
            lastErrorCode: null,
            lastErrorMessage: null,
            startedAt: now,
            finishedAt: null,
            createdAt: now,
            updatedAt: now,
        });
    });
}
test("E2E: task lifecycle — queued → pending → in_progress → done", () => {
    const h = createE2eHarness("e2e-task-lifecycle-");
    const ts = new TransitionService(h.db, h.store);
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const now = nowIso();
        // Seed task in queued state
        h.db.transaction(() => {
            h.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "E2E test task",
                status: "queued",
                source: "user",
                priority: "normal",
                inputJson: JSON.stringify({ request: "hello world" }),
                normalizedInputJson: JSON.stringify({ request: "hello world" }),
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        // Transition: queued → pending
        ts.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", "e2e-trace-1", null));
        const task1 = h.store.getTask(taskId);
        assert.equal(task1?.status, "pending");
        // Insert execution directly (task remains pending until transition)
        insertExecutionOnly(h.db, h.store, taskId, executionId, "e2e-trace-2");
        // Transition task: pending → in_progress
        ts.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", "e2e-trace-2", executionId));
        // Transition execution: executing → succeeded
        ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", "e2e-trace-3"));
        const exec = h.store.getExecution(executionId);
        assert.equal(exec?.status, "succeeded");
        // Transition task to done via terminal state transition
        ts.transitionTaskTerminalState({
            taskId,
            sessionId: newId("sess"),
            executionId,
            currentTaskStatus: "in_progress",
            currentWorkflowStatus: "running",
            currentSessionStatus: "open",
            currentExecutionStatus: "succeeded",
            terminalStatus: "done",
            taskOutputJson: JSON.stringify({ result: "success" }),
            outputsJson: "[]",
            context: {
                reasonCode: "e2e_test",
                traceId: "e2e-trace-4",
                actorType: "system",
                occurredAt: nowIso(),
            },
        });
        const finalTask = h.store.getTask(taskId);
        assert.equal(finalTask?.status, "done");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: task lifecycle — queued → pending → in_progress → failed", () => {
    const h = createE2eHarness("e2e-task-failed-");
    const ts = new TransitionService(h.db, h.store);
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const now = nowIso();
        h.db.transaction(() => {
            h.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "E2E failing task",
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
        // queued → pending
        ts.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", "e2e-fail-trace-1", null));
        // Insert execution
        insertExecutionOnly(h.db, h.store, taskId, executionId, "e2e-fail-trace-2");
        // pending → in_progress
        ts.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", "e2e-fail-trace-2", executionId));
        // in_progress → failed
        ts.transitionTaskTerminalState({
            taskId,
            sessionId: newId("sess"),
            executionId,
            currentTaskStatus: "in_progress",
            currentWorkflowStatus: "running",
            currentSessionStatus: "open",
            currentExecutionStatus: "executing",
            terminalStatus: "failed",
            taskOutputJson: "{}",
            outputsJson: "[]",
            context: {
                reasonCode: "e2e.test_failure",
                traceId: "e2e-fail-trace-3",
                actorType: "system",
                occurredAt: nowIso(),
            },
        });
        const task = h.store.getTask(taskId);
        assert.equal(task?.status, "failed");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: task lifecycle — execution blocked → resumes", () => {
    const h = createE2eHarness("e2e-task-approval-");
    const ts = new TransitionService(h.db, h.store);
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const now = nowIso();
        h.db.transaction(() => {
            h.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "E2E approval task",
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
        // queued → pending
        ts.transitionTaskStatus(makeTaskCommand(taskId, "queued", "pending", "e2e-appr-1", null));
        // Insert execution
        insertExecutionOnly(h.db, h.store, taskId, executionId, "e2e-appr-2");
        // pending → in_progress
        ts.transitionTaskStatus(makeTaskCommand(taskId, "pending", "in_progress", "e2e-appr-2", executionId));
        // executing → blocked
        ts.transitionExecutionStatus(makeExecCommand(executionId, "executing", "blocked", "e2e-appr-3"));
        const blockedExec = h.store.getExecution(executionId);
        assert.equal(blockedExec?.status, "blocked");
        // blocked → executing (resumed)
        ts.transitionExecutionStatus(makeExecCommand(executionId, "blocked", "executing", "e2e-appr-4"));
        const resumedExec = h.store.getExecution(executionId);
        assert.equal(resumedExec?.status, "executing");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: task lifecycle — cancelled task cannot transition", () => {
    const h = createE2eHarness("e2e-task-cancelled-");
    const ts = new TransitionService(h.db, h.store);
    try {
        const taskId = newId("task");
        const now = nowIso();
        h.db.transaction(() => {
            h.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "E2E cancel test",
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
        // Cancel the task
        ts.transitionTaskStatus({
            entityKind: "task",
            entityId: taskId,
            fromStatus: "queued",
            toStatus: "cancelled",
            executionId: null,
            reasonCode: "e2e_cancel",
            traceId: "e2e-cancel-1",
            actorType: "user",
            occurredAt: now,
        });
        const task = h.store.getTask(taskId);
        assert.equal(task?.status, "cancelled");
        // Attempt to transition cancelled task — should throw
        assert.throws(() => {
            ts.transitionTaskStatus(makeTaskCommand(taskId, "cancelled", "pending", "e2e-cancel-2", null));
        }, /invalid transition/i);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=task-lifecycle.test.js.map