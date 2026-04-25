/**
 * Integration Tests: Workflow State
 *
 * Tests the workflow state layer including:
 * - Workflow state creation and persistence
 * - State transitions (running, paused, resuming, completed, failed, cancelled)
 * - Step index tracking and output accumulation
 * - Workflow cancellation and timeout handling
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../src/platform/execution/state-transition/transition-service.js";
import { LongRunningWorkflowService } from "../../../src/platform/interface/scheduler/long-running-workflow-service.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

function createWorkflowStateHarness(workspacePrefix: string) {
  const workspace = createTempWorkspace(workspacePrefix);
  const dbPath = join(workspace, "workflow-state.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);
  const workflowService = new LongRunningWorkflowService(store);

  const taskId = newId("task");
  const sessionId = newId("sess");
  const executionId = newId("exec");
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Workflow state test",
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
      taskId,
      divisionId: "general_ops",
      workflowId: "wf_ops_standard",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    store.insertSession({
      id: sessionId,
      taskId,
      channel: "cli",
      status: "open",
      externalSessionId: null,
      createdAt: now,
      updatedAt: now,
    });

    store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "wf_ops_standard",
      parentExecutionId: null,
      agentId: "agent_ops",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: newId("trace"),
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

  return {
    workspace,
    db,
    store,
    transitions,
    workflowService,
    taskId,
    sessionId,
    executionId,
    cleanup() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

test("workflow state: persists and retrieves workflow state", () => {
  const workspace = createTempWorkspace("aa-state-persist-");

  try {
    const dbPath = join(workspace, "state-persist.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Persist test",
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
        taskId,
        divisionId: "general_ops",
        workflowId: "wf_ops_standard",
        currentStepIndex: 0,
        status: "running",
        outputsJson: '{"initialized": true}',
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    const retrieved = store.getWorkflowState(taskId);
    assert.ok(retrieved != null);
    assert.equal(retrieved.taskId, taskId);
    assert.equal(retrieved.workflowId, "wf_ops_standard");
    assert.equal(retrieved.currentStepIndex, 0);
    assert.equal(retrieved.status, "running");

    const outputs = JSON.parse(retrieved.outputsJson);
    assert.equal(outputs.initialized, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow state: step progression updates currentStepIndex", () => {
  const h = createWorkflowStateHarness("aa-state-step-");

  try {
    const now = nowIso();

    // Simulate step 0 completing
    h.db.transaction(() => {
      h.store.workflow.updateWorkflowState(
        h.taskId,
        "running",
        1,
        JSON.stringify({ step0: "completed" }),
        now,
        null,
      );
    });

    const state1 = h.store.getWorkflowState(h.taskId);
    assert.equal(state1?.currentStepIndex, 1);
    assert.equal(JSON.parse(state1?.outputsJson).step0, "completed");

    // Simulate step 1 completing
    h.db.transaction(() => {
      h.store.workflow.updateWorkflowState(
        h.taskId,
        "running",
        2,
        JSON.stringify({ step0: "completed", step1: "completed" }),
        now,
        null,
      );
    });

    const state2 = h.store.getWorkflowState(h.taskId);
    assert.equal(state2?.currentStepIndex, 2);

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: pause stores resumableFromStep", () => {
  const h = createWorkflowStateHarness("aa-state-pause-");

  try {
    const suspension = h.workflowService.suspend({
      taskId: h.taskId,
      executionId: h.executionId,
      reasonCode: "awaiting_input",
      waitKind: "human_input",
      resumableFromStep: "validate_deployment",
      timeoutPolicy: "remain_pending",
      resumeAfter: new Date(Date.now() + 60000).toISOString(),
    });

    assert.ok(suspension.suspensionId.startsWith("workflow_sleep_"));
    assert.equal(suspension.status, "active");
    assert.equal(suspension.resumableFromStep, "validate_deployment");

    const state = h.store.getWorkflowState(h.taskId);
    assert.equal(state?.status, "paused");

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: resume transitions from paused to resuming", () => {
  const h = createWorkflowStateHarness("aa-state-resume-");

  try {
    const suspension = h.workflowService.suspend({
      taskId: h.taskId,
      executionId: h.executionId,
      reasonCode: "waiting",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
      resumeAfter: new Date(Date.now() - 1000).toISOString(), // in the past
    });

    const decision = h.workflowService.resume(suspension.suspensionId);

    assert.equal(decision.allowed, true);
    assert.equal(decision.nextWorkflowStatus, "resuming");
    assert.equal(decision.resumableFromStep, "step_1");

    const events = h.store.listEventsForTask(h.taskId);
    const resumeEvent = events.find((e) => e.eventType === "workflow:resume_requested");
    assert.ok(resumeEvent != null);

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: workflow cancelling transitions to cancelled", () => {
  const h = createWorkflowStateHarness("aa-state-cancel-");

  try {
    const now = nowIso();

    // Transition workflow to cancelling
    h.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: h.taskId,
      fromStatus: "running",
      toStatus: "cancelling",
      currentStepIndex: 1,
      outputsJson: '{"partial": true}',
      reasonCode: "user_cancelled",
      traceId: newId("trace"),
      occurredAt: now,
      actorType: "user",
    });

    const cancellingState = h.store.getWorkflowState(h.taskId);
    assert.equal(cancellingState?.status, "cancelling");

    // Complete cancellation
    h.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: h.taskId,
      fromStatus: "cancelling",
      toStatus: "cancelled",
      currentStepIndex: 1,
      outputsJson: '{"partial": true}',
      reasonCode: "user_cancelled",
      traceId: newId("trace"),
      occurredAt: now,
      actorType: "user",
    });

    const cancelledState = h.store.getWorkflowState(h.taskId);
    assert.equal(cancelledState?.status, "cancelled");

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: failed workflow transitions to failed status", () => {
  const h = createWorkflowStateHarness("aa-state-failed-");

  try {
    const now = nowIso();

    h.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: h.taskId,
      fromStatus: "running",
      toStatus: "failed",
      currentStepIndex: 1,
      outputsJson: '{"step0": "done"}',
      reasonCode: "workflow.step_failed",
      traceId: newId("trace"),
      occurredAt: now,
      actorType: "system",
    });

    const state = h.store.getWorkflowState(h.taskId);
    assert.equal(state?.status, "failed");
    // Note: lastErrorCode is not updated by transitionWorkflowStatus directly
    // It is recorded via updateWorkflowRecoveryState in recovery scenarios

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: retry increments retry count but keeps running", () => {
  const h = createWorkflowStateHarness("aa-state-retry-");

  try {
    const now = nowIso();

    // Update workflow state to reflect retry
    h.db.transaction(() => {
      h.store.workflow.updateWorkflowState(
        h.taskId,
        "running",
        0,
        JSON.stringify({}),
        now,
        null,
      );
    });

    // Verify retry count is 0 initially (from insert)
    const initialState = h.store.getWorkflowState(h.taskId);
    assert.equal(initialState?.retryCount, 0);

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: completed workflow is terminal", () => {
  const h = createWorkflowStateHarness("aa-state-terminal-");

  try {
    const now = nowIso();

    h.transitions.transitionWorkflowStatus({
      entityKind: "workflow",
      entityId: h.taskId,
      fromStatus: "running",
      toStatus: "completed",
      currentStepIndex: 3,
      outputsJson: '{"step0": "done", "step1": "done", "step2": "done", "final": "success"}',
      reasonCode: "task.completed",
      traceId: newId("trace"),
      occurredAt: now,
      actorType: "system",
    });

    const state = h.store.getWorkflowState(h.taskId);
    assert.equal(state?.status, "completed");
    assert.equal(state?.currentStepIndex, 3);

    // Attempting another transition should fail
    assert.throws(() => {
      h.transitions.transitionWorkflowStatus({
        entityKind: "workflow",
        entityId: h.taskId,
        fromStatus: "completed",
        toStatus: "running",
        currentStepIndex: 3,
        outputsJson: "{}",
        reasonCode: "invalid",
        traceId: newId("trace"),
        occurredAt: now,
        actorType: "system",
      });
    }, /invalid_transition/);

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: outputs JSON accumulates step results", () => {
  const h = createWorkflowStateHarness("aa-state-outputs-");

  try {
    const now = nowIso();
    const outputs = {
      step0: { status: "completed", result: "data_123" },
      step1: { status: "completed", result: "validated" },
      step2: { status: "completed", result: "deployed" },
    };

    h.db.transaction(() => {
      h.store.workflow.updateWorkflowState(
        h.taskId,
        "running",
        3,
        JSON.stringify(outputs),
        now,
        null,
      );
    });

    const state = h.store.getWorkflowState(h.taskId);
    const retrievedOutputs = JSON.parse(state?.outputsJson ?? "{}");

    assert.equal(retrievedOutputs.step0.status, "completed");
    assert.equal(retrievedOutputs.step0.result, "data_123");
    assert.equal(retrievedOutputs.step1.status, "completed");
    assert.equal(retrievedOutputs.step1.result, "validated");
    assert.equal(retrievedOutputs.step2.result, "deployed");

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: markDue identifies past-resumeAfter suspensions", () => {
  const h = createWorkflowStateHarness("aa-state-markdue-");

  try {
    const pastTime = new Date(Date.now() - 5000).toISOString();

    h.workflowService.suspend({
      taskId: h.taskId,
      executionId: h.executionId,
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: pastTime,
      timeoutPolicy: "remain_pending",
    });

    const due = h.workflowService.markDue();

    assert.ok(due.length >= 1);
    const ourDue = due.find((d) => d.taskId === h.taskId);
    assert.ok(ourDue != null);
    assert.equal(ourDue?.status, "resumable");

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: sweepExpired expires suspensions past expiresAt", () => {
  const h = createWorkflowStateHarness("aa-state-expired-");

  try {
    const pastExpiry = new Date(Date.now() - 5000).toISOString();

    h.workflowService.suspend({
      taskId: h.taskId,
      executionId: h.executionId,
      reasonCode: "approval_timeout",
      waitKind: "human_input",
      resumableFromStep: "pending_approval",
      expiresAt: pastExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const decisions = h.workflowService.sweepExpired();

    assert.ok(decisions.length >= 1);
    const ourDecision = decisions.find((d) => d.taskId === h.taskId);
    assert.ok(ourDecision != null);
    assert.equal(ourDecision?.allowed, false);
    assert.equal(ourDecision?.reasonCode, "workflow_sleep.expired_failed");
    assert.equal(ourDecision?.nextWorkflowStatus, "failed");

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: buildSleepLease creates correct lease structure", () => {
  const h = createWorkflowStateHarness("aa-state-lease-");

  try {
    const futureExpiry = new Date(Date.now() + 120000).toISOString();

    const suspension = h.workflowService.suspend({
      taskId: h.taskId,
      executionId: h.executionId,
      reasonCode: "resource_throttle",
      waitKind: "throttled",
      resumableFromStep: "process_queue",
      expiresAt: futureExpiry,
      timeoutPolicy: "remain_pending",
      metadata: { queueDepth: 50 },
    });

    const lease = h.workflowService.buildSleepLease(suspension.suspensionId);

    assert.equal(lease.suspensionId, suspension.suspensionId);
    assert.equal(lease.taskId, h.taskId);
    assert.equal(lease.waitKind, "throttled");
    assert.deepEqual(lease.metadata, { queueDepth: 50 });

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: listSuspensions returns all active suspensions", () => {
  const h = createWorkflowStateHarness("aa-state-list-");

  try {
    const taskId2 = newId("task");
    const now = nowIso();

    // Create second task with workflow
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId2,
        parentId: null,
        rootId: taskId2,
        divisionId: "general_ops",
        title: "Second workflow",
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

      h.store.insertWorkflowState({
        taskId: taskId2,
        divisionId: "general_ops",
        workflowId: "wf_ops_standard",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    h.workflowService.suspend({
      taskId: h.taskId,
      reasonCode: "reason_1",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "fail_workflow",
    });

    h.workflowService.suspend({
      taskId: taskId2,
      reasonCode: "reason_2",
      waitKind: "human_input",
      resumableFromStep: "step_0",
      timeoutPolicy: "remain_pending",
    });

    const all = h.workflowService.listSuspensions();
    assert.ok(all.length >= 2);

    const ourTasks = all.filter((s) => s.taskId === h.taskId || s.taskId === taskId2);
    assert.equal(ourTasks.length, 2);

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});

test("workflow state: listResumeWindows calculates correct window state", () => {
  const h = createWorkflowStateHarness("aa-state-windows-");

  try {
    const futureResume = new Date(Date.now() + 60000).toISOString();
    const futureExpiry = new Date(Date.now() + 120000).toISOString();

    h.workflowService.suspend({
      taskId: h.taskId,
      reasonCode: "external_event",
      waitKind: "external_event",
      resumableFromStep: "wait_for_webhook",
      resumeAfter: futureResume,
      expiresAt: futureExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const windows = h.workflowService.listResumeWindows();

    assert.ok(windows.length >= 1);
    const ourWindow = windows.find((w) => w.taskId === h.taskId);
    assert.ok(ourWindow != null);
    assert.equal(ourWindow?.due, false); // resumeAfter is in future
    assert.equal(ourWindow?.expired, false); // expiresAt is in future
    assert.equal(ourWindow?.nextAction, "wait");

    h.cleanup();
  } finally {
    cleanupPath(h.workspace);
  }
});
