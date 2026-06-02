import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { LongRunningWorkflowService } from "../../../../../src/platform/five-plane-interface/scheduler/long-running-workflow-service.js";
import { toWorkflowSleepLease, toWorkflowResumeWindow } from "../../../../../src/platform/five-plane-interface/scheduler/workflow-sleep-contracts.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";

function createWorkflowTestHarness() {
  const workspace = createTempWorkspace("aa-scheduler-contracts-integration-");
  const dbPath = join(workspace, "scheduler-contracts.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new LongRunningWorkflowService(store);
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "contracts_workflow";
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general-ops",
      title: "Scheduler contracts integration test",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: JSON.stringify({ request: "Test workflow sleep contracts" }),
      normalizedInputJson: JSON.stringify({ request: "Test workflow sleep contracts" }),
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
      traceId: "trace-contracts",
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
      divisionId: "general-ops",
      workflowId,
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

  return {
    workspace,
    db,
    store,
    service,
    taskId,
    executionId,
    cleanup() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

test("WorkflowSleepLease contract transforms suspension record correctly", () => {
  const h = createWorkflowTestHarness();
  try {
    const suspension = h.service.suspend({
      taskId: h.taskId,
      executionId: h.executionId,
      reasonCode: "resource_throttle",
      waitKind: "throttled",
      resumableFromStep: "process_batch",
      resumeAfter: new Date(Date.now() + 60000).toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      checkpointArtifactId: "artifact_checkpoint_123",
      timeoutPolicy: "remain_pending",
      metadata: { queueDepth: 50, priority: "high" },
    });

    const lease = h.service.buildSleepLease(suspension.suspensionId);

    assert.equal(lease.suspensionId, suspension.suspensionId);
    assert.equal(lease.taskId, h.taskId);
    assert.equal(lease.executionId, h.executionId);
    assert.equal(lease.waitKind, "throttled");
    assert.equal(lease.status, "active");
    assert.equal(lease.checkpointArtifactId, "artifact_checkpoint_123");
    assert.equal(lease.timeoutPolicy, "remain_pending");
    assert.deepEqual(lease.metadata, { queueDepth: 50, priority: "high" });
    assert.ok(lease.resumeAfter != null);
    assert.ok(lease.expiresAt != null);
  } finally {
    h.cleanup();
  }
});

test("WorkflowResumeWindow contract identifies wait action for future resumeAfter", () => {
  const h = createWorkflowTestHarness();
  try {
    const futureTime = new Date(Date.now() + 120000).toISOString();
    const futureExpiry = new Date(Date.now() + 600000).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "awaiting_resource",
      waitKind: "external_event",
      resumableFromStep: "check_availability",
      resumeAfter: futureTime,
      expiresAt: futureExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const windows = h.service.listResumeWindows();
    const ourWindow = windows.find((w) => w.taskId === h.taskId);

    assert.ok(ourWindow != null);
    assert.equal(ourWindow?.due, false);
    assert.equal(ourWindow?.expired, false);
    assert.equal(ourWindow?.nextAction, "wait");
    assert.equal(ourWindow?.resumableFromStep, "check_availability");
    assert.equal(ourWindow?.timeoutPolicy, "fail_workflow");
  } finally {
    h.cleanup();
  }
});

test("WorkflowResumeWindow contract identifies resume action when due", () => {
  const h = createWorkflowTestHarness();
  try {
    const pastTime = new Date(Date.now() - 1000).toISOString();
    const futureExpiry = new Date(Date.now() + 600000).toISOString();

    h.service.suspend({
      taskId: h.taskId,
      reasonCode: "timer_fired",
      waitKind: "timer",
      resumableFromStep: "process_timer",
      resumeAfter: pastTime,
      expiresAt: futureExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const windows = h.service.listResumeWindows();
    const ourWindow = windows.find((w) => w.taskId === h.taskId);

    assert.ok(ourWindow != null);
    assert.equal(ourWindow?.due, true);
    assert.equal(ourWindow?.expired, false);
    assert.equal(ourWindow?.nextAction, "resume");
  } finally {
    h.cleanup();
  }
});

test("WorkflowResumeWindow contract identifies expire action when expiry is past", () => {
  const h = createWorkflowTestHarness();
  try {
    const pastTime = new Date(Date.now() - 1000).toISOString();
    const pastExpiry = new Date(Date.now() - 500).toISOString();

    h.service.suspend({
      taskId: h.taskId,
      reasonCode: "approval_expired",
      waitKind: "human_input",
      resumableFromStep: "pending_approval",
      resumeAfter: pastTime,
      expiresAt: pastExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const windows = h.service.listResumeWindows();
    const ourWindow = windows.find((w) => w.taskId === h.taskId);

    assert.ok(ourWindow != null);
    assert.equal(ourWindow?.due, false); // expired takes precedence
    assert.equal(ourWindow?.expired, true);
    assert.equal(ourWindow?.nextAction, "expire");
  } finally {
    h.cleanup();
  }
});

test("workflow-sleep-contracts.ts standalone functions produce same result as service methods", () => {
  const h = createWorkflowTestHarness();
  try {
    const futureResume = new Date(Date.now() + 60000).toISOString();
    const futureExpiry = new Date(Date.now() + 300000).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "throttled",
      waitKind: "throttled",
      resumableFromStep: "throttled_step",
      resumeAfter: futureResume,
      expiresAt: futureExpiry,
      timeoutPolicy: "remain_pending",
      metadata: { throttleLevel: 5 },
    });

    const leaseFromService = h.service.buildSleepLease(suspension.suspensionId);
    const leaseFromContract = toWorkflowSleepLease(suspension);

    assert.equal(leaseFromService.suspensionId, leaseFromContract.suspensionId);
    assert.equal(leaseFromService.taskId, leaseFromContract.taskId);
    assert.equal(leaseFromService.workflowId, leaseFromContract.workflowId);
    assert.equal(leaseFromService.waitKind, leaseFromContract.waitKind);
    assert.deepEqual(leaseFromService.metadata, leaseFromContract.metadata);

    const now = nowIso();
    const windowFromService = h.service.buildResumeWindow(suspension.suspensionId, now);
    const windowFromContract = toWorkflowResumeWindow(suspension, now);

    assert.equal(windowFromService.suspensionId, windowFromContract.suspensionId);
    assert.equal(windowFromService.taskId, windowFromContract.taskId);
    assert.equal(windowFromService.nextAction, windowFromContract.nextAction);
  } finally {
    h.cleanup();
  }
});

test("LongRunningWorkflowService emits workflow:suspended and workflow:resume_requested events", () => {
  const h = createWorkflowTestHarness();
  try {
    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "human_input",
      waitKind: "human_input",
      resumableFromStep: "await_response",
      timeoutPolicy: "fail_workflow",
    });

    const eventsAfterSuspend = h.store.listEventsForTask(h.taskId);
    const suspendEvent = eventsAfterSuspend.find((e) => e.eventType === "workflow:suspended");
    assert.ok(suspendEvent != null, "should emit workflow:suspended event");
    const suspendPayload = JSON.parse(suspendEvent!.payloadJson);
    assert.equal(suspendPayload.suspensionId, suspension.suspensionId);
    assert.equal(suspendPayload.waitKind, "human_input");

    // Resume the workflow
    const resumeDecision = h.service.resume(suspension.suspensionId);
    assert.equal(resumeDecision.allowed, true);

    const eventsAfterResume = h.store.listEventsForTask(h.taskId);
    const resumeEvent = eventsAfterResume.find((e) => e.eventType === "workflow:resume_requested");
    assert.ok(resumeEvent != null, "should emit workflow:resume_requested event");
    const resumePayload = JSON.parse(resumeEvent!.payloadJson);
    assert.equal(resumePayload.suspensionId, suspension.suspensionId);
  } finally {
    h.cleanup();
  }
});

test("LongRunningWorkflowService writes workflow status on suspend and resume", () => {
  const h = createWorkflowTestHarness();
  try {
    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "timer",
      waitKind: "timer",
      resumableFromStep: "wait_step",
      timeoutPolicy: "fail_workflow",
    });

    let workflowState = h.store.workflow.getWorkflowState(h.taskId);
    assert.equal(workflowState?.status, "paused", "workflow should be paused after suspend");
    assert.ok(workflowState?.outputsJson.includes("__workflow_suspension"));

    // Resume the workflow
    h.service.resume(suspension.suspensionId);

    workflowState = h.store.workflow.getWorkflowState(h.taskId);
    assert.equal(workflowState?.status, "resuming", "workflow should be resuming after resume");
    assert.ok(workflowState?.outputsJson.includes("__workflow_resume"));
  } finally {
    h.cleanup();
  }
});

test("LongRunningWorkflowService handles all waitKind types", () => {
  const h = createWorkflowTestHarness();

  const waitKinds = ["timer", "human_input", "external_event", "throttled", "deployment_window"] as const;

  try {
    for (const waitKind of waitKinds) {
      const suspension = h.service.suspend({
        taskId: h.taskId,
        reasonCode: `test_${waitKind}`,
        waitKind,
        resumableFromStep: `step_for_${waitKind}`,
        timeoutPolicy: waitKind === "human_input" ? "fail_workflow" : "remain_pending",
      });

      assert.ok(suspension.suspensionId.startsWith("workflow_sleep_"));
      assert.equal(suspension.waitKind, waitKind);
      assert.equal(suspension.status, "active");

      const retrieved = h.service.getSuspension(suspension.suspensionId);
      assert.ok(retrieved != null, `should retrieve suspension for waitKind: ${waitKind}`);
      assert.equal(retrieved?.waitKind, waitKind);
    }
  } finally {
    h.cleanup();
  }
});

test("LongRunningWorkflowService sweeper expires all eligible suspensions in one call", () => {
  const h = createWorkflowTestHarness();

  try {
    const now = nowIso();

    // Use db.transaction to insert second task and both suspensions properly
    h.db.transaction(() => {
      const taskId2 = newId("task");

      h.store.insertTask({
        id: taskId2,
        parentId: null,
        rootId: taskId2,
        divisionId: "general-ops",
        title: "Second task for sweep test",
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
        divisionId: "general-ops",
        workflowId: "sweep_workflow",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });

      // Suspend first task with past expiry (fail_workflow)
      h.service.suspend({
        taskId: h.taskId,
        reasonCode: "expire_me_1",
        waitKind: "timer",
        resumableFromStep: "step1",
        expiresAt: new Date(Date.now() - 500).toISOString(),
        timeoutPolicy: "fail_workflow",
      });

      // Suspend second task with past expiry (remain_pending)
      h.service.suspend({
        taskId: taskId2,
        reasonCode: "expire_me_2",
        waitKind: "human_input",
        resumableFromStep: "step2",
        expiresAt: new Date(Date.now() - 300).toISOString(),
        timeoutPolicy: "remain_pending",
      });
    });

    // Verify suspensions were created
    const allSuspensions = h.service.listSuspensions();
    const ourSuspensions = allSuspensions.filter((s) => s.reasonCode.includes("expire_me"));
    assert.ok(ourSuspensions.length >= 2, `expected at least 2 suspensions, got ${ourSuspensions.length}`);
    assert.ok(ourSuspensions.every((s) => s.status === "active"), "both suspensions should be active before sweep");

    const decisions = h.service.sweepExpired();

    // Both suspensions should be expired (decisions use service reason codes)
    assert.ok(decisions.length >= 1, `expected at least 1 decision, got ${decisions.length}`);

    // Verify we have both timeout policies handled
    const failDecision = decisions.find((d) => d.reasonCode === "workflow_sleep.expired_failed");
    const remainDecision = decisions.find((d) => d.reasonCode === "workflow_sleep.expired_remain_pending");
    assert.ok(failDecision != null, "should have a fail_workflow decision");
    assert.equal(failDecision?.nextWorkflowStatus, "failed", "fail_workflow should transition to failed");
    assert.ok(remainDecision != null, "should have a remain_pending decision");
    assert.equal(remainDecision?.nextWorkflowStatus, null, "remain_pending should not change workflow status");
  } finally {
    h.cleanup();
  }
});

test("LongRunningWorkflowService resume rejected when resumeAfter is in the future", () => {
  const h = createWorkflowTestHarness();
  try {
    const futureResume = new Date(Date.now() + 120000).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "premature_resume",
      waitKind: "timer",
      resumableFromStep: "wait_more",
      resumeAfter: futureResume,
      timeoutPolicy: "fail_workflow",
    });

    // Attempt to resume before resumeAfter
    const decision = h.service.resume(suspension.suspensionId);

    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "workflow_sleep.resume_not_due");
    assert.equal(decision.nextWorkflowStatus, null);

    // Verify workflow is still paused, not resumed
    const workflowState = h.store.workflow.getWorkflowState(h.taskId);
    assert.equal(workflowState?.status, "paused");
  } finally {
    h.cleanup();
  }
});

