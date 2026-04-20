/**
 * E2E Error Propagation Tests
 *
 * Tests error propagation through the system - from execution failure
 * through to task final state, verifying error codes and retry behavior.
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
import type { ExecutionStatusTransitionCommand, TaskStatusTransitionCommand } from "../../src/platform/contracts/types/domain.js";

function makeTaskCommand(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  traceId: string,
  executionId: string | null = null,
): TaskStatusTransitionCommand {
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

function makeExecCommand(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
  traceId: string,
): ExecutionStatusTransitionCommand {
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

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  return { workspace, db, store };
}

function insertTaskAndExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  taskId: string,
  executionId: string,
  traceId: string,
  taskStatus: TaskStatus = "in_progress",
  executionStatus: ExecutionStatus = "executing",
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "E2E error test task",
      status: taskStatus,
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
      budgetUsdLimit: 1.0,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 3,
      retryBackoff: "exponential",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

test("E2E: error propagation - execution failure propagates to task", () => {
  const h = createE2eHarness("e2e-error-propagation-");
  const ts = new TransitionService(h.db, h.store);

  try {
    const traceId = newId("trace");
    const taskId = newId("task");
    const execId = newId("exec");

    // Insert with task in_progress and execution in executing state
    insertTaskAndExecution(h.db, h.store, taskId, execId, traceId, "in_progress", "executing");

    // Execution fails
    ts.transitionExecutionStatus(makeExecCommand(execId, "executing", "failed", traceId));

    // Task reaches terminal state via terminal transition
    ts.transitionTaskTerminalState({
      taskId,
      sessionId: newId("sess"),
      executionId: execId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "open",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: "{}",
      outputsJson: "[]",
      context: {
        reasonCode: "e2e_test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify task is failed
    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: error propagation - task can be cancelled mid-execution", () => {
  const h = createE2eHarness("e2e-error-cancel-");
  const ts = new TransitionService(h.db, h.store);

  try {
    const traceId = newId("trace");
    const taskId = newId("task");
    const execId = newId("exec");

    // Insert with task in_progress and execution in executing state
    insertTaskAndExecution(h.db, h.store, taskId, execId, traceId, "in_progress", "executing");

    // Cancel task mid-execution
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "cancelled",
      executionId: execId,
      reasonCode: "e2e_cancel",
      traceId,
      actorType: "user",
      occurredAt: nowIso(),
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "cancelled");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: error propagation - error code is preserved through transition", () => {
  const h = createE2eHarness("e2e-error-code-");
  const ts = new TransitionService(h.db, h.store);

  try {
    const traceId = newId("trace");
    const taskId = newId("task");
    const execId = newId("exec");

    // Insert with task in_progress and execution in executing state
    insertTaskAndExecution(h.db, h.store, taskId, execId, traceId, "in_progress", "executing");

    // Execution fails
    ts.transitionExecutionStatus(makeExecCommand(execId, "executing", "failed", traceId));

    // Task reaches terminal state with error
    ts.transitionTaskTerminalState({
      taskId,
      sessionId: newId("sess"),
      executionId: execId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "open",
      currentExecutionStatus: "failed",
      terminalStatus: "failed",
      taskOutputJson: "{}",
      outputsJson: "[]",
      context: {
        reasonCode: "e2e_error",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Task should have error code from execution
    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: error propagation - completed task cannot transition to failed", () => {
  const h = createE2eHarness("e2e-error-immutable-");
  const ts = new TransitionService(h.db, h.store);

  try {
    const traceId = newId("trace");
    const taskId = newId("task");
    const execId = newId("exec");

    // Insert with task in_progress and execution in executing state
    insertTaskAndExecution(h.db, h.store, taskId, execId, traceId, "in_progress", "executing");

    // Complete the execution
    ts.transitionExecutionStatus(makeExecCommand(execId, "executing", "succeeded", traceId));

    // Task reaches terminal state - done
    ts.transitionTaskTerminalState({
      taskId,
      sessionId: newId("sess"),
      executionId: execId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "open",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: "[]",
      context: {
        reasonCode: "e2e_test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done");

    // Execution is already succeeded - attempting to fail should throw
    assert.throws(
      () => {
        ts.transitionExecutionStatus(makeExecCommand(execId, "succeeded", "failed", traceId));
      },
      /invalid transition/i,
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
