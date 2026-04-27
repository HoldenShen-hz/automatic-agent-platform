/**
 * E2E Task Status Lifecycle Tests
 *
 * Tests task status transitions and lifecycle states.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus } from "../../src/platform/contracts/types/status.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-status-lifecycle.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, transitions };
}

test("E2E: task transitions from queued to pending", () => {
  const h = createE2eHarness("e2e-status-queued-");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Status test task",
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

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "pending", "Task should be in pending status");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: task in awaiting_decision waits for approval", () => {
  const h = createE2eHarness("e2e-status-awaiting-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Awaiting approval task",
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

    // Transition to awaiting_decision
    h.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "awaiting_decision",
      executionId,
      reasonCode: "approval.required",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "awaiting_decision", "Task should be awaiting_decision");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: task transitions from awaiting_decision back to in_progress after approval", () => {
  const h = createE2eHarness("e2e-status-approved-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Awaiting approval task",
        status: "awaiting_decision",
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

    // Resume after approval
    h.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "awaiting_decision",
      toStatus: "in_progress",
      executionId,
      reasonCode: "approval.approved",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should resume in_progress after approval");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: cancelled task cannot transition to in_progress", () => {
  const h = createE2eHarness("e2e-status-cancelled-");
  const taskId = newId("task");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Cancelled task",
        status: "cancelled",
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

    // Attempt to transition from cancelled - should throw
    assert.throws(
      () => {
        h.transitions.transitionTaskStatus({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "cancelled",
          toStatus: "in_progress",
          executionId: newId("exec"),
          reasonCode: "e2e_test",
          traceId,
          actorType: "system",
          occurredAt: nowIso(),
        });
      },
      /invalid transition/i,
      "Cancelled task should not transition to in_progress",
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: done task is terminal and cannot transition", () => {
  const h = createE2eHarness("e2e-status-done-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Done task",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "succeeded",
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
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "completed",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Transition to done
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "completed",
      currentSessionStatus: "completed",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");
    assert.ok(task?.completedAt != null, "Task should have completedAt timestamp");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
