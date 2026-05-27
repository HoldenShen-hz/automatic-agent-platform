import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { TransitionService } from "../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import type { TaskTerminalTransitionInput } from "../../../../src/platform/five-plane-execution/state-transition/transition-service-model.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createTerminalFixture(name: string) {
  const workspace = createTempWorkspace(`aa-transition-terminal-${name}-`);
  const db = new SqliteDatabase(join(workspace, `${name}.db`));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new TransitionService(db, store);
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: `task-${name}`,
      parentId: null,
      rootId: `task-${name}`,
      divisionId: "general_ops",
      title: `Terminal ${name}`,
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
    store.insertWorkflowState({
      taskId: `task-${name}`,
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 2,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });
    store.insertSession({
      id: `session-${name}`,
      taskId: `task-${name}`,
      channel: "cli",
      status: "streaming",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
    store.insertExecution({
      id: `execution-${name}`,
      taskId: `task-${name}`,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      harnessRunId: null,
      agentId: "agent",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: `trace-${name}`,
      attempt: 1,
      timeoutMs: 60_000,
      budgetUsdLimit: 1,
      budgetReservationId: null,
      budgetLedgerId: null,
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

  function baseInput(terminalStatus: TaskTerminalTransitionInput["terminalStatus"]): TaskTerminalTransitionInput {
    return {
      taskId: `task-${name}`,
      sessionId: `session-${name}`,
      executionId: `execution-${name}`,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus,
      taskOutputJson: terminalStatus === "done" ? '{"result":"ok"}' : '{"error":"terminal"}',
      outputsJson: '{"steps":[]}',
      context: {
        reasonCode: `transition.${terminalStatus}`,
        traceId: `trace-${name}`,
        actorType: "system",
        occurredAt: now,
      },
    };
  }

  return { workspace, db, store, service, now, baseInput };
}

test("TransitionService.transitionTaskTerminalState marks task, workflow, session, and execution as done/completed/succeeded [transition-terminal]", () => {
  const fixture = createTerminalFixture("done");
  try {
    fixture.service.transitionTaskTerminalState(fixture.baseInput("done"));

    assert.equal(fixture.store.task.getTask("task-done")?.status, "done");
    assert.notEqual(fixture.store.task.getTask("task-done")?.completedAt, null);
    assert.equal(fixture.store.workflow.getWorkflowState("task-done")?.status, "completed");
    assert.equal(fixture.store.session.getSession("session-done")?.status, "completed");
    assert.equal(fixture.store.execution.getExecution("execution-done")?.status, "succeeded");
  } finally {
    fixture.db.close();
    cleanupPath(fixture.workspace);
  }
});

test("TransitionService.transitionTaskTerminalState propagates failure reason to task and execution [transition-terminal]", () => {
  const fixture = createTerminalFixture("failed");
  try {
    fixture.service.transitionTaskTerminalState(fixture.baseInput("failed"));

    assert.equal(fixture.store.task.getTask("task-failed")?.status, "failed");
    assert.equal(fixture.store.task.getTask("task-failed")?.errorCode, "transition.failed");
    assert.equal(fixture.store.workflow.getWorkflowState("task-failed")?.status, "failed");
    assert.equal(fixture.store.session.getSession("session-failed")?.status, "failed");
    assert.equal(fixture.store.execution.getExecution("execution-failed")?.status, "failed");
    assert.equal(fixture.store.execution.getExecution("execution-failed")?.lastErrorCode, "transition.failed");
  } finally {
    fixture.db.close();
    cleanupPath(fixture.workspace);
  }
});

test("TransitionService.applyTaskTerminalState handles cancellation without transaction wrapper drift [transition-terminal]", () => {
  const fixture = createTerminalFixture("cancelled");
  try {
    fixture.service.applyTaskTerminalState(fixture.baseInput("cancelled"));

    assert.equal(fixture.store.task.getTask("task-cancelled")?.status, "cancelled");
    assert.equal(fixture.store.workflow.getWorkflowState("task-cancelled")?.status, "cancelled");
    assert.equal(fixture.store.session.getSession("session-cancelled")?.status, "cancelled");
    assert.equal(fixture.store.execution.getExecution("execution-cancelled")?.status, "cancelled");
  } finally {
    fixture.db.close();
    cleanupPath(fixture.workspace);
  }
});
