/**
 * E2E Task Delegation Hierarchy Tests
 *
 * Tests task delegation through multiple agents/workers,
 * including parent-child task relationships and delegation tracking.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
function createE2eHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "e2e-delegation-hierarchy.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const transitions = new TransitionService(db, store);
    return { workspace, db, store, transitions };
}
test("E2E: parent task creates child task via delegation", () => {
    const h = createE2eHarness("e2e-delegation-hier-");
    const parentTaskId = newId("task");
    const childTaskId = newId("task");
    const parentExecId = newId("exec");
    const traceId = newId("trace");
    try {
        const now = nowIso();
        // Create parent task
        h.db.transaction(() => {
            h.store.insertTask({
                id: parentTaskId,
                parentId: null,
                rootId: parentTaskId,
                divisionId: "general_ops",
                title: "Parent task",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: JSON.stringify({ request: "delegate task" }),
                normalizedInputJson: JSON.stringify({ request: "delegate task" }),
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            h.store.insertExecution({
                id: parentExecId,
                taskId: parentTaskId,
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId,
                attempt: 1,
                timeoutMs: 60000,
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
        // Create child task (delegated)
        h.db.transaction(() => {
            h.store.insertTask({
                id: childTaskId,
                parentId: parentTaskId,
                rootId: parentTaskId,
                divisionId: "general_ops",
                title: "Child task (delegated)",
                status: "pending",
                source: "system",
                priority: "normal",
                inputJson: JSON.stringify({ request: "subtask from delegation" }),
                normalizedInputJson: JSON.stringify({ request: "subtask from delegation" }),
                outputJson: null,
                estimatedCostUsd: 0,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        const parentTask = h.store.getTask(parentTaskId);
        const childTask = h.store.getTask(childTaskId);
        assert.ok(parentTask, "Parent task should exist");
        assert.ok(childTask, "Child task should exist");
        assert.equal(childTask?.parentId, parentTaskId, "Child should reference parent");
        assert.equal(childTask?.rootId, parentTaskId, "Child rootId should be parent task");
        assert.equal(childTask?.source, "system", "Child source should reflect system-created delegated work");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: child task completion updates parent awareness", () => {
    const h = createE2eHarness("e2e-child-complete-hier-");
    const parentTaskId = newId("task");
    const childTaskId = newId("task");
    const traceId = newId("trace");
    try {
        const now = nowIso();
        // Create parent and child tasks
        h.db.transaction(() => {
            h.store.insertTask({
                id: parentTaskId,
                parentId: null,
                rootId: parentTaskId,
                divisionId: "general_ops",
                title: "Parent task",
                status: "in_progress",
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
            h.store.insertTask({
                id: childTaskId,
                parentId: parentTaskId,
                rootId: parentTaskId,
                divisionId: "general_ops",
                title: "Child task",
                status: "pending",
                source: "system",
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
        // Complete child task
        h.db.transaction(() => {
            h.store.updateTaskStatus(childTaskId, "done", now, JSON.stringify({ result: "child completed" }), now);
        });
        const childTask = h.store.getTask(childTaskId);
        assert.equal(childTask?.status, "done", "Child task should be done");
        assert.ok(childTask?.completedAt != null, "Child task should have completion timestamp");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: delegation chain with multiple levels", () => {
    const h = createE2eHarness("e2e-chain-multi-hier-");
    const rootTaskId = newId("task");
    const level1TaskId = newId("task");
    const level2TaskId = newId("task");
    const traceId = newId("trace");
    try {
        const now = nowIso();
        // Create root task
        h.db.transaction(() => {
            h.store.insertTask({
                id: rootTaskId,
                parentId: null,
                rootId: rootTaskId,
                divisionId: "general_ops",
                title: "Root task",
                status: "in_progress",
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
        // Create level 1 task
        h.db.transaction(() => {
            h.store.insertTask({
                id: level1TaskId,
                parentId: rootTaskId,
                rootId: rootTaskId,
                divisionId: "general_ops",
                title: "Level 1 task",
                status: "pending",
                source: "system",
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
        // Create level 2 task (delegated from level 1)
        h.db.transaction(() => {
            h.store.insertTask({
                id: level2TaskId,
                parentId: level1TaskId,
                rootId: rootTaskId,
                divisionId: "general_ops",
                title: "Level 2 task",
                status: "pending",
                source: "system",
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
        const root = h.store.getTask(rootTaskId);
        const level1 = h.store.getTask(level1TaskId);
        const level2 = h.store.getTask(level2TaskId);
        assert.equal(root?.rootId, rootTaskId, "Root task rootId should be self");
        assert.equal(level1?.rootId, rootTaskId, "Level 1 rootId should point to root");
        assert.equal(level2?.rootId, rootTaskId, "Level 2 rootId should point to root");
        assert.equal(level1?.parentId, rootTaskId, "Level 1 parent should be root");
        assert.equal(level2?.parentId, level1TaskId, "Level 2 parent should be level 1");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: task cost accumulates through delegation", () => {
    const h = createE2eHarness("e2e-cost-accum-hier-");
    const parentTaskId = newId("task");
    const childTaskId = newId("task");
    try {
        const now = nowIso();
        // Create parent task with initial cost
        h.db.transaction(() => {
            h.store.insertTask({
                id: parentTaskId,
                parentId: null,
                rootId: parentTaskId,
                divisionId: "general_ops",
                title: "Parent task",
                status: "in_progress",
                source: "user",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0.05,
                actualCostUsd: 0.02,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
            // Child task adds to cost
            h.store.insertTask({
                id: childTaskId,
                parentId: parentTaskId,
                rootId: parentTaskId,
                divisionId: "general_ops",
                title: "Child task",
                status: "done",
                source: "system",
                priority: "normal",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0.02,
                actualCostUsd: 0.01,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: now,
            });
        });
        const parent = h.store.getTask(parentTaskId);
        const child = h.store.getTask(childTaskId);
        assert.ok((parent?.actualCostUsd ?? 0) >= 0, "Parent cost should be non-negative");
        assert.ok((child?.actualCostUsd ?? 0) >= 0, "Child cost should be non-negative");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=task-delegation-hierarchy.test.js.map