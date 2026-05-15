/**
 * E2E Gateway Webhook Flow Tests
 *
 * Tests webhook triggering task creation and execution flows.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-gateway-webhook.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, transitions };
}

test("E2E: webhook creates task that transitions through lifecycle", () => {
  const h = createE2eHarness("e2e-webhook-task-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "webhook-trace";
    const now = nowIso();

    // Simulate gateway creating a task (source: system for gateway-triggered tasks)
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Gateway-triggered task",
        status: "queued",
        source: "system",
        priority: "high",
        inputJson: JSON.stringify({ gateway: true, trigger: "external" }),
        normalizedInputJson: JSON.stringify({ gateway: true, trigger: "external" }),
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Verify task was created with correct properties
    const task = h.store.getTask(taskId);
    assert.ok(task, "Task should exist after gateway action");
    assert.equal(task!.status, "queued", "Task should be queued initially");
    assert.equal(task!.source, "system", "Task source should be system (gateway)");
    assert.equal(task!.priority, "high", "Task priority should be high");

    // Transition task to pending
    h.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "pending",
      executionId: null,
      reasonCode: "gateway_received",
      traceId,
      actorType: "webhook",
      occurredAt: now,
    });

    const pendingTask = h.store.getTask(taskId);
    assert.equal(pendingTask!.status, "pending", "Task should transition to pending");

    // Insert execution for the task
    h.db.transaction(() => {
// @ts-ignore
      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-gateway",
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

    // Transition task to in_progress
    h.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "in_progress",
      executionId,
      reasonCode: "execution_started",
      traceId,
      actorType: "agent",
      occurredAt: now,
    });

    const inProgressTask = h.store.getTask(taskId);
    assert.equal(inProgressTask!.status, "in_progress", "Task should be in_progress");

    // Verify execution was created and linked
    const execution = h.store.getExecution(executionId);
    assert.ok(execution, "Execution should exist");
    assert.equal(execution!.taskId, taskId, "Execution should be linked to task");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: gateway task can be completed through execution success", () => {
  const h = createE2eHarness("e2e-gateway-complete-");

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const traceId = "gateway-complete-trace";
    const now = nowIso();

    // Create task in in_progress state
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Gateway completion test",
        status: "in_progress",
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

// @ts-ignore
      h.store.insertExecution({
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

    // Transition execution to succeeded
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "execution_completed",
      traceId,
      actorType: "agent",
      occurredAt: now,
    });

    // Transition task to done
    h.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "done",
      executionId,
      reasonCode: "execution_completed",
      traceId,
      actorType: "system",
      occurredAt: now,
    });

    const doneTask = h.store.getTask(taskId);
    assert.equal(doneTask!.status, "done", "Task should be done");
    assert.ok(doneTask!.completedAt, "Task should have completedAt timestamp");
  } finally {
    cleanupPath(h.workspace);
  }
});
