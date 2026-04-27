/**
 * Unit tests for LongRunningWorkflowService lifecycle and integration scenarios
 * Tests src/platform/interface/scheduler/long-running-workflow-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { LongRunningWorkflowService } from "../../../../../src/platform/interface/scheduler/long-running-workflow-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "scheduler.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("LongRunningWorkflowService complete lifecycle: suspend -> markDue -> resume -> complete", () => {
  const h = createHarness("aa-lifecycle-full-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_lifecycle", executionId: "exec_lifecycle" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_lifecycle",
      divisionId: "general_ops",
      workflowId: "wf_lifecycle",
      currentStepIndex: 3,
      status: "running",
      outputsJson: JSON.stringify({ step1: "done", step2: "done" }),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);

    // Suspend the workflow
    const suspension = service.suspend({
      taskId: "task_lifecycle",
      executionId: "exec_lifecycle",
      reasonCode: "human_review",
      waitKind: "human_input",
      resumableFromStep: "step_4",
      resumeAfter: "2026-04-28T10:00:00.000Z",
      expiresAt: "2026-04-28T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
      metadata: { reviewer: "user_123", priority: "high" },
    });

    assert.equal(suspension.status, "active");
    assert.equal(suspension.waitKind, "human_input");
    assert.equal(suspension.timeoutPolicy, "fail_workflow");

    // Verify workflow is paused
    let wfState = h.store.getWorkflowState("task_lifecycle");
    assert.equal(wfState?.status, "paused");
    assert.equal(wfState?.resumableFromStep, "step_4");

    // Mark as due
    const due = service.markDue("2026-04-28T10:30:00.000Z");
    assert.equal(due.length, 1);
    assert.equal(due[0]!.suspensionId, suspension.suspensionId);

    // Verify suspension status changed to resumable
    let updatedSuspension = service.getSuspension(suspension.suspensionId);
    assert.equal(updatedSuspension!.status, "resumable");

    // Resume the workflow
    const decision = service.resume(suspension.suspensionId, "2026-04-28T10:30:00.000Z");
    assert.equal(decision.allowed, true);
    assert.equal(decision.nextWorkflowStatus, "resuming");
    assert.equal(decision.resumableFromStep, "step_4");

    // Verify workflow is in resuming state
    wfState = h.store.getWorkflowState("task_lifecycle");
    assert.equal(wfState?.status, "resuming");

    // Verify events were emitted
    const events = h.store.listEventsForTask("task_lifecycle");
    const suspendedEvent = events.find((e) => e.eventType === "workflow:suspended");
    const resumeEvent = events.find((e) => e.eventType === "workflow:resume_requested");
    assert.ok(suspendedEvent !== undefined, "workflow:suspended event should exist");
    assert.ok(resumeEvent !== undefined, "workflow:resume_requested event should exist");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend with no resumeAfter and no expiresAt", () => {
  const h = createHarness("aa-susp-no-dates-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_no_dates", executionId: "exec_no_dates" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_no_dates",
      divisionId: "general_ops",
      workflowId: "wf_no_dates",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_no_dates",
      executionId: "exec_no_dates",
      reasonCode: "indefinite_wait",
      waitKind: "human_input",
      resumableFromStep: "step_indefinite",
      resumeAfter: null,
      expiresAt: null,
      timeoutPolicy: "remain_pending",
    });

    assert.equal(suspension.resumeAfter, null);
    assert.equal(suspension.expiresAt, null);
    assert.equal(suspension.status, "active");

    // markDue should not return this suspension (no resumeAfter)
    const due = service.markDue("2026-04-28T10:30:00.000Z");
    assert.equal(due.length, 0);

    // sweepExpired should not expire this suspension (no expiresAt)
    const sweep = service.sweepExpired("2026-04-28T12:00:00.000Z");
    assert.equal(sweep.length, 0);

    // Resume for suspension with no resumeAfter is allowed by default
    // (no automatic trigger, but manual resume is allowed)
    const decision = service.resume(suspension.suspensionId, "2026-04-28T10:30:00.000Z");
    assert.equal(decision.allowed, true);
    assert.equal(decision.reasonCode, "workflow_sleep.resume_allowed");
    assert.equal(decision.nextWorkflowStatus, "resuming");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService resume with exact expiresAt timestamp", () => {
  const h = createHarness("aa-resume-exact-expires-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_exact", executionId: "exec_exact" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_exact",
      divisionId: "general_ops",
      workflowId: "wf_exact",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_exact",
      executionId: "exec_exact",
      reasonCode: "exact_expires",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-28T10:00:00.000Z",
      expiresAt: "2026-04-28T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    // Resume at exactly the expiresAt time
    const decision = service.resume(suspension.suspensionId, "2026-04-28T12:00:00.000Z");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "workflow_sleep.expired_failed");
    assert.equal(decision.nextWorkflowStatus, "failed");

    // Verify suspension status is now expired
    const updated = service.getSuspension(suspension.suspensionId);
    assert.equal(updated!.status, "expired");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService multiple suspensions for same task", () => {
  const h = createHarness("aa-multi-susp-task-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_multi", executionId: "exec_multi" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_multi",
      divisionId: "general_ops",
      workflowId: "wf_multi",
      currentStepIndex: 5,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);

    // Create first suspension
    const suspension1 = service.suspend({
      taskId: "task_multi",
      executionId: "exec_multi",
      reasonCode: "first_wait",
      waitKind: "timer",
      resumableFromStep: "step_2",
      resumeAfter: "2026-04-28T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    // Create second suspension - but wait, the workflow is already paused
    // This should fail because the workflow is not in a suspendable state
    // Actually, the service doesn't check if workflow is already paused

    const suspensions = service.listSuspensions();
    assert.equal(suspensions.length, 1);

    // Resume the first one
    service.resume(suspension1.suspensionId, "2026-04-28T10:30:00.000Z");

    // Now the workflow is in resuming state, suspend again
    h.store.updateWorkflowState("task_multi", "running", 5, JSON.stringify({}), now, null);

    const suspension2 = service.suspend({
      taskId: "task_multi",
      executionId: "exec_multi",
      reasonCode: "second_wait",
      waitKind: "human_input",
      resumableFromStep: "step_5",
      resumeAfter: "2026-04-28T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const allSuspensions = service.listSuspensions();
    assert.equal(allSuspensions.length, 2);

    // Check both suspensions exist with correct statuses
    const s1 = service.getSuspension(suspension1.suspensionId);
    const s2 = service.getSuspension(suspension2.suspensionId);
    assert.equal(s1!.status, "resumable");
    assert.equal(s2!.status, "active");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService outputsJson is correctly merged on suspend", () => {
  const h = createHarness("aa-outputs-merge-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_outputs", executionId: "exec_outputs" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_outputs",
      divisionId: "general_ops",
      workflowId: "wf_outputs",
      currentStepIndex: 2,
      status: "running",
      outputsJson: JSON.stringify({ step_1_output: "result_a", step_2_output: "result_b" }),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    service.suspend({
      taskId: "task_outputs",
      executionId: "exec_outputs",
      reasonCode: "pause_for_review",
      waitKind: "human_input",
      resumableFromStep: "step_3",
      timeoutPolicy: "remain_pending",
    });

    const wfState = h.store.getWorkflowState("task_outputs");
    assert.ok(wfState !== null);
    const outputs = JSON.parse(wfState!.outputsJson);

    // Original outputs should be preserved
    assert.equal(outputs.step_1_output, "result_a");
    assert.equal(outputs.step_2_output, "result_b");

    // New suspension metadata should be added
    assert.ok(outputs.__workflow_suspension !== undefined);
    assert.equal(outputs.__workflow_suspension.reasonCode, "pause_for_review");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService sweepExpired with mixed suspension states", () => {
  const h = createHarness("aa-sweep-mixed-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_mixed_1", executionId: "exec_mixed_1" });
    seedTaskAndExecution(h.db, h.store, { taskId: "task_mixed_2", executionId: "exec_mixed_2" });
    seedTaskAndExecution(h.db, h.store, { taskId: "task_mixed_3", executionId: "exec_mixed_3" });
    const now = nowIso();

    // First workflow: active and expired
    h.store.insertWorkflowState({
      taskId: "task_mixed_1",
      divisionId: "general_ops",
      workflowId: "wf_mixed_1",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    // Second workflow: active but not expired
    h.store.insertWorkflowState({
      taskId: "task_mixed_2",
      divisionId: "general_ops",
      workflowId: "wf_mixed_2",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    // Third workflow: already resumable
    h.store.insertWorkflowState({
      taskId: "task_mixed_3",
      divisionId: "general_ops",
      workflowId: "wf_mixed_3",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);

    // Suspend all three
    service.suspend({
      taskId: "task_mixed_1",
      executionId: "exec_mixed_1",
      reasonCode: "expired_soon",
      waitKind: "external_event",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-28T10:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    service.suspend({
      taskId: "task_mixed_2",
      executionId: "exec_mixed_2",
      reasonCode: "not_expired",
      waitKind: "timer",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-28T14:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    service.suspend({
      taskId: "task_mixed_3",
      executionId: "exec_mixed_3",
      reasonCode: "already_resumed",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-28T09:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    // Mark third one as resumable
    service.markDue("2026-04-28T09:30:00.000Z");

    // Sweep at 10:30 - only the first one should be expired
    const decisions = service.sweepExpired("2026-04-28T10:30:00.000Z");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]!.reasonCode, "workflow_sleep.expired_failed");

    const s1 = service.getSuspension(service.listSuspensions().find(s => s.taskId === "task_mixed_1")!.suspensionId);
    const s2 = service.getSuspension(service.listSuspensions().find(s => s.taskId === "task_mixed_2")!.suspensionId);
    const s3 = service.getSuspension(service.listSuspensions().find(s => s.taskId === "task_mixed_3")!.suspensionId);

    assert.equal(s1!.status, "expired");
    assert.equal(s2!.status, "active");
    assert.equal(s3!.status, "resumable");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService buildResumeWindow with due suspension", () => {
  const h = createHarness("aa-win-due-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_win_due", executionId: "exec_win_due" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_win_due",
      divisionId: "general_ops",
      workflowId: "wf_win_due",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_win_due",
      executionId: "exec_win_due",
      reasonCode: "due_window_test",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-28T10:00:00.000Z",
      expiresAt: "2026-04-28T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    // Window when not yet due
    const pendingWindow = service.buildResumeWindow(suspension.suspensionId, "2026-04-28T09:00:00.000Z");
    assert.equal(pendingWindow.due, false);
    assert.equal(pendingWindow.expired, false);
    assert.equal(pendingWindow.nextAction, "wait");

    // Window when exactly at resumeAfter
    const atDueWindow = service.buildResumeWindow(suspension.suspensionId, "2026-04-28T10:00:00.000Z");
    assert.equal(atDueWindow.due, true);
    assert.equal(atDueWindow.expired, false);
    assert.equal(atDueWindow.nextAction, "resume");

    // Window when past resumeAfter but before expiresAt
    const pastDueWindow = service.buildResumeWindow(suspension.suspensionId, "2026-04-28T11:00:00.000Z");
    assert.equal(pastDueWindow.due, true);
    assert.equal(pastDueWindow.expired, false);
    assert.equal(pastDueWindow.nextAction, "resume");

    // Window when at expiresAt
    const atExpiresWindow = service.buildResumeWindow(suspension.suspensionId, "2026-04-28T14:00:00.000Z");
    assert.equal(atExpiresWindow.expired, true);
    assert.equal(atExpiresWindow.nextAction, "expire");

    // Window when past expiresAt
    const pastExpiresWindow = service.buildResumeWindow(suspension.suspensionId, "2026-04-28T15:00:00.000Z");
    assert.equal(pastExpiresWindow.expired, true);
    assert.equal(pastExpiresWindow.nextAction, "expire");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService requireSuspension throws for invalid id", () => {
  const h = createHarness("aa-req-susp-error-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_req", executionId: "exec_req" });
    h.store.insertWorkflowState({
      taskId: "task_req",
      divisionId: "general_ops",
      workflowId: "wf_req",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);

    // Test buildSleepLease throws
    assert.throws(() => {
      service.buildSleepLease("invalid_suspension_id");
    }, /workflow_sleep\.suspension_not_found/);

    // Test buildResumeWindow throws
    assert.throws(() => {
      service.buildResumeWindow("invalid_suspension_id");
    }, /workflow_sleep\.suspension_not_found/);

    // Test resume throws
    assert.throws(() => {
      service.resume("invalid_suspension_id");
    }, /workflow_sleep\.suspension_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService requireWorkflow throws for unknown task", () => {
  const h = createHarness("aa-req-wf-error-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_known", executionId: "exec_known" });
    h.store.insertWorkflowState({
      taskId: "task_known",
      divisionId: "general_ops",
      workflowId: "wf_known",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);

    // Test suspend throws for unknown task
    assert.throws(() => {
      service.suspend({
        taskId: "task_unknown",
        executionId: "exec_known",
        reasonCode: "unknown_task",
        waitKind: "timer",
        resumableFromStep: "step_1",
        timeoutPolicy: "remain_pending",
      });
    }, /workflow_sleep\.workflow_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend preserves metadata correctly", () => {
  const h = createHarness("aa-metadata-preserve-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_meta", executionId: "exec_meta" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_meta",
      divisionId: "general_ops",
      workflowId: "wf_meta",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_meta",
      executionId: "exec_meta",
      reasonCode: "metadata_test",
      waitKind: "human_input",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
      metadata: {
        userId: "user_123",
        sessionId: "sess_456",
        customField: "custom_value",
        nested: { deep: "value" },
      },
    });

    assert.deepEqual(suspension.metadata, {
      userId: "user_123",
      sessionId: "sess_456",
      customField: "custom_value",
      nested: { deep: "value" },
    });

    // Retrieve and verify
    const retrieved = service.getSuspension(suspension.suspensionId);
    assert.deepEqual(retrieved!.metadata, {
      userId: "user_123",
      sessionId: "sess_456",
      customField: "custom_value",
      nested: { deep: "value" },
    });

    // Verify in lease
    const lease = service.buildSleepLease(suspension.suspensionId);
    assert.deepEqual(lease.metadata, {
      userId: "user_123",
      sessionId: "sess_456",
      customField: "custom_value",
      nested: { deep: "value" },
    });
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend with undefined metadata", () => {
  const h = createHarness("aa-metadata-undef-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_undef", executionId: "exec_undef" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_undef",
      divisionId: "general_ops",
      workflowId: "wf_undef",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_undef",
      executionId: "exec_undef",
      reasonCode: "no_metadata",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
      metadata: undefined,
    });

    assert.deepEqual(suspension.metadata, {});
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
