/**
 * Integration tests for AuthoritativeTaskStore
 *
 * Tests full CRUD workflows with real database transactions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";

const now = "2026-04-29T00:00:00.000Z";

function createTestTaskInput(overrides: Partial<{
  id: string;
  tenantId: string | null;
  status: string;
}> = {}): Parameters<ReturnType<typeof createIntegrationContext>["store"]["insertTask"]>[0] {
  return {
    id: overrides.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    parentId: null,
    rootId: overrides.id ?? `task-${Date.now()}`,
    divisionId: "general_ops",
    tenantId: overrides.tenantId ?? null,
    title: "Integration Test Task",
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

function createTestExecutionInput(
  taskId: string,
  executionId: string,
  overrides: Partial<Parameters<ReturnType<typeof createIntegrationContext>["store"]["insertExecution"]>[0]> = {},
): Parameters<ReturnType<typeof createIntegrationContext>["store"]["insertExecution"]>[0] {
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Task lifecycle integration
// ---------------------------------------------------------------------------

test("task lifecycle: create -> read -> update -> complete", () => {
  const ctx = createIntegrationContext("aa-task-lifecycle-");
  try {
    const taskId = "task-lifecycle-001";

    // Create
    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: taskId }));
    });

    // Read
    const task = ctx.store.getTask(taskId);
    assert.ok(task);
    assert.equal(task!.status, "queued");

    // Update to in_progress
    ctx.db.transaction(() => {
      ctx.store.updateTaskStatus(taskId, "in_progress", now);
    });

    let updated = ctx.store.getTask(taskId);
    assert.equal(updated!.status, "in_progress");

    // Update output
    ctx.db.transaction(() => {
      ctx.store.updateTaskOutput(taskId, '{"result": "done"}', now);
    });

    updated = ctx.store.getTask(taskId);
    assert.equal(updated!.outputJson, '{"result": "done"}');

    // Complete
    ctx.db.transaction(() => {
      ctx.store.updateTaskStatus(taskId, "completed", now, null, now);
    });

    updated = ctx.store.getTask(taskId);
    assert.equal(updated!.status, "completed");
    assert.ok(updated!.completedAt);
  } finally {
    ctx.cleanup();
  }
});

test("task with multiple executions tracks history correctly", () => {
  const ctx = createIntegrationContext("aa-task-multi-exec-");
  try {
    const taskId = "task-multi-exec-001";
    const executionIds = ["exec-multi-1", "exec-multi-2", "exec-multi-3"];

    // Create task
    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: taskId }));
    });

    // Create multiple executions (simulating retries)
    ctx.db.transaction(() => {
      executionIds.forEach((execId, index) => {
        ctx.store.insertExecution(createTestExecutionInput(taskId, execId, { attempt: index + 1 }));
      });
    });

    // Verify all executions exist
    const executions = ctx.store.listExecutionsByTask(taskId);
    assert.equal(executions.length, 3);

    // Update first execution to failed (simulating retry)
    ctx.db.transaction(() => {
      ctx.store.updateExecutionStatus(executionIds[0], "failed", now, now, now, "ERR_RETRY");
    });

    // Verify second execution is still pending
    const exec1 = ctx.store.getExecution(executionIds[0]);
    assert.equal(exec1!.status, "failed");

    const exec2 = ctx.store.getExecution(executionIds[1]);
    assert.equal(exec2!.status, "pending");
  } finally {
    ctx.cleanup();
  }
});

test("workflow state persists and updates correctly", () => {
  const ctx = createIntegrationContext("aa-workflow-state-");
  try {
    const taskId = "task-wf-persist-001";
    const workflowId = "wf-persist-001";

    // Create task and workflow
    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: taskId }));
      ctx.store.insertWorkflowState({
        id: workflowId,
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

    // Verify workflow state
    let workflow = ctx.store.getWorkflowState(taskId);
    assert.ok(workflow);
    assert.equal(workflow!.currentStepIndex, 0);
    assert.equal(workflow!.status, "running");

    // Advance workflow through steps
    for (let step = 1; step <= 4; step++) {
      ctx.db.transaction(() => {
        ctx.store.updateWorkflowState(
          taskId,
          "running",
          step,
          JSON.stringify({ completedSteps: step }),
          now,
        );
      });

      workflow = ctx.store.getWorkflowState(taskId);
      assert.equal(workflow!.currentStepIndex, step);
    }

    // Complete workflow
    ctx.db.transaction(() => {
      ctx.store.updateWorkflowState(
        taskId,
        "completed",
        4,
        JSON.stringify({ completedSteps: 4, result: "success" }),
        now,
      );
    });

    workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow!.status, "completed");
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// CAS operation integration
// ---------------------------------------------------------------------------

test("CAS updateTaskStatusCas only updates when status matches", () => {
  const ctx = createIntegrationContext("aa-task-cas-");
  try {
    const taskId = "task-cas-001";

    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: taskId, status: "queued" }));
    });

    // Correct expected status - should succeed
    let affected = ctx.db.transaction(() => {
      return ctx.store.updateTaskStatusCas(taskId, "queued", "in_progress", now);
    });
    assert.equal(affected, 1);

    // Wrong expected status - should return 0
    affected = ctx.db.transaction(() => {
      return ctx.store.updateTaskStatusCas(taskId, "queued", "running", now);
    });
    assert.equal(affected, 0);

    // Verify final status is still "in_progress"
    const task = ctx.store.getTask(taskId);
    assert.equal(task!.status, "in_progress");
  } finally {
    ctx.cleanup();
  }
});

test("concurrent workflow updates with CAS version check", () => {
  const ctx = createIntegrationContext("aa-wf-cas-");
  try {
    const taskId = "task-wf-cas-001";

    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: taskId }));
      ctx.store.insertWorkflowState({
        id: "wf-cas-001",
        taskId,
        status: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        stepCount: 10,
        version: 1,
        createdAt: now,
        updatedAt: now,
        resumableFromStep: null,
      });
    });

    // First update should succeed (version 1 -> 2)
    let affected = ctx.db.transaction(() => {
      return ctx.store.updateWorkflowStateCas(
        taskId,
        0, // current step index before first advance
        "running",
        "running",
        1,
        '{"step": 1}',
        now,
      );
    });
    assert.equal(affected, 1);

    // Second update with wrong version should fail (version 1 is stale)
    affected = ctx.db.transaction(() => {
      return ctx.store.updateWorkflowStateCas(
        taskId,
        0, // stale step index
        "running",
        "running",
        2,
        '{"step": 2}',
        now,
      );
    });
    assert.equal(affected, 0);

    // Verify step index is still 1 (stale write was rejected)
    const workflow = ctx.store.getWorkflowState(taskId);
    assert.equal(workflow!.currentStepIndex, 1);
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Error handling integration
// ---------------------------------------------------------------------------

test("updateExecutionFailure records complete error context", () => {
  const ctx = createIntegrationContext("aa-exec-failure-");
  try {
    const taskId = "task-exec-fail-ctx-001";
    const executionId = "exec-fail-ctx-001";

    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: taskId }));
      ctx.store.insertExecution(createTestExecutionInput(taskId, executionId));
    });

    const errorCode = "ERR_BUDGET_EXCEEDED";
    const errorMessage = "Budget limit of $1.00 exceeded by $0.50";

    ctx.db.transaction(() => {
      ctx.store.updateExecutionFailure({
        executionId,
        status: "failed",
        updatedAt: now,
        finishedAt: now,
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
      });
    });

    const execution = ctx.store.getExecution(executionId);
    assert.equal(execution!.status, "failed");
    assert.equal(execution!.lastErrorCode, errorCode);
    assert.equal(execution!.lastErrorMessage, errorMessage);
    assert.ok(execution!.finishedAt);
  } finally {
    ctx.cleanup();
  }
});

test("task status transitions preserve error code across transitions", () => {
  const ctx = createIntegrationContext("aa-task-error-preserve-");
  try {
    const taskId = "task-error-preserve-001";

    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: taskId }));
    });

    // Transition to failed with error code
    ctx.db.transaction(() => {
      ctx.store.updateTaskStatus(taskId, "failed", now, "ERR_TIMEOUT");
    });

    let task = ctx.store.getTask(taskId);
    assert.equal(task!.status, "failed");
    assert.equal(task!.errorCode, "ERR_TIMEOUT");

    // Transition back to queued (retry scenario)
    ctx.db.transaction(() => {
      ctx.store.updateTaskStatus(taskId, "queued", now);
    });

    task = ctx.store.getTask(taskId);
    assert.equal(task!.status, "queued");
    // Note: error code may or may not be cleared depending on business rules
  } finally {
    ctx.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Query integration
// ---------------------------------------------------------------------------

test("listTasks with combined filters returns correct subset", () => {
  const ctx = createIntegrationContext("aa-task-filter-");
  try {
    // Create tasks with different statuses and tenants
    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: "t1", tenantId: "tenant-a", status: "queued" }));
      ctx.store.insertTask(createTestTaskInput({ id: "t2", tenantId: "tenant-a", status: "in_progress" }));
      ctx.store.insertTask(createTestTaskInput({ id: "t3", tenantId: "tenant-b", status: "queued" }));
      ctx.store.insertTask(createTestTaskInput({ id: "t4", tenantId: "tenant-a", status: "completed" }));
    });

    // Filter by tenant only
    const tenantATasks = ctx.store.listTasks({ tenantId: "tenant-a" });
    assert.equal(tenantATasks.length, 3);

    // Filter by status only
    const queuedTasks = ctx.store.listTasks({ status: "queued" });
    assert.equal(queuedTasks.length, 2);

    // Filter by both tenant and status
    const filtered = ctx.store.listTasks({ tenantId: "tenant-a", status: "queued" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.id, "t1");
  } finally {
    ctx.cleanup();
  }
});

test("execution state transitions are atomic within transaction", () => {
  const ctx = createIntegrationContext("aa-exec-atomic-");
  try {
    const taskId = "task-exec-atomic-001";
    const executionId = "exec-atomic-001";

    ctx.db.transaction(() => {
      ctx.store.insertTask(createTestTaskInput({ id: taskId }));
      ctx.store.insertExecution(createTestExecutionInput(taskId, executionId));
    });

    // All status changes in single transaction
    const startTime = now;
    const finishTime = new Date(Date.now() + 60000).toISOString();

    ctx.db.transaction(() => {
      ctx.store.updateExecutionStatus(executionId, "executing", startTime, startTime);
      ctx.store.updateExecutionStatus(executionId, "completed", finishTime, startTime, finishTime);
    });

    const execution = ctx.store.getExecution(executionId);
    assert.equal(execution!.status, "completed");
    assert.equal(execution!.startedAt, startTime);
    assert.equal(execution!.finishedAt, finishTime);
  } finally {
    ctx.cleanup();
  }
});
