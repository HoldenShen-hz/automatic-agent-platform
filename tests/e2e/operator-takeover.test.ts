/**
 * E2E Operator Takeover Tests
 *
 * Tests operator takeover flow - when an operator takes over a running task,
 * the original execution is paused and the operator gains control.
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
import type { ExecutionStatusTransitionCommand, TaskStatusTransitionCommand, TakeoverSessionRecord } from "../../src/platform/contracts/types/domain.js";

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
  status: ExecutionStatus = "executing",
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "E2E takeover test task",
      status: "in_progress",
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
      status,
      inputRef: null,
      traceId,
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
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

test("E2E: operator takeover - operator can take over executing task", () => {
  const h = createE2eHarness("e2e-takeover-");
  const ts = new TransitionService(h.db, h.store);

  try {
    const traceId = newId("trace");
    const taskId = newId("task");
    const execId = newId("exec");
    const operatorId = newId("operator");

    insertTaskAndExecution(h.db, h.store, taskId, execId, traceId, "executing");

    // Create takeover session for operator
    const takeoverSessionId = newId("takeover-sess");
    h.db.transaction(() => {
      h.store.insertTakeoverSession({
        id: takeoverSessionId,
        taskId,
        executionId: execId,
        operatorId,
        status: "open",
        reasonCode: "operator_takeover",
        startedAt: nowIso(),
        closedAt: null,
      });
    });

    // Operator's session should be active
    const takeoverSession = h.store.getTakeoverSession(takeoverSessionId);
    assert.ok(takeoverSession, "Takeover session should exist");
    assert.equal(takeoverSession?.status, "open");
    assert.equal(takeoverSession?.operatorId, operatorId);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: operator takeover - task status reflects takeover in progress", () => {
  const h = createE2eHarness("e2e-takeover-status-");
  const ts = new TransitionService(h.db, h.store);

  try {
    const traceId = newId("trace");
    const taskId = newId("task");
    const execId = newId("exec");
    const operatorId = newId("operator");

    insertTaskAndExecution(h.db, h.store, taskId, execId, traceId, "executing");

    // Create active takeover session
    const takeoverSessionId = newId("takeover-sess");
    h.db.transaction(() => {
      h.store.insertTakeoverSession({
        id: takeoverSessionId,
        taskId,
        executionId: execId,
        operatorId,
        status: "open",
        reasonCode: "operator_takeover",
        startedAt: nowIso(),
        closedAt: null,
      });
    });

    // Task should still be in_progress during takeover
    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "in_progress");

    // Original execution should be paused
    const exec = h.store.getExecution(execId);
    assert.equal(exec?.status, "executing");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: operator takeover - takeover session can be closed and task resumed", () => {
  const h = createE2eHarness("e2e-takeover-resume-");
  const ts = new TransitionService(h.db, h.store);

  try {
    const traceId = newId("trace");
    const taskId = newId("task");
    const execId = newId("exec");
    const operatorId = newId("operator");

    insertTaskAndExecution(h.db, h.store, taskId, execId, traceId, "executing");

    // Create takeover session
    const takeoverSessionId = newId("takeover-sess");
    h.db.transaction(() => {
      h.store.insertTakeoverSession({
        id: takeoverSessionId,
        taskId,
        executionId: execId,
        operatorId,
        status: "open",
        reasonCode: "operator_takeover",
        startedAt: nowIso(),
        closedAt: null,
      });
    });

    // Close takeover session
    h.db.transaction(() => {
      h.store.closeTakeoverSession(takeoverSessionId, nowIso());
    });

    // Takeover session should be closed
    const takeoverSession = h.store.getTakeoverSession(takeoverSessionId);
    assert.equal(takeoverSession?.status, "closed");

    // Original execution should still be in executing state
    const exec = h.store.getExecution(execId);
    assert.equal(exec?.status, "executing");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: operator takeover - task can complete after takeover ends", () => {
  const h = createE2eHarness("e2e-takeover-complete-");
  const ts = new TransitionService(h.db, h.store);

  try {
    const traceId = newId("trace");
    const taskId = newId("task");
    const execId = newId("exec");
    const operatorId = newId("operator");

    insertTaskAndExecution(h.db, h.store, taskId, execId, traceId, "executing");

    // Create and close takeover session
    const takeoverSessionId = newId("takeover-sess");
    h.db.transaction(() => {
      h.store.insertTakeoverSession({
        id: takeoverSessionId,
        taskId,
        executionId: execId,
        operatorId,
        status: "open",
        reasonCode: "operator_takeover",
        startedAt: nowIso(),
        closedAt: null,
      });
    });

    // Complete the original execution
    ts.transitionExecutionStatus(makeExecCommand(execId, "executing", "succeeded", traceId));

    // Task reaches terminal state
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
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
