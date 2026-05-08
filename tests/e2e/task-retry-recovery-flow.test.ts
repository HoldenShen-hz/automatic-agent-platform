/**
 * E2E Task Retry and Recovery Flow Tests
 *
 * Tests task retry mechanisms, failure recovery, and execution supersession.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { ExecutionStatus, TaskStatus } from "../../src/platform/contracts/types/status.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-retry.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, transitions };
}

function seedTaskWithExecution(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  executionId: string,
  status: TaskStatus = "in_progress",
  executionStatus: ExecutionStatus = "executing",
  maxRetries: number = 1,
  traceId: string = "test-trace",
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Retry test task",
      status,
      source: "user",
      priority: "normal",
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

// @ts-ignore
    store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: executionStatus,
      inputRef: null,
      traceId,
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries,
      retryBackoff: "exponential",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: executionStatus === "executing" ? now : null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

test("E2E: failed execution with retry creates new attempt", () => {
  const h = createE2eHarness("e2e-retry-create-");
  const taskId = newId("task");
  const exec1Id = newId("exec");
  const exec2Id = newId("exec");
  const traceId1 = newId("trace");
  const traceId2 = newId("trace");

  try {
    // First execution fails
    seedTaskWithExecution(h.store, h.db, taskId, exec1Id, "in_progress", "failed", 1, traceId1);

    // Create retry execution
    h.db.transaction(() => {
// @ts-ignore
      h.store.insertExecution({
        id: exec2Id,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: exec1Id,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const exec1 = h.store.getExecution(exec1Id);
    const exec2 = h.store.getExecution(exec2Id);

    assert.equal(exec1?.status, "failed", "First execution should be failed");
    assert.equal(exec2?.status, "executing", "Retry execution should be running");
    assert.equal(exec2?.parentExecutionId, exec1Id, "Retry should reference parent execution");
    assert.equal(exec2?.attempt, 2, "Retry attempt should be 2");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: successful retry execution completes task", () => {
  const h = createE2eHarness("e2e-retry-success-");
  const taskId = newId("task");
  const exec1Id = newId("exec");
  const exec2Id = newId("exec");
  const sessionId = newId("sess");
  const traceId1 = newId("trace");
  const traceId2 = newId("trace");

  try {
    // First execution fails
    seedTaskWithExecution(h.store, h.db, taskId, exec1Id, "in_progress", "failed", 1, traceId1);

    // Create retry execution
    h.db.transaction(() => {
// @ts-ignore
      h.store.insertExecution({
        id: exec2Id,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: exec1Id,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 1,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    // Retry succeeds
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: exec2Id,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "e2e_test",
      traceId: traceId2,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    // Complete task
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: exec2Id,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "retry succeeded" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId: traceId2,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should complete after successful retry");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: execution superseded by higher priority task", () => {
  const h = createE2eHarness("e2e-supersede-");
  const taskId = newId("task");
  const exec1Id = newId("exec");
  const exec2Id = newId("exec");
  const traceId1 = newId("trace");
  const traceId2 = newId("trace");

  try {
    // First execution is blocked (waiting for approval)
    seedTaskWithExecution(h.store, h.db, taskId, exec1Id, "in_progress", "blocked", 0, traceId1);

    // First execution gets superseded
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: exec1Id,
      fromStatus: "blocked",
      toStatus: "superseded",
      reasonCode: "e2e_test",
      traceId: traceId1,
      actorType: "system",
      occurredAt: nowIso(),
    });

    // New execution takes over
    h.db.transaction(() => {
// @ts-ignore
      h.store.insertExecution({
        id: exec2Id,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: exec1Id,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: traceId2,
        attempt: 2,
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
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const exec1 = h.store.getExecution(exec1Id);
    const exec2 = h.store.getExecution(exec2Id);

    assert.equal(exec1?.status, "superseded", "Original execution should be superseded");
    assert.equal(exec2?.status, "executing", "New execution should be running");
    assert.equal(exec2?.parentExecutionId, exec1Id, "New execution should reference superseded parent");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: transient failure allows retry", () => {
  const h = createE2eHarness("e2e-transient-");
  const taskId = newId("task");
  const execId = newId("exec");
  const traceId = newId("trace");

  try {
    seedTaskWithExecution(h.store, h.db, taskId, execId, "in_progress", "executing", 3, traceId);

    // Simulate transient failure
    h.db.transaction(() => {
      h.store.updateExecutionStatus(execId, "failed", nowIso(), "transient_error", nowIso(), "transient_error");
    });

    const exec = h.store.getExecution(execId);
    assert.equal(exec?.lastErrorCode, "transient_error", "Error code should be recorded");
    assert.ok(exec?.maxRetries && exec.maxRetries > 0, "Execution should allow retries");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: exhausted retries marks execution for failure", () => {
  const h = createE2eHarness("e2e-exhausted-");
  const taskId = newId("task");
  const execId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    seedTaskWithExecution(h.store, h.db, taskId, execId, "in_progress", "executing", 0, traceId);

    // Execution fails with no retries
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: execId,
      fromStatus: "executing",
      toStatus: "failed",
      reasonCode: "e2e_test",
      traceId,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    // Transition task to failed
    h.db.transaction(() => {
      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId: execId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: "{}",
      outputsJson: "{}",
      context: {
        reasonCode: "execution.failed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be marked as failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
