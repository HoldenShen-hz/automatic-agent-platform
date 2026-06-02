import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { TransitionService } from "../../../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const source = readFileSync(
  new URL("../../../../src/platform/five-plane-execution/state-transition/transition-service.ts", import.meta.url),
  "utf8",
);

function createTerminalFixture() {
  const workspace = createTempWorkspace("aa-transition-service-terminal-");
  const db = new SqliteDatabase(join(workspace, "terminal.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: "task-terminal",
      parentId: null,
      rootId: "task-terminal",
      divisionId: "general-ops",
      title: "Terminal Task",
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
      taskId: "task-terminal",
      divisionId: "general-ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 1,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });
    store.insertSession({
      id: "session-terminal",
      taskId: "task-terminal",
      channel: "cli",
      status: "streaming",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
    store.insertExecution({
      id: "execution-terminal",
      taskId: "task-terminal",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      harnessRunId: null,
      agentId: "agent",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-terminal",
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

  return { workspace, db, store, now };
}

test("transition-service source keeps CAS updates for every runtime entity [transition-service]", () => {
  for (const fragment of [
    "updateTaskStatusCas(",
    "updateWorkflowStateCas(",
    "updateSessionStatusCas(",
    "updateExecutionStatusCas(",
    "transitionTaskTerminalState(",
    "transitionBlockedForApproval(",
  ]) {
    assert.equal(source.includes(fragment), true, `missing ${fragment}`);
  }
});

test("TransitionService.transitionTaskTerminalState cascades failure across task, workflow, session, and execution [transition-service]", () => {
  const fixture = createTerminalFixture();
  try {
    new TransitionService(fixture.db, fixture.store).transitionTaskTerminalState({
      taskId: "task-terminal",
      sessionId: "session-terminal",
      executionId: "execution-terminal",
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "executing",
      terminalStatus: "failed",
      taskOutputJson: '{"error":"failed"}',
      outputsJson: "{}",
      context: {
        reasonCode: "terminal.failed",
        traceId: "trace-terminal",
        actorType: "system",
        occurredAt: fixture.now,
      },
    });

    assert.equal(fixture.store.task.getTask("task-terminal")?.status, "failed");
    assert.equal(fixture.store.workflow.getWorkflowState("task-terminal")?.status, "failed");
    assert.equal(fixture.store.session.getSession("session-terminal")?.status, "failed");
    assert.equal(fixture.store.execution.getExecution("execution-terminal")?.status, "failed");
  } finally {
    fixture.db.close();
    cleanupPath(fixture.workspace);
  }
});
