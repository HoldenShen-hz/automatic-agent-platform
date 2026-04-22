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

test("LongRunningWorkflowService suspends workflow and marks it resumable when timer is due", () => {
  const h = createHarness("aa-scheduler-suspend-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_sleep_1", executionId: "exec_sleep_1" });
    const now = nowIso();
    h.store.insertWorkflowState({
      taskId: "task_sleep_1",
      divisionId: "general_ops",
      workflowId: "wf_sleep",
      currentStepIndex: 2,
      status: "running",
      outputsJson: JSON.stringify({ step_1: "done" }),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_sleep_1",
      executionId: "exec_sleep_1",
      reasonCode: "waiting_approval",
      waitKind: "human_input",
      resumableFromStep: "approval_gate",
      resumeAfter: "2026-04-20T10:00:00.000Z",
      expiresAt: "2026-04-20T12:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    assert.equal(h.store.getWorkflowState("task_sleep_1")?.status, "paused");
    assert.equal(h.store.getWorkflowState("task_sleep_1")?.resumableFromStep, "approval_gate");
    assert.equal(service.markDue("2026-04-20T10:30:00.000Z")[0]?.suspensionId, suspension.suspensionId);

    const decision = service.resume(suspension.suspensionId, "2026-04-20T10:30:00.000Z");
    assert.equal(decision.allowed, true);
    assert.equal(h.store.getWorkflowState("task_sleep_1")?.status, "resuming");
    assert.equal(h.store.listEventsForTask("task_sleep_1").some((event) => event.eventType === "workflow:resume_requested"), true);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService expires suspensions and can fail workflow on timeout", () => {
  const h = createHarness("aa-scheduler-expire-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_sleep_2", executionId: "exec_sleep_2" });
    const now = nowIso();
    h.store.insertWorkflowState({
      taskId: "task_sleep_2",
      divisionId: "general_ops",
      workflowId: "wf_sleep",
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
      taskId: "task_sleep_2",
      executionId: "exec_sleep_2",
      reasonCode: "external_event_timeout",
      waitKind: "external_event",
      resumableFromStep: "sync_partner",
      expiresAt: "2026-04-20T10:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    const sweep = service.sweepExpired("2026-04-20T10:01:00.000Z");
    assert.equal(sweep[0]?.suspensionId, suspension.suspensionId);
    assert.equal(sweep[0]?.nextWorkflowStatus, "failed");
    assert.equal(h.store.getWorkflowState("task_sleep_2")?.status, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService builds sleep leases and resume windows for suspended workflows", () => {
  const h = createHarness("aa-scheduler-lease-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_sleep_3", executionId: "exec_sleep_3" });
    const now = nowIso();
    h.store.insertWorkflowState({
      taskId: "task_sleep_3",
      divisionId: "general_ops",
      workflowId: "wf_sleep_3",
      currentStepIndex: 3,
      status: "running",
      outputsJson: JSON.stringify({ checkpoint: "ready" }),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_sleep_3",
      executionId: "exec_sleep_3",
      reasonCode: "deployment_window",
      waitKind: "deployment_window",
      resumableFromStep: "rollout_gate",
      resumeAfter: "2026-04-22T10:30:00.000Z",
      expiresAt: "2026-04-22T11:30:00.000Z",
      checkpointArtifactId: "artifact-1",
      timeoutPolicy: "remain_pending",
      metadata: { window: "canary_25" },
    });

    const lease = service.buildSleepLease(suspension.suspensionId);
    const pendingWindow = service.buildResumeWindow(suspension.suspensionId, "2026-04-22T10:00:00.000Z");
    const dueWindow = service.buildResumeWindow(suspension.suspensionId, "2026-04-22T10:35:00.000Z");
    const windows = service.listResumeWindows("2026-04-22T10:35:00.000Z");

    assert.equal(lease.workflowId, "wf_sleep_3");
    assert.equal(lease.waitKind, "deployment_window");
    assert.equal(lease.metadata.window, "canary_25");
    assert.equal(pendingWindow.nextAction, "wait");
    assert.equal(dueWindow.nextAction, "resume");
    assert.equal(windows[0]?.suspensionId, suspension.suspensionId);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
