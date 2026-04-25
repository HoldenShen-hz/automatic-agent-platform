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

function seedWorkflow(store: AuthoritativeTaskStore, db: SqliteDatabase, taskId: string, executionId: string, status: string = "running") {
  seedTaskAndExecution(db, store, { taskId, executionId });
  const now = nowIso();
  store.insertWorkflowState({
    taskId,
    divisionId: "general_ops",
    workflowId: `wf_${taskId}`,
    currentStepIndex: 1,
    status: status as "running",
    outputsJson: JSON.stringify({}),
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: null,
    startedAt: now,
    updatedAt: now,
  });
}

test("LongRunningWorkflowService suspend creates suspension record", () => {
  const h = createHarness("aa-scheduler-suspend-");
  try {
    seedWorkflow(h.store, h.db, "task_susp_1", "exec_susp_1");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_susp_1",
      executionId: "exec_susp_1",
      reasonCode: "approval_required",
      waitKind: "human_input",
      resumableFromStep: "approval_step",
      resumeAfter: "2026-04-25T12:00:00.000Z",
      expiresAt: "2026-04-25T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    assert.ok(suspension.suspensionId.startsWith("workflow_sleep_"));
    assert.equal(suspension.taskId, "task_susp_1");
    assert.equal(suspension.workflowId, `wf_task_susp_1`);
    assert.equal(suspension.status, "active");
    assert.equal(suspension.waitKind, "human_input");
    assert.equal(suspension.resumableFromStep, "approval_step");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend throws on terminal workflow", () => {
  const h = createHarness("aa-scheduler-terminal-");
  try {
    seedWorkflow(h.store, h.db, "task_terminal", "exec_terminal", "completed");
    const service = new LongRunningWorkflowService(h.store);

    assert.throws(() => {
      service.suspend({
        taskId: "task_terminal",
        reasonCode: "late_suspend",
        waitKind: "timer",
        resumableFromStep: "step_1",
        timeoutPolicy: "remain_pending",
      });
    }, /terminal_workflow/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend throws on failed workflow", () => {
  const h = createHarness("aa-scheduler-failed-");
  try {
    seedWorkflow(h.store, h.db, "task_failed", "exec_failed", "failed");
    const service = new LongRunningWorkflowService(h.store);

    assert.throws(() => {
      service.suspend({
        taskId: "task_failed",
        reasonCode: "late_suspend",
        waitKind: "timer",
        resumableFromStep: "step_1",
        timeoutPolicy: "remain_pending",
      });
    }, /terminal_workflow/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend throws on cancelled workflow", () => {
  const h = createHarness("aa-scheduler-cancelled-");
  try {
    seedWorkflow(h.store, h.db, "task_cancelled", "exec_cancelled", "cancelled");
    const service = new LongRunningWorkflowService(h.store);

    assert.throws(() => {
      service.suspend({
        taskId: "task_cancelled",
        reasonCode: "late_suspend",
        waitKind: "timer",
        resumableFromStep: "step_1",
        timeoutPolicy: "remain_pending",
      });
    }, /terminal_workflow/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService markDue returns due suspensions", () => {
  const h = createHarness("aa-scheduler-markdue-");
  try {
    seedWorkflow(h.store, h.db, "task_due", "exec_due");
    const service = new LongRunningWorkflowService(h.store);

    service.suspend({
      taskId: "task_due",
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const due = service.markDue("2026-04-25T10:30:00.000Z");
    assert.equal(due.length, 1);
    assert.equal(due[0].status, "resumable");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService markDue returns empty when nothing is due", () => {
  const h = createHarness("aa-scheduler-notdue-");
  try {
    seedWorkflow(h.store, h.db, "task_notdue", "exec_notdue");
    const service = new LongRunningWorkflowService(h.store);

    service.suspend({
      taskId: "task_notdue",
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T14:00:00.000Z",
      expiresAt: "2026-04-25T16:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const due = service.markDue("2026-04-25T10:00:00.000Z");
    assert.equal(due.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService markDue ignores non-active suspensions", () => {
  const h = createHarness("aa-scheduler-ignore-");
  try {
    seedWorkflow(h.store, h.db, "task_ignore", "exec_ignore");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_ignore",
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.markDue("2026-04-25T10:30:00.000Z");
    const due2 = service.markDue("2026-04-25T11:00:00.000Z");
    assert.equal(due2.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService resume allows due suspension", () => {
  const h = createHarness("aa-scheduler-resume-");
  try {
    seedWorkflow(h.store, h.db, "task_resume", "exec_resume");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_resume",
      reasonCode: "approval",
      waitKind: "human_input",
      resumableFromStep: "approval_gate",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.markDue("2026-04-25T10:30:00.000Z");
    const decision = service.resume(suspension.suspensionId, "2026-04-25T10:30:00.000Z");

    assert.equal(decision.allowed, true);
    assert.equal(decision.nextWorkflowStatus, "resuming");
    assert.equal(decision.resumableFromStep, "approval_gate");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService resume rejects when not yet due", () => {
  const h = createHarness("aa-scheduler-notready-");
  try {
    seedWorkflow(h.store, h.db, "task_notready", "exec_notready");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_notready",
      reasonCode: "timer",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const decision = service.resume(suspension.suspensionId, "2026-04-25T10:00:00.000Z");

    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "workflow_sleep.resume_not_due");
    assert.equal(decision.nextWorkflowStatus, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService resume expires when past expiresAt", () => {
  const h = createHarness("aa-scheduler-expired-");
  try {
    seedWorkflow(h.store, h.db, "task_expired", "exec_expired");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_expired",
      reasonCode: "event_wait",
      waitKind: "external_event",
      resumableFromStep: "sync_step",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    const decision = service.resume(suspension.suspensionId, "2026-04-25T12:30:00.000Z");

    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "workflow_sleep.expired_failed");
    assert.equal(decision.nextWorkflowStatus, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService resume throws for unknown suspension", () => {
  const h = createHarness("aa-scheduler-unknown-");
  try {
    seedWorkflow(h.store, h.db, "task_unknown", "exec_unknown");
    const service = new LongRunningWorkflowService(h.store);

    assert.throws(() => {
      service.resume("nonexistent_suspension", nowIso());
    }, /suspension_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService sweepExpired expires past suspensions", () => {
  const h = createHarness("aa-scheduler-sweep-");
  try {
    seedWorkflow(h.store, h.db, "task_sweep", "exec_sweep");
    const service = new LongRunningWorkflowService(h.store);

    service.suspend({
      taskId: "task_sweep",
      reasonCode: "event",
      waitKind: "external_event",
      resumableFromStep: "sync",
      expiresAt: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    const decisions = service.sweepExpired("2026-04-25T10:30:00.000Z");

    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].reasonCode, "workflow_sleep.expired_failed");
    assert.equal(decisions[0].nextWorkflowStatus, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService sweepExpired ignores active non-expired", () => {
  const h = createHarness("aa-scheduler-sweepactive-");
  try {
    seedWorkflow(h.store, h.db, "task_sweepactive", "exec_sweepactive");
    const service = new LongRunningWorkflowService(h.store);

    service.suspend({
      taskId: "task_sweepactive",
      reasonCode: "timer",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T14:00:00.000Z",
      expiresAt: "2026-04-25T16:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const decisions = service.sweepExpired("2026-04-25T10:00:00.000Z");
    assert.equal(decisions.length, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService getSuspension returns record", () => {
  const h = createHarness("aa-scheduler-get-");
  try {
    seedWorkflow(h.store, h.db, "task_get", "exec_get");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_get",
      reasonCode: "approval",
      waitKind: "human_input",
      resumableFromStep: "gate",
      timeoutPolicy: "remain_pending",
    });

    const found = service.getSuspension(suspension.suspensionId);
    assert.ok(found !== null);
    assert.equal(found!.suspensionId, suspension.suspensionId);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService getSuspension returns null for unknown", () => {
  const h = createHarness("aa-scheduler-getnull-");
  try {
    seedWorkflow(h.store, h.db, "task_getnull", "exec_getnull");
    const service = new LongRunningWorkflowService(h.store);

    const found = service.getSuspension("unknown_id");
    assert.equal(found, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService listSuspensions returns all", () => {
  const h = createHarness("aa-scheduler-list-");
  try {
    seedWorkflow(h.store, h.db, "task_list1", "exec_list1");
    seedWorkflow(h.store, h.db, "task_list2", "exec_list2");
    const service = new LongRunningWorkflowService(h.store);

    service.suspend({
      taskId: "task_list1",
      reasonCode: "approval",
      waitKind: "human_input",
      resumableFromStep: "gate",
      timeoutPolicy: "remain_pending",
    });

    service.suspend({
      taskId: "task_list2",
      reasonCode: "timer",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    const suspensions = service.listSuspensions();
    assert.equal(suspensions.length, 2);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService buildSleepLease creates lease", () => {
  const h = createHarness("aa-scheduler-lease-");
  try {
    seedWorkflow(h.store, h.db, "task_lease", "exec_lease");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_lease",
      reasonCode: "deployment",
      waitKind: "deployment_window",
      resumableFromStep: "rollout",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      expiresAt: "2026-04-25T12:00:00.000Z",
      checkpointArtifactId: "artifact_123",
      timeoutPolicy: "remain_pending",
      metadata: { window: "canary_10" },
    });

    const lease = service.buildSleepLease(suspension.suspensionId);

    assert.equal(lease.suspensionId, suspension.suspensionId);
    assert.equal(lease.taskId, "task_lease");
    assert.equal(lease.waitKind, "deployment_window");
    assert.equal(lease.resumableFromStep, "rollout");
    assert.equal(lease.checkpointArtifactId, "artifact_123");
    assert.deepEqual(lease.metadata, { window: "canary_10" });
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService buildSleepLease throws for unknown", () => {
  const h = createHarness("aa-scheduler-leasethrow-");
  try {
    seedWorkflow(h.store, h.db, "task_leasethrow", "exec_leasethrow");
    const service = new LongRunningWorkflowService(h.store);

    assert.throws(() => {
      service.buildSleepLease("unknown");
    }, /suspension_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService buildResumeWindow returns wait before due", () => {
  const h = createHarness("aa-scheduler-windowwait-");
  try {
    seedWorkflow(h.store, h.db, "task_windowwait", "exec_windowwait");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_windowwait",
      reasonCode: "timer",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: "2026-04-25T14:00:00.000Z",
      expiresAt: "2026-04-25T16:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const window = service.buildResumeWindow(suspension.suspensionId, "2026-04-25T10:00:00.000Z");

    assert.equal(window.due, false);
    assert.equal(window.expired, false);
    assert.equal(window.nextAction, "wait");
    assert.equal(window.resumableFromStep, "step_1");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService buildResumeWindow returns resume when due", () => {
  const h = createHarness("aa-scheduler-windowdue-");
  try {
    seedWorkflow(h.store, h.db, "task_windowdue", "exec_windowdue");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_windowdue",
      reasonCode: "approval",
      waitKind: "human_input",
      resumableFromStep: "gate",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      expiresAt: "2026-04-25T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const window = service.buildResumeWindow(suspension.suspensionId, "2026-04-25T11:00:00.000Z");

    assert.equal(window.due, true);
    assert.equal(window.expired, false);
    assert.equal(window.nextAction, "resume");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService buildResumeWindow returns expire when expired", () => {
  const h = createHarness("aa-scheduler-windowexpired-");
  try {
    seedWorkflow(h.store, h.db, "task_windowexpired", "exec_windowexpired");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_windowexpired",
      reasonCode: "event",
      waitKind: "external_event",
      resumableFromStep: "sync",
      expiresAt: "2026-04-25T12:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    const window = service.buildResumeWindow(suspension.suspensionId, "2026-04-25T13:00:00.000Z");

    assert.equal(window.due, false);
    assert.equal(window.expired, true);
    assert.equal(window.nextAction, "expire");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService buildResumeWindow throws for unknown", () => {
  const h = createHarness("aa-scheduler-windowthrow-");
  try {
    seedWorkflow(h.store, h.db, "task_windowthrow", "exec_windowthrow");
    const service = new LongRunningWorkflowService(h.store);

    assert.throws(() => {
      service.buildResumeWindow("unknown_id", nowIso());
    }, /suspension_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService listResumeWindows returns all windows", () => {
  const h = createHarness("aa-scheduler-listwindows-");
  try {
    seedWorkflow(h.store, h.db, "task_lw1", "exec_lw1");
    seedWorkflow(h.store, h.db, "task_lw2", "exec_lw2");
    const service = new LongRunningWorkflowService(h.store);

    service.suspend({
      taskId: "task_lw1",
      reasonCode: "approval",
      waitKind: "human_input",
      resumableFromStep: "gate1",
      resumeAfter: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    service.suspend({
      taskId: "task_lw2",
      reasonCode: "timer",
      waitKind: "timer",
      resumableFromStep: "gate2",
      resumeAfter: "2026-04-25T14:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const windows = service.listResumeWindows("2026-04-25T11:00:00.000Z");
    assert.equal(windows.length, 2);
    const dueWindows = windows.filter((w) => w.due);
    assert.equal(dueWindows.length, 1);
    assert.equal(dueWindows[0].taskId, "task_lw1");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend with null resumeAfter and expiresAt", () => {
  const h = createHarness("aa-scheduler-nulltimes-");
  try {
    seedWorkflow(h.store, h.db, "task_nulltimes", "exec_nulltimes");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_nulltimes",
      reasonCode: "manual",
      waitKind: "human_input",
      resumableFromStep: "manual_gate",
      resumeAfter: null,
      expiresAt: null,
      timeoutPolicy: "remain_pending",
    });

    assert.equal(suspension.resumeAfter, null);
    assert.equal(suspension.expiresAt, null);

    const window = service.buildResumeWindow(suspension.suspensionId, "2026-04-25T12:00:00.000Z");
    assert.equal(window.due, false);
    assert.equal(window.expired, false);
    assert.equal(window.nextAction, "wait");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend with fail_workflow timeout", () => {
  const h = createHarness("aa-scheduler-failtimeout-");
  try {
    seedWorkflow(h.store, h.db, "task_failtimeout", "exec_failtimeout");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_failtimeout",
      reasonCode: "event",
      waitKind: "external_event",
      resumableFromStep: "sync",
      expiresAt: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    const decisions = service.sweepExpired("2026-04-25T10:30:00.000Z");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].nextWorkflowStatus, "failed");
    assert.equal(h.store.getWorkflowState("task_failtimeout")?.status, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend with remain_pending timeout", () => {
  const h = createHarness("aa-scheduler-remainpending-");
  try {
    seedWorkflow(h.store, h.db, "task_remainpending", "exec_remainpending");
    const service = new LongRunningWorkflowService(h.store);

    const suspension = service.suspend({
      taskId: "task_remainpending",
      reasonCode: "event",
      waitKind: "external_event",
      resumableFromStep: "sync",
      expiresAt: "2026-04-25T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const decisions = service.sweepExpired("2026-04-25T10:30:00.000Z");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].nextWorkflowStatus, null);
    assert.equal(decisions[0].reasonCode, "workflow_sleep.expired_remain_pending");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService suspend throws for nonexistent task", () => {
  const h = createHarness("aa-scheduler-notask-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_notask", executionId: "exec_notask" });
    const service = new LongRunningWorkflowService(h.store);

    assert.throws(() => {
      service.suspend({
        taskId: "nonexistent_task",
        reasonCode: "approval",
        waitKind: "human_input",
        resumableFromStep: "gate",
        timeoutPolicy: "remain_pending",
      });
    }, /workflow_not_found/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("LongRunningWorkflowService all waitKind types", () => {
  const h = createHarness("aa-scheduler-waitkinds-");
  try {
    const waitKinds: Array<"timer" | "human_input" | "external_event" | "throttled" | "deployment_window"> = [
      "timer",
      "human_input",
      "external_event",
      "throttled",
      "deployment_window",
    ];

    for (let i = 0; i < waitKinds.length; i++) {
      const taskId = `task_wk_${i}`;
      const execId = `exec_wk_${i}`;
      seedWorkflow(h.store, h.db, taskId, execId);
    }

    const service = new LongRunningWorkflowService(h.store);

    for (let i = 0; i < waitKinds.length; i++) {
      const suspension = service.suspend({
        taskId: `task_wk_${i}`,
        reasonCode: `reason_${waitKinds[i]}`,
        waitKind: waitKinds[i],
        resumableFromStep: "step_1",
        timeoutPolicy: "remain_pending",
      });
      assert.equal(suspension.waitKind, waitKinds[i]);
    }
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
