/**
 * E2E Scheduled Workflow Suspension Tests
 *
 * End-to-end tests covering long-running workflow suspension and resumption:
 * - Workflow can be suspended for various wait kinds (timer, human_input, etc.)
 * - Suspended workflows can be resumed when conditions are met
 * - Expired suspensions trigger appropriate timeout policies
 * - Resume windows are calculated correctly
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { LongRunningWorkflowService } from "../../src/platform/interface/scheduler/long-running-workflow-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-scheduled-workflow.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new LongRunningWorkflowService(store);

  return { workspace, db, store, service };
}

function seedWorkflowWithTask(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  executionId: string,
  workflowId: string,
  currentStepIndex: number = 0,
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "E2E scheduled workflow test",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: JSON.stringify({ request: "long running task" }),
      normalizedInputJson: JSON.stringify({ request: "long running task" }),
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
      workflowId,
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-scheduled",
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

    store.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId,
      currentStepIndex,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });
  });
}

test("E2E: workflow can be suspended for timer wait kind", () => {
  const h = createE2eHarness("e2e-suspend-timer-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "timer_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId);

    const suspension = h.service.suspend({
      taskId,
      executionId,
      reasonCode: "scheduled_maintenance",
      waitKind: "timer",
      resumableFromStep: "step_2",
      resumeAfter: "2026-04-24T00:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    assert.ok(suspension.suspensionId, "Should have suspension ID");
    assert.equal(suspension.taskId, taskId, "Task ID should match");
    assert.equal(suspension.status, "active", "Status should be active");
    assert.equal(suspension.waitKind, "timer", "Wait kind should be timer");
    assert.equal(suspension.resumableFromStep, "step_2", "Resumable from step should be step_2");
    assert.equal(suspension.timeoutPolicy, "remain_pending", "Timeout policy should be remain_pending");

    // Verify workflow is paused
    const workflow = h.store.getWorkflowState(taskId);
    assert.equal(workflow?.status, "paused", "Workflow should be paused");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: workflow can be suspended for human_input wait kind", () => {
  const h = createE2eHarness("e2e-suspend-human-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "approval_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId);

    const suspension = h.service.suspend({
      taskId,
      executionId,
      reasonCode: "awaiting_operator_approval",
      waitKind: "human_input",
      resumableFromStep: "approval_step",
      timeoutPolicy: "fail_workflow",
      metadata: { operatorId: "operator-42" },
    });

    assert.ok(suspension.suspensionId, "Should have suspension ID");
    assert.equal(suspension.waitKind, "human_input", "Wait kind should be human_input");
    assert.equal(suspension.timeoutPolicy, "fail_workflow", "Timeout policy should be fail_workflow");
    assert.deepEqual(suspension.metadata, { operatorId: "operator-42" }, "Metadata should be preserved");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: suspended workflow can be resumed when resume time is due", () => {
  const h = createE2eHarness("e2e-resume-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "resumable_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId);

    const suspension = h.service.suspend({
      taskId,
      executionId,
      reasonCode: "scheduled_pause",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-23T00:00:00.000Z", // Past date - should be due
      timeoutPolicy: "remain_pending",
    });

    const decision = h.service.resume(suspension.suspensionId);

    assert.equal(decision.allowed, true, "Resume should be allowed");
    assert.equal(decision.suspensionId, suspension.suspensionId, "Suspension ID should match");
    assert.equal(decision.nextWorkflowStatus, "resuming", "Next workflow status should be resuming");
    assert.equal(decision.resumableFromStep, "step_1", "Resumable from step should match");

    // Verify suspension is now resumable
    const updated = h.service.getSuspension(suspension.suspensionId);
    assert.equal(updated?.status, "resumable", "Suspension status should be resumable");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: resume is denied when resume time is not yet due", () => {
  const h = createE2eHarness("e2e-resume-not-due-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "future_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId);

    const futureResumeTime = "2099-01-01T00:00:00.000Z"; // Far future
    const suspension = h.service.suspend({
      taskId,
      executionId,
      reasonCode: "scheduled_future",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: futureResumeTime,
      timeoutPolicy: "remain_pending",
    });

    const decision = h.service.resume(suspension.suspensionId);

    assert.equal(decision.allowed, false, "Resume should not be allowed");
    assert.equal(decision.reasonCode, "workflow_sleep.resume_not_due", "Reason should be resume_not_due");
    assert.equal(decision.nextWorkflowStatus, null, "Next workflow status should be null");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: expired suspension triggers fail_workflow timeout policy", () => {
  const h = createE2eHarness("e2e-expire-fail-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "expiring_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId);

    const pastExpiry = "2020-01-01T00:00:00.000Z"; // Past date - already expired
    const suspension = h.service.suspend({
      taskId,
      executionId,
      reasonCode: "waiting_approval",
      waitKind: "human_input",
      resumableFromStep: "approval_step",
      expiresAt: pastExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const decisions = h.service.sweepExpired();

    assert.equal(decisions.length, 1, "Should have one expired suspension");
    const decision = decisions[0]!;
    assert.equal(decision.allowed, false, "Resume should not be allowed");
    assert.equal(decision.reasonCode, "workflow_sleep.expired_failed", "Reason should be expired_failed");
    assert.equal(decision.nextWorkflowStatus, "failed", "Next workflow status should be failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: expired suspension with remain_pending policy does not fail workflow", () => {
  const h = createE2eHarness("e2e-expire-remain-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "remain_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId);

    const pastExpiry = "2020-01-01T00:00:00.000Z";
    const suspension = h.service.suspend({
      taskId,
      executionId,
      reasonCode: "optional_input",
      waitKind: "human_input",
      resumableFromStep: "input_step",
      expiresAt: pastExpiry,
      timeoutPolicy: "remain_pending",
    });

    const decisions = h.service.sweepExpired();

    assert.equal(decisions.length, 1, "Should have one expired suspension");
    const decision = decisions[0]!;
    assert.equal(decision.allowed, false, "Resume should not be allowed");
    assert.equal(decision.reasonCode, "workflow_sleep.expired_remain_pending", "Reason should be expired_remain_pending");
    assert.equal(decision.nextWorkflowStatus, null, "Next workflow status should be null (workflow not failed)");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: markDue returns suspensions that are due", () => {
  const h = createE2eHarness("e2e-mark-due-");
  const taskId1 = newId("task1");
  const taskId2 = newId("task2");
  const executionId1 = newId("exec1");
  const executionId2 = newId("exec2");

  try {
    seedWorkflowWithTask(h.store, h.db, taskId1, executionId1, "workflow_1");
    seedWorkflowWithTask(h.store, h.db, taskId2, executionId2, "workflow_2");

    // Suspend first with past resume time
    h.service.suspend({
      taskId: taskId1,
      executionId: executionId1,
      reasonCode: "timer_1",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2020-01-01T00:00:00.000Z", // Past
      timeoutPolicy: "remain_pending",
    });

    // Suspend second with future resume time
    h.service.suspend({
      taskId: taskId2,
      executionId: executionId2,
      reasonCode: "timer_2",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2099-01-01T00:00:00.000Z", // Future
      timeoutPolicy: "remain_pending",
    });

    const due = h.service.markDue();

    assert.equal(due.length, 1, "Only one should be due");
    assert.equal(due[0]?.taskId, taskId1, "First task should be due");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: buildSleepLease returns correct lease structure", () => {
  const h = createE2eHarness("e2e-sleep-lease-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "lease_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId);

    const suspension = h.service.suspend({
      taskId,
      executionId,
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-24T00:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const lease = h.service.buildSleepLease(suspension.suspensionId);

    assert.equal(lease.suspensionId, suspension.suspensionId, "Suspension ID should match");
    assert.equal(lease.taskId, taskId, "Task ID should match");
    assert.equal(lease.workflowId, workflowId, "Workflow ID should match");
    assert.equal(lease.waitKind, "timer", "Wait kind should match");
    assert.equal(lease.status, "active", "Status should be active");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: buildResumeWindow returns correct window for due suspension", () => {
  const h = createE2eHarness("e2e-resume-window-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "window_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId);

    const suspension = h.service.suspend({
      taskId,
      executionId,
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2020-01-01T00:00:00.000Z", // Past - due
      expiresAt: "2026-12-31T00:00:00.000Z", // Future
      timeoutPolicy: "remain_pending",
    });

    const window = h.service.buildResumeWindow(suspension.suspensionId);

    assert.equal(window.suspensionId, suspension.suspensionId, "Suspension ID should match");
    assert.equal(window.taskId, taskId, "Task ID should match");
    assert.equal(window.due, true, "Should be due");
    assert.equal(window.expired, false, "Should not be expired");
    assert.equal(window.nextAction, "resume", "Next action should be resume");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: listSuspensions returns all active suspensions", () => {
  const h = createE2eHarness("e2e-list-suspensions-");
  const taskId1 = newId("task1");
  const taskId2 = newId("task2");
  const executionId1 = newId("exec1");
  const executionId2 = newId("exec2");

  try {
    seedWorkflowWithTask(h.store, h.db, taskId1, executionId1, "workflow_1");
    seedWorkflowWithTask(h.store, h.db, taskId2, executionId2, "workflow_2");

    h.service.suspend({
      taskId: taskId1,
      executionId: executionId1,
      reasonCode: "timer_1",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-24T00:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    h.service.suspend({
      taskId: taskId2,
      executionId: executionId2,
      reasonCode: "timer_2",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T00:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const suspensions = h.service.listSuspensions();

    assert.equal(suspensions.length, 2, "Should have 2 suspensions");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: suspension of terminal workflow throws error", () => {
  const h = createE2eHarness("e2e-suspend-terminal-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "terminal_workflow";

  try {
    seedWorkflowWithTask(h.store, h.db, taskId, executionId, workflowId, 3);

    // Complete the workflow
    h.db.transaction(() => {
      h.store.updateWorkflowState(
        taskId,
        "completed",
        3,
        JSON.stringify({ final: "done" }),
        nowIso(),
        null,
      );
    });

    // Attempt to suspend completed workflow should throw
    assert.throws(
      () => {
        h.service.suspend({
          taskId,
          executionId,
          reasonCode: "too_late",
          waitKind: "timer",
          resumableFromStep: "step_1",
          timeoutPolicy: "remain_pending",
        });
      },
      /workflow_sleep.terminal_workflow/,
      "Should throw for terminal workflow",
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
