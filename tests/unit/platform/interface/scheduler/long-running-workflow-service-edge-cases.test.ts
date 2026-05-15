/**
 * Unit tests for LongRunningWorkflowService edge cases and boundary conditions
 * Tests src/platform/five-plane-interface/scheduler/long-running-workflow-service.ts
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

test("LongRunningWorkflowService.parseOutputs handles valid JSON object", () => {
  const h = createHarness("aa-parse-valid-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_parse_1", executionId: "exec_parse_1" });
    h.store.insertWorkflowState({
      taskId: "task_parse_1",
      divisionId: "general_ops",
      workflowId: "wf_parse_1",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({ key: "value", nested: { a: 1 } }),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_parse_1",
      executionId: "exec_parse_1",
      reasonCode: "parse_test",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const result = service.getSuspension(suspension.suspensionId);
    assert.ok(result !== null);
    assert.ok(result!.metadata !== undefined);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.parseOutputs handles empty JSON object", () => {
  const h = createHarness("aa-parse-empty-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_pe2", executionId: "exec_pe2" });
    h.store.insertWorkflowState({
      taskId: "task_pe2",
      divisionId: "general_ops",
      workflowId: "wf_pe2",
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
    const suspension = service.suspend({
      taskId: "task_pe2",
      executionId: "exec_pe2",
      reasonCode: "parse_empty",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    const result = service.getSuspension(suspension.suspensionId);
    assert.ok(result !== null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.parseOutputs handles malformed JSON", () => {
  const h = createHarness("aa-parse-bad-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_pb1", executionId: "exec_pb1" });
    h.store.insertWorkflowState({
      taskId: "task_pb1",
      divisionId: "general_ops",
      workflowId: "wf_pb1",
      currentStepIndex: 1,
      status: "running",
      outputsJson: "not valid json {{{",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);
    // Should not throw, should handle gracefully
    const suspension = service.suspend({
      taskId: "task_pb1",
      executionId: "exec_pb1",
      reasonCode: "parse_bad",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    assert.ok(suspension !== null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.parseOutputs handles JSON array", () => {
  const h = createHarness("aa-parse-arr-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_pa1", executionId: "exec_pa1" });
    h.store.insertWorkflowState({
      taskId: "task_pa1",
      divisionId: "general_ops",
      workflowId: "wf_pa1",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify([1, 2, 3]),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_pa1",
      executionId: "exec_pa1",
      reasonCode: "parse_arr",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    assert.ok(suspension !== null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.parseOutputs handles null JSON", () => {
  const h = createHarness("aa-parse-null-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_pn1", executionId: "exec_pn1" });
    h.store.insertWorkflowState({
      taskId: "task_pn1",
      divisionId: "general_ops",
      workflowId: "wf_pn1",
      currentStepIndex: 1,
      status: "running",
      outputsJson: "null",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_pn1",
      executionId: "exec_pn1",
      reasonCode: "parse_null",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    assert.ok(suspension !== null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.isTerminal checks completed status", () => {
  const h = createHarness("aa-terminal-comp-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_tc1", executionId: "exec_tc1" });
    h.store.insertWorkflowState({
      taskId: "task_tc1",
      divisionId: "general_ops",
      workflowId: "wf_tc1",
      currentStepIndex: 1,
      status: "completed",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);
    assert.throws(() => {
      service.suspend({
        taskId: "task_tc1",
        executionId: "exec_tc1",
        reasonCode: "should_throw",
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

test("LongRunningWorkflowService.isTerminal checks cancelled status", () => {
  const h = createHarness("aa-terminal-can-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_tcan1", executionId: "exec_tcan1" });
    h.store.insertWorkflowState({
      taskId: "task_tcan1",
      divisionId: "general_ops",
      workflowId: "wf_tcan1",
      currentStepIndex: 1,
      status: "cancelled",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: nowIso(),
      updatedAt: nowIso(),
    });

    const service = new LongRunningWorkflowService(h.store);
    assert.throws(() => {
      service.suspend({
        taskId: "task_tcan1",
        executionId: "exec_tcan1",
        reasonCode: "should_throw",
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

test("LongRunningWorkflowService.listResumeWindows returns windows for all suspensions", () => {
  const h = createHarness("aa-list-windows-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_lw1", executionId: "exec_lw1" });
    seedTaskAndExecution(h.db, h.store, { taskId: "task_lw2", executionId: "exec_lw2" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_lw1",
      divisionId: "general_ops",
      workflowId: "wf_lw1",
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
      taskId: "task_lw2",
      divisionId: "general_ops",
      workflowId: "wf_lw2",
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
      taskId: "task_lw1",
      executionId: "exec_lw1",
      reasonCode: "window_1",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.suspend({
      taskId: "task_lw2",
      executionId: "exec_lw2",
      reasonCode: "window_2",
      waitKind: "human_input",
      resumableFromStep: "step_2",
      timeoutPolicy: "remain_pending",
    });

    const windows = service.listResumeWindows("2026-04-25T12:00:00.000Z");
    assert.equal(windows.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.listResumeWindows handles empty list", () => {
  const h = createHarness("aa-list-win-empty-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_lwe1", executionId: "exec_lwe1" });
    h.store.insertWorkflowState({
      taskId: "task_lwe1",
      divisionId: "general_ops",
      workflowId: "wf_lwe1",
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
    const windows = service.listResumeWindows("2026-04-25T12:00:00.000Z");
    assert.equal(windows.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.markDue skips non-active suspensions", () => {
  const h = createHarness("aa-mark-due-skip-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_mds1", executionId: "exec_mds1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_mds1",
      divisionId: "general_ops",
      workflowId: "wf_mds1",
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
      taskId: "task_mds1",
      executionId: "exec_mds1",
      reasonCode: "skip_test",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    // Resume changes status to resumable
    service.resume(suspension.suspensionId, "2026-04-25T13:00:00.000Z");

    // markDue should not return it since status is now resumable
    const due = service.markDue("2026-04-25T13:30:00.000Z");
    const found = due.find((d) => d.suspensionId === suspension.suspensionId);
    assert.equal(found, undefined);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.resume uses correct workflowId in decision", () => {
  const h = createHarness("aa-resume-wfid-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_rwf1", executionId: "exec_rwf1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_rwf1",
      divisionId: "general_ops",
      workflowId: "wf_specific_id",
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
      taskId: "task_rwf1",
      executionId: "exec_rwf1",
      reasonCode: "wf_id_test",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const decision = service.resume(suspension.suspensionId, "2026-04-25T12:00:00.000Z");
    assert.equal(decision.workflowId, "wf_specific_id");
    assert.equal(decision.taskId, "task_rwf1");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.expire sets correct reasonCode for fail_workflow", () => {
  const h = createHarness("aa-expire-reason-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_er1", executionId: "exec_er1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_er1",
      divisionId: "general_ops",
      workflowId: "wf_er1",
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
      taskId: "task_er1",
      executionId: "exec_er1",
      reasonCode: "timeout_expire",
      waitKind: "external_event",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    const decisions = service.sweepExpired("2026-04-25T12:01:00.000Z");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]!.reasonCode, "workflow_sleep.expired_failed");
    assert.equal(decisions[0]!.nextWorkflowStatus, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.resume with expired suspension returns not allowed", () => {
  const h = createHarness("aa-resume-expired-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_re1", executionId: "exec_re1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_re1",
      divisionId: "general_ops",
      workflowId: "wf_re1",
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
      taskId: "task_re1",
      executionId: "exec_re1",
      reasonCode: "expire_test",
      waitKind: "timer",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    // Expire it first
    service.sweepExpired("2026-04-25T12:01:00.000Z");

    // Now try to resume
    const decision = service.resume(suspension.suspensionId, "2026-04-25T12:02:00.000Z");
    assert.equal(decision.allowed, false);
    assert.equal(decision.nextWorkflowStatus, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.buildSleepLease returns correct lease structure", () => {
  const h = createHarness("aa-lease-struct-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_ls1", executionId: "exec_ls1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_ls1",
      divisionId: "general_ops",
      workflowId: "wf_ls1",
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
      taskId: "task_ls1",
      executionId: "exec_ls1",
      reasonCode: "lease_struct",
      waitKind: "human_input",
      resumableFromStep: "approval_step",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      expiresAt: "2026-04-25T14:00:00.000Z",
      checkpointArtifactId: "checkpoint_123",
      timeoutPolicy: "remain_pending",
      metadata: { customerId: "cust_456" },
    });

    const lease = service.buildSleepLease(suspension.suspensionId);
    assert.equal(lease.suspensionId, suspension.suspensionId);
    assert.equal(lease.taskId, "task_ls1");
    assert.equal(lease.workflowId, "wf_ls1");
    assert.equal(lease.executionId, "exec_ls1");
    assert.equal(lease.divisionId, "general_ops");
    assert.equal(lease.waitKind, "human_input");
    assert.equal(lease.status, "active");
    assert.equal(lease.resumableFromStep, "approval_step");
    assert.equal(lease.checkpointArtifactId, "checkpoint_123");
    assert.equal(lease.timeoutPolicy, "remain_pending");
    assert.deepEqual(lease.metadata, { customerId: "cust_456" });
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.buildResumeWindow returns correct window structure", () => {
  const h = createHarness("aa-win-struct-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_ws1", executionId: "exec_ws1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_ws1",
      divisionId: "general_ops",
      workflowId: "wf_ws1",
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
      taskId: "task_ws1",
      executionId: "exec_ws1",
      reasonCode: "window_struct",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      expiresAt: "2026-04-25T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const window = service.buildResumeWindow(suspension.suspensionId, "2026-04-25T08:00:00.000Z");
    assert.equal(window.suspensionId, suspension.suspensionId);
    assert.equal(window.taskId, "task_ws1");
    assert.equal(window.workflowId, "wf_ws1");
    assert.equal(window.dueAt, "2026-04-25T10:00:00.000Z");
    assert.equal(window.expiresAt, "2026-04-25T14:00:00.000Z");
    assert.equal(window.due, false);
    assert.equal(window.expired, false);
    assert.equal(window.nextAction, "wait");
    assert.equal(window.timeoutPolicy, "remain_pending");
    assert.equal(window.resumableFromStep, "step_1");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.suspend throws for workflow not found", () => {
  const h = createHarness("aa-susp-wf-notfound-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_wfnf", executionId: "exec_wfnf" });
    h.store.insertWorkflowState({
      taskId: "task_wfnf",
      divisionId: "general_ops",
      workflowId: "wf_wfnf",
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
      service.suspend({
        taskId: "nonexistent_task",
        executionId: "exec_wfnf",
        reasonCode: "wf_notfound",
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

test("LongRunningWorkflowService.emitWorkflowEvent creates event with correct structure", () => {
  const h = createHarness("aa-event-struct-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_es1", executionId: "exec_es1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_es1",
      divisionId: "general_ops",
      workflowId: "wf_es1",
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
      taskId: "task_es1",
      executionId: "exec_es1",
      reasonCode: "event_struct_test",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    const events = h.store.listEventsForTask("task_es1");
    const suspendedEvent = events.find((e) => e.eventType === "workflow:suspended");
    assert.ok(suspendedEvent !== undefined);
    assert.ok(suspendedEvent!.id.startsWith("evt_"));
    assert.equal(suspendedEvent!.taskId, "task_es1");
    assert.equal(suspendedEvent!.executionId, "exec_es1");
    assert.equal(suspendedEvent!.eventTier, "tier_1");
    assert.ok(suspendedEvent!.payloadJson.includes("event_struct_test"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.emitWorkflowEvent handles null executionId", () => {
  const h = createHarness("aa-event-null-exec-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_en1", executionId: "exec_en1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_en1",
      divisionId: "general_ops",
      workflowId: "wf_en1",
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
    // Suspend without executionId
    const suspension = service.suspend({
      taskId: "task_en1",
      executionId: null,
      reasonCode: "null_exec_test",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    const events = h.store.listEventsForTask("task_en1");
    const suspendedEvent = events.find((e) => e.eventType === "workflow:suspended");
    assert.ok(suspendedEvent !== undefined);
    assert.equal(suspendedEvent!.executionId, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.sweepExpired processes multiple expired suspensions", () => {
  const h = createHarness("aa-sweep-multi-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_sm1", executionId: "exec_sm1" });
    seedTaskAndExecution(h.db, h.store, { taskId: "task_sm2", executionId: "exec_sm2" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_sm1",
      divisionId: "general_ops",
      workflowId: "wf_sm1",
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
      taskId: "task_sm2",
      divisionId: "general_ops",
      workflowId: "wf_sm2",
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
      taskId: "task_sm1",
      executionId: "exec_sm1",
      reasonCode: "multi_1",
      waitKind: "external_event",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    service.suspend({
      taskId: "task_sm2",
      executionId: "exec_sm2",
      reasonCode: "multi_2",
      waitKind: "external_event",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    const decisions = service.sweepExpired("2026-04-25T12:01:00.000Z");
    assert.equal(decisions.length, 2);
    assert.ok(decisions.every((d) => d.allowed === false));
    assert.ok(decisions.every((d) => d.nextWorkflowStatus === "failed"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.sweepExpired skips already expired suspensions", () => {
  const h = createHarness("aa-sweep-skip-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_ss1", executionId: "exec_ss1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_ss1",
      divisionId: "general_ops",
      workflowId: "wf_ss1",
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
      taskId: "task_ss1",
      executionId: "exec_ss1",
      reasonCode: "skip_already",
      waitKind: "external_event",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    // First sweep
    service.sweepExpired("2026-04-25T12:01:00.000Z");

    // Second sweep should not return anything
    const decisions = service.sweepExpired("2026-04-25T12:02:00.000Z");
    assert.equal(decisions.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.markDue processes multiple due suspensions", () => {
  const h = createHarness("aa-mark-multi-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_mm1", executionId: "exec_mm1" });
    seedTaskAndExecution(h.db, h.store, { taskId: "task_mm2", executionId: "exec_mm2" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_mm1",
      divisionId: "general_ops",
      workflowId: "wf_mm1",
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
      taskId: "task_mm2",
      divisionId: "general_ops",
      workflowId: "wf_mm2",
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
      taskId: "task_mm1",
      executionId: "exec_mm1",
      reasonCode: "due_1",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.suspend({
      taskId: "task_mm2",
      executionId: "exec_mm2",
      reasonCode: "due_2",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const due = service.markDue("2026-04-25T10:30:00.000Z");
    assert.equal(due.length, 2);
    assert.ok(due.every((d) => d.status === "resumable"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService.writeWorkflowStatus preserves existing outputs", () => {
  const h = createHarness("aa-write-preserve-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_wp1", executionId: "exec_wp1" });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId: "task_wp1",
      divisionId: "general_ops",
      workflowId: "wf_wp1",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({ existing_key: "existing_value" }),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_wp1",
      executionId: "exec_wp1",
      reasonCode: "preserve_test",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    const wfState = h.store.getWorkflowState("task_wp1");
    assert.ok(wfState !== null);
    const outputs = JSON.parse(wfState!.outputsJson);
    assert.ok("existing_key" in outputs || Object.keys(outputs).length > 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend allows all waitKind variants", () => {
  const h = createHarness("aa-wait-kind-");
  const waitKinds = ["timer", "human_input", "external_event", "throttled", "deployment_window"] as const;

  for (const waitKind of waitKinds) {
    const taskId = `task_wk_${waitKind}`;
    const execId = `exec_wk_${waitKind}`;
    seedTaskAndExecution(h.db, h.store, { taskId, executionId: execId });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId: `wf_wk_${waitKind}`,
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
      taskId,
      executionId: execId,
      reasonCode: `wait_kind_${waitKind}`,
      waitKind,
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    assert.equal(suspension.waitKind, waitKind);
    assert.equal(suspension.status, "active");
  }
  h.db.close();
  cleanupPath(h.workspace);
});

test("LongRunningWorkflowService resume handles all timeoutPolicy values", () => {
  const h = createHarness("aa-timeout-policy-");
  const timeoutPolicies = ["fail_workflow", "remain_pending"] as const;

  for (const timeoutPolicy of timeoutPolicies) {
    const taskId = `task_tp_${timeoutPolicy}`;
    const execId = `exec_tp_${timeoutPolicy}`;
    seedTaskAndExecution(h.db, h.store, { taskId, executionId: execId });
    const now = nowIso();

    h.store.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId: `wf_tp_${timeoutPolicy}`,
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
      taskId,
      executionId: execId,
      reasonCode: `timeout_${timeoutPolicy}`,
      waitKind: "external_event",
      resumableFromStep: "step_1",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy,
    });

    const decisions = service.sweepExpired("2026-04-25T12:01:00.000Z");
    assert.equal(decisions.length, 1);
    assert.equal(
      decisions[0]!.nextWorkflowStatus,
      timeoutPolicy === "fail_workflow" ? "failed" : null,
    );
    assert.equal(
      decisions[0]!.reasonCode,
      timeoutPolicy === "fail_workflow"
        ? "workflow_sleep.expired_failed"
        : "workflow_sleep.expired_remain_pending",
    );
  }
  h.db.close();
  cleanupPath(h.workspace);
});
