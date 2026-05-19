/**
 * Integration tests for RuntimeLifecycleRepository
 *
 * Tests the full decorator chain with real database operations.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
const now = "2026-04-29T00:00:00.000Z";
function createTestTaskInput(overrides = {}) {
    return {
        id: overrides.id ?? `task-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        parentId: null,
        rootId: overrides.id ?? `task-lifecycle-${Date.now()}`,
        divisionId: "general_ops",
        tenantId: overrides.tenantId ?? null,
        title: "Lifecycle Test Task",
        status: overrides.status ?? "queued",
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
    };
}
function createTestExecutionInput(taskId, executionId) {
    return {
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-001",
        roleId: "general_executor",
        runKind: "task_run",
        status: "pending",
        inputRef: null,
        traceId: `trace-${executionId}`,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1.0,
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
        createdAt: now,
        updatedAt: now,
    };
}
// ---------------------------------------------------------------------------
// Task status lifecycle
// ---------------------------------------------------------------------------
test("RuntimeLifecycleRepository updateTaskStatus transitions through states", () => {
    const ctx = createIntegrationContext("aa-lifecycle-task-");
    try {
        const taskId = "task-lifecycle-status-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
        });
        // queued -> in_progress
        ctx.db.transaction(() => {
            ctx.store.task.updateTaskStatus(taskId, "in_progress", now);
        });
        let task = ctx.store.getTask(taskId);
        assert.equal(task.status, "in_progress");
        // in_progress -> completed
        ctx.db.transaction(() => {
            ctx.store.task.updateTaskStatus(taskId, "completed", now, null, now);
        });
        task = ctx.store.getTask(taskId);
        assert.equal(task.status, "completed");
        assert.ok(task.completedAt);
    }
    finally {
        ctx.cleanup();
    }
});
test("RuntimeLifecycleRepository updateTaskStatusCas ensures atomic updates", () => {
    const ctx = createIntegrationContext("aa-lifecycle-task-cas-");
    try {
        const taskId = "task-lifecycle-cas-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId, status: "queued" }));
        });
        // Correct expected status
        let affected = ctx.db.transaction(() => {
            return ctx.store.task.updateTaskStatusCas(taskId, "queued", "in_progress", now);
        });
        assert.equal(affected, 1);
        // Wrong expected status
        affected = ctx.db.transaction(() => {
            return ctx.store.task.updateTaskStatusCas(taskId, "queued", "running", now);
        });
        assert.equal(affected, 0);
        // Verify final state
        const task = ctx.store.getTask(taskId);
        assert.equal(task.status, "in_progress");
    }
    finally {
        ctx.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Workflow state lifecycle
// ---------------------------------------------------------------------------
test("RuntimeLifecycleRepository updateWorkflowState advances through steps", () => {
    const ctx = createIntegrationContext("aa-lifecycle-workflow-");
    try {
        const taskId = "task-lifecycle-wf-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
            ctx.store.insertWorkflowState({
                id: "wf-lifecycle-001",
                taskId,
                status: "running",
                currentStepIndex: 0,
                outputsJson: "{}",
                stepCount: 3,
                version: 1,
                createdAt: now,
                updatedAt: now,
                resumableFromStep: null,
            });
        });
        // Advance through steps
        for (let step = 1; step <= 3; step++) {
            ctx.db.transaction(() => {
                ctx.store.workflow.updateWorkflowState(taskId, step < 3 ? "running" : "completed", step, JSON.stringify({ completedSteps: step }), now);
            });
            const workflow = ctx.store.getWorkflowState(taskId);
            assert.equal(workflow.currentStepIndex, step);
        }
        // Verify completed
        const finalWorkflow = ctx.store.getWorkflowState(taskId);
        assert.equal(finalWorkflow.status, "completed");
    }
    finally {
        ctx.cleanup();
    }
});
test("RuntimeLifecycleRepository updateWorkflowStateCas prevents stale updates", () => {
    const ctx = createIntegrationContext("aa-lifecycle-wf-cas-");
    try {
        const taskId = "task-lifecycle-wf-cas-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
            ctx.store.insertWorkflowState({
                id: "wf-cas-001",
                taskId,
                status: "running",
                currentStepIndex: 0,
                outputsJson: "{}",
                stepCount: 5,
                version: 1,
                createdAt: now,
                updatedAt: now,
                resumableFromStep: null,
            });
        });
        // First update succeeds
        let affected = ctx.db.transaction(() => {
            return ctx.store.workflow.updateWorkflowStateCas(taskId, 1, // expected version
            "running", "running", 1, '{"step": 1}', now);
        });
        assert.equal(affected, 1);
        // Stale version update fails
        affected = ctx.db.transaction(() => {
            return ctx.store.workflow.updateWorkflowStateCas(taskId, 1, // stale version - should be 2 now
            "running", "running", 2, '{"step": 2}', now);
        });
        assert.equal(affected, 0);
        // Verify step index is still 1
        const workflow = ctx.store.getWorkflowState(taskId);
        assert.equal(workflow.currentStepIndex, 1);
    }
    finally {
        ctx.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------
test("RuntimeLifecycleRepository updateSessionStatus transitions session state", () => {
    const ctx = createIntegrationContext("aa-lifecycle-session-");
    try {
        const taskId = "task-lifecycle-sess-001";
        const sessionId = "sess-lifecycle-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
            ctx.store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "open",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // open -> completed
        ctx.db.transaction(() => {
            ctx.store.session.updateSessionStatus(sessionId, "completed", now);
        });
        const session = ctx.store.getSession(sessionId);
        assert.equal(session.status, "completed");
    }
    finally {
        ctx.cleanup();
    }
});
test("RuntimeLifecycleRepository updateSessionStatusCas prevents race conditions", () => {
    const ctx = createIntegrationContext("aa-lifecycle-sess-cas-");
    try {
        const taskId = "task-lifecycle-sess-cas-001";
        const sessionId = "sess-lifecycle-cas-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
            ctx.store.insertSession({
                id: sessionId,
                taskId,
                channel: "cli",
                status: "open",
                externalSessionId: null,
                createdAt: now,
                updatedAt: now,
            });
        });
        // Correct expected status
        let affected = ctx.db.transaction(() => {
            return ctx.store.session.updateSessionStatusCas(sessionId, "open", "completed", now);
        });
        assert.equal(affected, 1);
        // Wrong expected status
        affected = ctx.db.transaction(() => {
            return ctx.store.session.updateSessionStatusCas(sessionId, "open", "failed", now);
        });
        assert.equal(affected, 0);
    }
    finally {
        ctx.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Execution lifecycle
// ---------------------------------------------------------------------------
test("RuntimeLifecycleRepository updateExecutionStatus tracks execution progress", () => {
    const ctx = createIntegrationContext("aa-lifecycle-exec-");
    try {
        const taskId = "task-lifecycle-exec-001";
        const executionId = "exec-lifecycle-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
            ctx.store.insertExecution(createTestExecutionInput(taskId, executionId));
        });
        const startTime = now;
        // pending -> executing
        ctx.db.transaction(() => {
            ctx.store.execution.updateExecutionStatus(executionId, "executing", now, startTime);
        });
        let exec = ctx.store.getExecution(executionId);
        assert.equal(exec.status, "executing");
        assert.equal(exec.startedAt, startTime);
        // executing -> succeeded
        const finishTime = new Date(Date.now() + 60000).toISOString();
        ctx.db.transaction(() => {
            ctx.store.execution.updateExecutionStatus(executionId, "succeeded", finishTime, startTime, finishTime);
        });
        exec = ctx.store.getExecution(executionId);
        assert.equal(exec.status, "succeeded");
        assert.equal(exec.finishedAt, finishTime);
    }
    finally {
        ctx.cleanup();
    }
});
test("RuntimeLifecycleRepository updateExecutionStatusCas validates state before update", () => {
    const ctx = createIntegrationContext("aa-lifecycle-exec-cas-");
    try {
        const taskId = "task-lifecycle-exec-cas-001";
        const executionId = "exec-lifecycle-cas-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
            ctx.store.insertExecution(createTestExecutionInput(taskId, executionId));
        });
        // Correct expected status
        let affected = ctx.db.transaction(() => {
            return ctx.store.execution.updateExecutionStatusCas(executionId, "pending", "executing", now);
        });
        assert.equal(affected, 1);
        // Wrong expected status
        affected = ctx.db.transaction(() => {
            return ctx.store.execution.updateExecutionStatusCas(executionId, "pending", // Already changed
            "executing", now);
        });
        assert.equal(affected, 0);
    }
    finally {
        ctx.cleanup();
    }
});
test("RuntimeLifecycleRepository updateExecutionFailure records error context", () => {
    const ctx = createIntegrationContext("aa-lifecycle-exec-fail-");
    try {
        const taskId = "task-lifecycle-fail-001";
        const executionId = "exec-lifecycle-fail-001";
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
            ctx.store.insertExecution({
                ...createTestExecutionInput(taskId, executionId),
                status: "executing",
                startedAt: now,
            });
        });
        const errorTime = now;
        ctx.db.transaction(() => {
            ctx.store.execution.updateExecutionFailure({
                executionId,
                status: "failed",
                updatedAt: errorTime,
                finishedAt: errorTime,
                lastErrorCode: "ERR_TIMEOUT",
                lastErrorMessage: "Execution timed out after 60 seconds",
            });
        });
        const exec = ctx.store.getExecution(executionId);
        assert.equal(exec.status, "failed");
        assert.equal(exec.lastErrorCode, "ERR_TIMEOUT");
        assert.equal(exec.lastErrorMessage, "Execution timed out after 60 seconds");
    }
    finally {
        ctx.cleanup();
    }
});
// ---------------------------------------------------------------------------
// Multi-entity workflow
// ---------------------------------------------------------------------------
test("RuntimeLifecycleRepository coordinates task -> execution -> task updates", () => {
    const ctx = createIntegrationContext("aa-lifecycle-coord-");
    try {
        const taskId = "task-lifecycle-coord-001";
        const executionId = "exec-lifecycle-coord-001";
        // Create task and execution
        ctx.db.transaction(() => {
            ctx.store.insertTask(createTestTaskInput({ id: taskId }));
            ctx.store.insertExecution(createTestExecutionInput(taskId, executionId));
        });
        // Start execution
        ctx.db.transaction(() => {
            ctx.store.execution.updateExecutionStatus(executionId, "executing", now, now);
            ctx.store.task.updateTaskStatus(taskId, "in_progress", now);
        });
        let task = ctx.store.getTask(taskId);
        let exec = ctx.store.getExecution(executionId);
        assert.equal(task.status, "in_progress");
        assert.equal(exec.status, "executing");
        // Complete execution
        const finishTime = new Date(Date.now() + 60000).toISOString();
        ctx.db.transaction(() => {
            ctx.store.execution.updateExecutionStatus(executionId, "succeeded", finishTime, now, finishTime);
            ctx.store.task.updateTaskStatus(taskId, "completed", finishTime, null, finishTime);
        });
        task = ctx.store.getTask(taskId);
        exec = ctx.store.getExecution(executionId);
        assert.equal(task.status, "completed");
        assert.equal(exec.status, "succeeded");
        assert.ok(task.completedAt);
    }
    finally {
        ctx.cleanup();
    }
});
//# sourceMappingURL=runtime-lifecycle-repository-integration.test.js.map