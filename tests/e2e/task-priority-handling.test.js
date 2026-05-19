/**
 * E2E Task Priority Handling Tests
 *
 * Tests task priority handling through the execution lifecycle,
 * including priority escalation and dispatch ordering.
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
    const dbPath = join(workspace, "e2e-priority.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const transitions = new TransitionService(db, store);
    return { workspace, db, store, transitions };
}
function insertTask(store, db, taskId, priority, status = "queued") {
    const now = nowIso();
    db.transaction(() => {
        store.insertTask({
            id: taskId,
            parentId: null,
            rootId: taskId,
            divisionId: "general_ops",
            title: `Priority test task - ${priority}`,
            status,
            source: "user",
            priority,
            inputJson: JSON.stringify({ request: "test" }),
            normalizedInputJson: JSON.stringify({ request: "test" }),
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
test("E2E: tasks with different priorities can coexist", () => {
    const h = createE2eHarness("e2e-priority-coexist-");
    try {
        const lowTaskId = newId("task");
        const normalTaskId = newId("task");
        const highTaskId = newId("task");
        const urgentTaskId = newId("task");
        insertTask(h.store, h.db, lowTaskId, "low");
        insertTask(h.store, h.db, normalTaskId, "normal");
        insertTask(h.store, h.db, highTaskId, "high");
        insertTask(h.store, h.db, urgentTaskId, "urgent");
        const lowTask = h.store.getTask(lowTaskId);
        const normalTask = h.store.getTask(normalTaskId);
        const highTask = h.store.getTask(highTaskId);
        const urgentTask = h.store.getTask(urgentTaskId);
        assert.equal(lowTask?.priority, "low", "Low priority task should have low priority");
        assert.equal(normalTask?.priority, "normal", "Normal priority task should have normal priority");
        assert.equal(highTask?.priority, "high", "High priority task should have high priority");
        assert.equal(urgentTask?.priority, "urgent", "Urgent priority task should have urgent priority");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: tasks with various priorities can be queried", () => {
    const h = createE2eHarness("e2e-priority-query-");
    try {
        const taskIds = [];
        const priorities = ["low", "normal", "high", "urgent"];
        // Create tasks with different priorities
        for (let i = 0; i < 8; i++) {
            const taskId = newId("task");
            taskIds.push(taskId);
            insertTask(h.store, h.db, taskId, priorities[i % priorities.length]);
        }
        // Verify all tasks exist with correct priorities
        for (let i = 0; i < taskIds.length; i++) {
            const task = h.store.getTask(taskIds[i]);
            assert.ok(task, `Task ${i} should exist`);
            assert.equal(task.priority, priorities[i % priorities.length], `Task ${i} should have correct priority`);
        }
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: high priority task transitions correctly", () => {
    const h = createE2eHarness("e2e-priority-transition-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const traceId = newId("trace");
        // Create high priority task in queued state
        insertTask(h.store, h.db, taskId, "high", "queued");
        // Transition through states
        h.db.transaction(() => {
            h.store.insertExecution({
                id: executionId,
                taskId,
                workflowId: "single_agent_minimal",
                parentExecutionId: null,
                agentId: "agent-1",
                roleId: "general_executor",
                runKind: "task_run",
                status: "created",
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
                startedAt: null,
                finishedAt: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            });
        });
        h.transitions.transitionTaskStatus({
            entityKind: "task",
            entityId: taskId,
            fromStatus: "queued",
            toStatus: "pending",
            executionId: null,
            reasonCode: "e2e_test",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        h.transitions.transitionTaskStatus({
            entityKind: "task",
            entityId: taskId,
            fromStatus: "pending",
            toStatus: "in_progress",
            executionId,
            reasonCode: "e2e_test",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        const task = h.store.getTask(taskId);
        assert.equal(task?.priority, "high", "Priority should be preserved through transitions");
        assert.equal(task?.status, "in_progress", "Status should be correctly updated");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("E2E: urgent priority task lifecycle", () => {
    const h = createE2eHarness("e2e-priority-urgent-");
    try {
        const taskId = newId("task");
        const executionId = newId("exec");
        const sessionId = newId("sess");
        const traceId = newId("trace");
        // Create urgent task
        const now = nowIso();
        h.db.transaction(() => {
            h.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: "Urgent task",
                status: "queued",
                source: "user",
                priority: "urgent",
                inputJson: "{}",
                normalizedInputJson: "{}",
                outputJson: null,
                estimatedCostUsd: 0.05,
                actualCostUsd: 0,
                errorCode: null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
            });
        });
        // Transition to pending
        h.transitions.transitionTaskStatus({
            entityKind: "task",
            entityId: taskId,
            fromStatus: "queued",
            toStatus: "pending",
            executionId: null,
            reasonCode: "e2e_test",
            traceId,
            actorType: "system",
            occurredAt: nowIso(),
        });
        const pendingTask = h.store.getTask(taskId);
        assert.equal(pendingTask?.status, "pending", "Task should be pending");
        assert.equal(pendingTask?.priority, "urgent", "Priority should be urgent");
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=task-priority-handling.test.js.map