test("LongRunningWorkflowService reports correct suspension status transitions", () => {
  const h = createWorkflowTestHarness();
  try {
    const pastResume = new Date(Date.now() - 1000).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "status_test",
      waitKind: "timer",
      resumableFromStep: "initial_step",
      resumeAfter: pastResume, // Use past time so markDue will work
      timeoutPolicy: "fail_workflow",
    });

    assert.equal(suspension.status, "active");

    // Mark due transitions to resumable (resumeAfter is past)
    h.service.markDue();
    const afterMarkDue = h.service.getSuspension(suspension.suspensionId);
    assert.equal(afterMarkDue?.status, "resumable");

    // Resume transitions back to resumable (stays resumable)
    h.service.resume(suspension.suspensionId);
    const afterResume = h.service.getSuspension(suspension.suspensionId);
    assert.equal(afterResume?.status, "resumable");
  } finally {
    h.cleanup();
  }
});

test("LongRunningWorkflowService with null resumeAfter never becomes due", () => {
  const h = createWorkflowTestHarness();
  try {
    h.service.suspend({
      taskId: h.taskId,
      reasonCode: "no_resume_time",
      waitKind: "human_input",
      resumableFromStep: "wait_forever",
      resumeAfter: null, // No resume time specified
      timeoutPolicy: "remain_pending",
    });

    // Mark due should not find this suspension as due (resumeAfter is null)
    const due = h.service.markDue();
    const ourDue = due.find((d) => d.taskId === h.taskId);
    assert.ok(ourDue == null, "suspension with null resumeAfter should not be marked due");
  } finally {
    h.cleanup();
  }
});

test("LongRunningWorkflowService preserves checkpointArtifactId through suspend and resume lifecycle", () => {
  const h = createWorkflowTestHarness();
  try {
    const checkpointId = "checkpoint_artifact_abc123";

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "checkpoint_resume",
      waitKind: "external_event",
      resumableFromStep: "restore_checkpoint",
      checkpointArtifactId: checkpointId,
      timeoutPolicy: "fail_workflow",
    });

    assert.equal(suspension.checkpointArtifactId, checkpointId);

    const retrieved = h.service.getSuspension(suspension.suspensionId);
    assert.equal(retrieved?.checkpointArtifactId, checkpointId);

    const lease = h.service.buildSleepLease(suspension.suspensionId);
    assert.equal(lease.checkpointArtifactId, checkpointId);

    const window = h.service.buildResumeWindow(suspension.suspensionId);
    // Resume window doesn't include checkpointArtifactId but the suspension record does
    const allSuspensions = h.service.listSuspensions();
    const ourSuspension = allSuspensions.find((s) => s.suspensionId === suspension.suspensionId);
    assert.equal(ourSuspension?.checkpointArtifactId, checkpointId);
  } finally {
    h.cleanup();
  }
});