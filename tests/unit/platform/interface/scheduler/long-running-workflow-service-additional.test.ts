/**
 * Unit tests for LongRunningWorkflowService additional methods and edge cases
 * Tests methods not covered in long-running-workflow-service.test.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { LongRunningWorkflowService } from "../../../../../src/platform/five-plane-interface/scheduler/long-running-workflow-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
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

test("LongRunningWorkflowService.getSuspension returns null for unknown id", () => {
  const h = createHarness("aa-get-susp-null-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_get_1", executionId: "exec_get_1" });
    h.store.insertWorkflowState({
      taskId: "task_get_1",
      divisionId: "general-ops",
      workflowId: "wf_get_1",
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
    const result = service.getSuspension("nonexistent_id");
    assert.equal(result, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.getSuspension returns suspension after suspend", () => {
  const h = createHarness("aa-get-susp-exist-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_get_2", executionId: "exec_get_2" });
    h.store.insertWorkflowState({
      taskId: "task_get_2",
      divisionId: "general-ops",
      workflowId: "wf_get_2",
      currentStepIndex: 2,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_get_2",
      executionId: "exec_get_2",
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "step_2",
      resumeAfter: "2026-04-25T12:00:00.000Z",
      expiresAt: "2026-04-25T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const result = service.getSuspension(suspension.suspensionId);
    assert.ok(result !== null);
    assert.equal(result!.suspensionId, suspension.suspensionId);
    assert.equal(result!.taskId, "task_get_2");
    assert.equal(result!.status, "active");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.listSuspensions returns all suspensions", () => {
  const h = createHarness("aa-list-susp-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_list_1", executionId: "exec_list_1" });
    seedTaskAndExecution(h.db, h.store, { taskId: "task_list_2", executionId: "exec_list_2" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_list_1",
      divisionId: "general-ops",
      workflowId: "wf_list_1",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    h.store.insertWorkflowState({
      taskId: "task_list_2",
      divisionId: "general-ops",
      workflowId: "wf_list_2",
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
    service.suspend({
      taskId: "task_list_1",
      executionId: "exec_list_1",
      reasonCode: "wait_1",
      waitKind: "timer",
      resumableFromStep: "step_a",
      resumeAfter: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.suspend({
      taskId: "task_list_2",
      executionId: "exec_list_2",
      reasonCode: "wait_2",
      waitKind: "human_input",
      resumableFromStep: "step_b",
      expiresAt: "2026-04-25T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const suspensions = service.listSuspensions();
    assert.equal(suspensions.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.listSuspensions returns empty when no suspensions", () => {
  const h = createHarness("aa-list-susp-empty-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_empty", executionId: "exec_empty" });
    h.store.insertWorkflowState({
      taskId: "task_empty",
      divisionId: "general-ops",
      workflowId: "wf_empty",
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
    const result = service.listSuspensions();
    assert.equal(result.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.suspend throws on terminal workflow with completed status", () => {
  const h = createHarness("aa-susp-terminal-completed-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_term_1", executionId: "exec_term_1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_term_1",
      divisionId: "general-ops",
      workflowId: "wf_term_1",
      currentStepIndex: 1,
      status: "completed",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    assert.throws(() => {
      service.suspend({
        taskId: "task_term_1",
        executionId: "exec_term_1",
        reasonCode: "should_fail",
        waitKind: "timer",
        resumableFromStep: "step_1",
        timeoutPolicy: "remain_pending",
      });
    }, /workflow_sleep\.terminal_workflow/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.suspend throws on terminal workflow with failed status", () => {
  const h = createHarness("aa-susp-terminal-failed-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_term_2", executionId: "exec_term_2" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_term_2",
      divisionId: "general-ops",
      workflowId: "wf_term_2",
      currentStepIndex: 1,
      status: "failed",
      outputsJson: JSON.stringify({}),
      lastErrorCode: "some_error",
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    assert.throws(() => {
      service.suspend({
        taskId: "task_term_2",
        executionId: "exec_term_2",
        reasonCode: "should_fail",
        waitKind: "timer",
        resumableFromStep: "step_1",
        timeoutPolicy: "remain_pending",
      });
    }, /workflow_sleep\.terminal_workflow/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.resume throws for unknown suspension id", () => {
  const h = createHarness("aa-resume-notfound-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_rnf", executionId: "exec_rnf" });
    h.store.insertWorkflowState({
      taskId: "task_rnf",
      divisionId: "general-ops",
      workflowId: "wf_rnf",
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
    assert.throws(() => {
      service.resume("nonexistent_suspension");
    }, /workflow_sleep\.suspension_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.resume returns not_allowed when resumeAfter is in future", () => {
  const h = createHarness("aa-resume-future-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_rf", executionId: "exec_rf" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_rf",
      divisionId: "general-ops",
      workflowId: "wf_rf",
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
      taskId: "task_rf",
      executionId: "exec_rf",
      reasonCode: "waiting",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2099-01-01T00:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const decision = service.resume(suspension.suspensionId, "2026-04-25T10:00:00.000Z");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "workflow_sleep.resume_not_due");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.sweepExpired does not expire non-expired suspensions", () => {
  const h = createHarness("aa-sweep-no-expire-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_sw_ne", executionId: "exec_sw_ne" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_sw_ne",
      divisionId: "general-ops",
      workflowId: "wf_sw_ne",
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
    service.suspend({
      taskId: "task_sw_ne",
      executionId: "exec_sw_ne",
      reasonCode: "long_wait",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2099-01-01T00:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const decisions = service.sweepExpired("2026-04-25T10:00:00.000Z");
    assert.equal(decisions.length, 0);

    const suspension = service.getSuspension(service.listSuspensions()[0]!.suspensionId);
    assert.equal(suspension!.status, "active");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.sweepExpired with remain_pending does not change workflow status", () => {
  const h = createHarness("aa-sweep-remain-pending-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_sw_rp", executionId: "exec_sw_rp" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_sw_rp",
      divisionId: "general-ops",
      workflowId: "wf_sw_rp",
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
      taskId: "task_sw_rp",
      executionId: "exec_sw_rp",
      reasonCode: "timeout_test",
      waitKind: "external_event",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const decisions = service.sweepExpired("2026-04-25T12:01:00.000Z");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]!.allowed, false);
    assert.equal(decisions[0]!.reasonCode, "workflow_sleep.expired_remain_pending");
    assert.equal(decisions[0]!.nextWorkflowStatus, null);

    const updatedSuspension = service.getSuspension(suspension.suspensionId);
    assert.equal(updatedSuspension!.status, "expired");

    assert.equal(h.store.getWorkflowState("task_sw_rp")?.status, "paused");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.resume updates suspension status to resumable", () => {
  const h = createHarness("aa-resume-status-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_rs", executionId: "exec_rs" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_rs",
      divisionId: "general-ops",
      workflowId: "wf_rs",
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
      taskId: "task_rs",
      executionId: "exec_rs",
      reasonCode: "ready_now",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.resume(suspension.suspensionId, "2026-04-25T10:30:00.000Z");

    const updated = service.getSuspension(suspension.suspensionId);
    assert.equal(updated!.status, "resumable");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.markDue does not mark non-active suspensions", () => {
  const h = createHarness("aa-mark-due-active-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_md", executionId: "exec_md" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_md",
      divisionId: "general-ops",
      workflowId: "wf_md",
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
      taskId: "task_md",
      executionId: "exec_md",
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.resume(suspension.suspensionId, "2026-04-25T12:30:00.000Z");

    const due = service.markDue("2026-04-25T12:30:00.000Z");
    const found = due.find(d => d.suspensionId === suspension.suspensionId);
    assert.equal(found, undefined);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.buildSleepLease throws for unknown suspension", () => {
  const h = createHarness("aa-lease-error-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_le", executionId: "exec_le" });
    h.store.insertWorkflowState({
      taskId: "task_le",
      divisionId: "general-ops",
      workflowId: "wf_le",
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
    assert.throws(() => {
      service.buildSleepLease("nonexistent_id");
    }, /workflow_sleep\.suspension_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.buildResumeWindow throws for unknown suspension", () => {
  const h = createHarness("aa-window-error-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_win", executionId: "exec_win" });
    h.store.insertWorkflowState({
      taskId: "task_win",
      divisionId: "general-ops",
      workflowId: "wf_win",
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
    assert.throws(() => {
      service.buildResumeWindow("nonexistent_id");
    }, /workflow_sleep\.suspension_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService emits workflow:suspended event on suspend", () => {
  const h = createHarness("aa-event-suspend-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_ev_s", executionId: "exec_ev_s" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_ev_s",
      divisionId: "general-ops",
      workflowId: "wf_ev_s",
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
    service.suspend({
      taskId: "task_ev_s",
      executionId: "exec_ev_s",
      reasonCode: "test_event",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    const events = h.store.listEventsForTask("task_ev_s");
    const suspendedEvent = events.find(e => e.eventType === "workflow:suspended");
    assert.ok(suspendedEvent !== undefined);
    assert.ok(suspendedEvent!.payloadJson.includes("test_event"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService emits workflow:resume_requested event on successful resume", () => {
  const h = createHarness("aa-event-resume-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_ev_r", executionId: "exec_ev_r" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_ev_r",
      divisionId: "general-ops",
      workflowId: "wf_ev_r",
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
      taskId: "task_ev_r",
      executionId: "exec_ev_r",
      reasonCode: "test_event",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.resume(suspension.suspensionId, "2026-04-25T10:30:00.000Z");

    const events = h.store.listEventsForTask("task_ev_r");
    const resumeEvent = events.find(e => e.eventType === "workflow:resume_requested");
    assert.ok(resumeEvent !== undefined);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService emits workflow:suspension_expired on sweep expiration", () => {
  const h = createHarness("aa-event-expire-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_ev_e", executionId: "exec_ev_e" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_ev_e",
      divisionId: "general-ops",
      workflowId: "wf_ev_e",
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
    service.suspend({
      taskId: "task_ev_e",
      executionId: "exec_ev_e",
      reasonCode: "expire_test",
      waitKind: "external_event",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    service.sweepExpired("2026-04-25T12:01:00.000Z");

    const events = h.store.listEventsForTask("task_ev_e");
    const expireEvent = events.find(e => e.eventType === "workflow:suspension_expired");
    assert.ok(expireEvent !== undefined);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
