import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { HumanTakeoverService } from "../../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function seedWorkflowAndSession(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    sessionId: string;
    workflowId?: string;
    currentStepIndex?: number;
    outputsJson?: string;
    resumableFromStep?: string | null;
    workflowStatus?: "running" | "failed" | "completed";
    sessionStatus?: "open" | "streaming" | "failed" | "completed";
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertWorkflowState({
      taskId: input.taskId,
      divisionId: "general_ops",
      workflowId: input.workflowId ?? "single_agent_minimal",
      currentStepIndex: input.currentStepIndex ?? 0,
      status: input.workflowStatus ?? "running",
      outputsJson: input.outputsJson ?? "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: input.resumableFromStep ?? null,
      startedAt: now,
      updatedAt: now,
    });
    store.insertSession({
      id: input.sessionId,
      taskId: input.taskId,
      channel: "cli",
      status: input.sessionStatus ?? "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

test("human takeover audits input and worker overrides in inspect output", () => {
  const workspace = createTempWorkspace("aa-takeover-");

  try {
    const db = new SqliteDatabase(join(workspace, "takeover.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-takeover-1",
      executionId: "exec-takeover-1",
      traceId: "trace-takeover-1",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-takeover-1",
      sessionId: "sess-takeover-1",
      workflowStatus: "running",
      sessionStatus: "open",
    });

    const service = new HumanTakeoverService(db, store);
    const opened = service.openSession({
      taskId: "task-takeover-1",
      operatorId: "operator-1",
      reasonCode: "incident.investigate",
    });
    service.modifyInput({
      takeoverSessionId: opened.takeoverSessionId,
      inputJson: JSON.stringify({ request: "manually adjusted request" }),
      reasonCode: "takeover.modify_input",
    });
    service.switchWorker({
      takeoverSessionId: opened.takeoverSessionId,
      agentId: "agent-manual",
      reasonCode: "takeover.switch_worker",
    });

    const inspect = new InspectService(store).getTaskInspectView("task-takeover-1");

    assert.equal(inspect.task.inputJson, JSON.stringify({ request: "manually adjusted request" }));
    assert.equal(inspect.execution?.agentId, "agent-manual");
    assert.equal(inspect.takeoverSessions.length, 1);
    assert.equal(inspect.operatorActions.length, 3);
    assert.equal(inspect.recoverySummary.lastTakeoverActionType, "switch_worker");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("human takeover can requeue a failed execution into a fresh attempt", () => {
  const workspace = createTempWorkspace("aa-takeover-");

  try {
    const db = new SqliteDatabase(join(workspace, "retry.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-retry-1",
      executionId: "exec-retry-1",
      traceId: "trace-retry-1",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-retry-1",
      sessionId: "sess-retry-1",
      workflowStatus: "failed",
      sessionStatus: "failed",
    });

    db.transaction(() => {
      store.setTaskState({
        taskId: "task-retry-1",
        status: "failed",
        updatedAt: nowIso(),
        errorCode: "execution.failed",
        completedAt: nowIso(),
      });
      store.updateExecutionStatus("exec-retry-1", "failed", nowIso(), null, nowIso(), "execution.failed");
      store.updateWorkflowRecoveryState({
        taskId: "task-retry-1",
        status: "failed",
        currentStepIndex: 0,
        outputsJson: "{}",
        updatedAt: nowIso(),
        resumableFromStep: "analyze_request",
        retryCount: 0,
        lastErrorCode: "execution.failed",
      });
    });

    const service = new HumanTakeoverService(db, store);
    const opened = service.openSession({
      taskId: "task-retry-1",
      operatorId: "operator-2",
      reasonCode: "incident.retry",
    });
    const retried = service.retryExecution({
      takeoverSessionId: opened.takeoverSessionId,
      reasonCode: "takeover.retry_execution",
    });

    const snapshot = store.loadTaskSnapshot("task-retry-1");
    const actions = store.listOperatorActionsByTask("task-retry-1");
    const previousSession = store.getSession("sess-retry-1");

    assert.equal(snapshot.task.status, "pending");
    assert.equal(snapshot.execution?.id, retried.executionId);
    assert.equal(snapshot.execution?.status, "created");
    assert.equal(snapshot.execution?.attempt, 2);
    assert.equal(snapshot.workflow?.status, "running");
    assert.equal(snapshot.workflow?.retryCount, 1);
    assert.equal(snapshot.session?.status, "open");
    assert.notEqual(snapshot.session?.id, "sess-retry-1");
    assert.equal(previousSession?.status, "failed");
    assert.equal(actions.at(-1)?.actionType, "retry_execution");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("human takeover can skip the current step and close the task cleanly", () => {
  const workspace = createTempWorkspace("aa-takeover-");

  try {
    const db = new SqliteDatabase(join(workspace, "skip.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-skip-1",
      executionId: "exec-skip-1",
      traceId: "trace-skip-1",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-skip-1",
      sessionId: "sess-skip-1",
      workflowStatus: "running",
      sessionStatus: "streaming",
    });

    const service = new HumanTakeoverService(db, store);
    const opened = service.openSession({
      taskId: "task-skip-1",
      operatorId: "operator-3",
      reasonCode: "incident.skip",
    });
    service.skipCurrentStep({
      takeoverSessionId: opened.takeoverSessionId,
      reasonCode: "takeover.skip_step",
      note: "skip the only step",
    });

    const snapshot = store.loadTaskSnapshot("task-skip-1");
    const sessions = store.listTakeoverSessionsByTask("task-skip-1");

    assert.equal(snapshot.task.status, "done");
    assert.equal(snapshot.workflow?.status, "completed");
    assert.equal(snapshot.workflow?.currentStepIndex, 1);
    assert.equal(snapshot.execution?.status, "succeeded");
    assert.equal(snapshot.session?.status, "completed");
    assert.equal(snapshot.stepOutputs.length, 1);
    assert.equal(sessions[0]?.status, "closed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("human takeover can manually reposition workflow recovery to a specific step", () => {
  const workspace = createTempWorkspace("aa-takeover-");

  try {
    const db = new SqliteDatabase(join(workspace, "set-current-step.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-set-step-1",
      executionId: "exec-set-step-1",
      traceId: "trace-set-step-1",
    });
    db.connection
      .prepare(`UPDATE executions SET workflow_id = ?, role_id = ? WHERE id = ?`)
      .run("single_division_multi_step_orchestration", "workflow_planner", "exec-set-step-1");
    seedWorkflowAndSession(db, store, {
      taskId: "task-set-step-1",
      sessionId: "sess-set-step-1",
      workflowId: "single_division_multi_step_orchestration",
      workflowStatus: "failed",
      currentStepIndex: 2,
      outputsJson: JSON.stringify({
        triage: { summary: "triaged", result: "triaged" },
        draft: { summary: "drafted", result: "drafted" },
      }),
      resumableFromStep: "final_review",
      sessionStatus: "failed",
    });

    const service = new HumanTakeoverService(db, store);
    const opened = service.openSession({
      taskId: "task-set-step-1",
      operatorId: "operator-5",
      reasonCode: "incident.reset_step",
    });
    service.setCurrentStep({
      takeoverSessionId: opened.takeoverSessionId,
      stepId: "draft_solution",
      reasonCode: "takeover.set_current_step",
    });

    const snapshot = store.loadTaskSnapshot("task-set-step-1");
    const actions = store.listOperatorActionsByTask("task-set-step-1");
    const payload = JSON.parse(actions.at(-1)?.actionPayloadJson ?? "{}") as {
      previousStepIndex?: number;
      nextStepIndex?: number;
      nextStepId?: string;
    };

    assert.equal(snapshot.workflow?.currentStepIndex, 1);
    assert.equal(snapshot.workflow?.resumableFromStep, "draft_solution");
    assert.equal(snapshot.workflow?.status, "failed");
    assert.equal(actions.at(-1)?.actionType, "set_current_step");
    assert.equal(payload.previousStepIndex, 2);
    assert.equal(payload.nextStepIndex, 1);
    assert.equal(payload.nextStepId, "draft_solution");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("human takeover can manually inject workflow step output without losing auditability", () => {
  const workspace = createTempWorkspace("aa-takeover-");

  try {
    const db = new SqliteDatabase(join(workspace, "write-step-output.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-write-step-1",
      executionId: "exec-write-step-1",
      traceId: "trace-write-step-1",
    });
    db.connection
      .prepare(`UPDATE executions SET workflow_id = ?, role_id = ? WHERE id = ?`)
      .run("single_division_multi_step_orchestration", "general_executor", "exec-write-step-1");
    seedWorkflowAndSession(db, store, {
      taskId: "task-write-step-1",
      sessionId: "sess-write-step-1",
      workflowId: "single_division_multi_step_orchestration",
      workflowStatus: "running",
      currentStepIndex: 1,
      outputsJson: JSON.stringify({
        triage: { summary: "triaged", result: "triaged" },
      }),
      resumableFromStep: "draft_solution",
      sessionStatus: "open",
    });

    const service = new HumanTakeoverService(db, store);
    const opened = service.openSession({
      taskId: "task-write-step-1",
      operatorId: "operator-6",
      reasonCode: "incident.manual_output",
    });
    service.writeStepOutput({
      takeoverSessionId: opened.takeoverSessionId,
      stepId: "draft_solution",
      outputJson: JSON.stringify({
        summary: "Manual draft restored",
        result: "Recovered draft output",
      }),
      reasonCode: "takeover.write_step_output",
      status: "succeeded",
    });

    const snapshot = store.loadTaskSnapshot("task-write-step-1");
    const inspect = new InspectService(store).getTaskInspectView("task-write-step-1");
    const outputs = JSON.parse(snapshot.workflow?.outputsJson ?? "{}") as Record<string, { result?: string; summary?: string }>;

    assert.equal(snapshot.workflow?.currentStepIndex, 1);
    assert.equal(snapshot.workflow?.resumableFromStep, "draft_solution");
    assert.equal(snapshot.stepOutputs.length, 1);
    assert.equal(snapshot.stepOutputs[0]?.stepId, "draft_solution");
    assert.equal(snapshot.stepOutputs[0]?.status, "succeeded");
    assert.equal(snapshot.stepOutputs[0]?.summary, "Manual draft restored");
    assert.equal(outputs.draft?.result, "Recovered draft output");
    assert.equal(inspect.operatorActions.at(-1)?.actionType, "write_step_output");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("human takeover can manually fail a task and preserve the audit trail", () => {
  const workspace = createTempWorkspace("aa-takeover-");

  try {
    const db = new SqliteDatabase(join(workspace, "complete.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-complete-1",
      executionId: "exec-complete-1",
      traceId: "trace-complete-1",
    });
    seedWorkflowAndSession(db, store, {
      taskId: "task-complete-1",
      sessionId: "sess-complete-1",
      workflowStatus: "running",
      sessionStatus: "open",
    });

    const service = new HumanTakeoverService(db, store);
    const opened = service.openSession({
      taskId: "task-complete-1",
      operatorId: "operator-4",
      reasonCode: "incident.fail_closed",
    });
    service.completeTask({
      takeoverSessionId: opened.takeoverSessionId,
      terminalStatus: "failed",
      reasonCode: "takeover.complete_task",
      outputJson: JSON.stringify({ reason: "manual termination" }),
    });

    const inspect = new InspectService(store).getTaskInspectView("task-complete-1");

    assert.equal(inspect.task.status, "failed");
    assert.equal(inspect.workflowState?.status, "failed");
    assert.equal(inspect.execution?.status, "failed");
    assert.equal(inspect.session?.status, "failed");
    assert.equal(inspect.operatorActions.at(-1)?.actionType, "complete_task");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("human takeover fail-closes on tenant scope mismatch", () => {
  const workspace = createTempWorkspace("aa-takeover-tenant-");

  try {
    const db = new SqliteDatabase(join(workspace, "takeover-tenant.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    store.insertTask({
      id: "task-takeover-tenant",
      parentId: null,
      rootId: "task-takeover-tenant",
      divisionId: "general_ops",
      title: "Tenant scoped takeover",
      source: "user",
      priority: "normal",
      status: "in_progress",
      inputJson: "{\"request\":\"repair\"}",
      normalizedInputJson: "{\"request\":\"repair\"}",
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      createdAt: "2026-04-08T10:00:00.000Z",
      updatedAt: "2026-04-08T10:00:00.000Z",
      completedAt: null,
      errorCode: null,
      tenantId: "tenant-a",
    });

    const service = new HumanTakeoverService(db, store);
    const opened = service.openSession({
      taskId: "task-takeover-tenant",
      operatorId: "operator-a",
      reasonCode: "takeover.open",
      tenantId: "tenant-a",
    });

    assert.throws(
      () =>
        service.modifyInput({
          takeoverSessionId: opened.takeoverSessionId,
          inputJson: "{\"request\":\"wrong tenant\"}",
          reasonCode: "takeover.modify_input",
          tenantId: "tenant-b",
        }),
      /takeover\.session_not_found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
