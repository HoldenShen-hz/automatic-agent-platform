// @ts-nocheck
/**
 * Integration Test: Scheduler Module
 *
 * Tests the scheduler-related functionality including
 * LongRunningWorkflowService and workflow sleep/resume contracts.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../helpers/integration-context.js";
import { LongRunningWorkflowService } from "../../../src/platform/interface/scheduler/long-running-workflow-service.js";
import { toWorkflowSleepLease, toWorkflowResumeWindow } from "../../../src/platform/interface/scheduler/workflow-sleep-contracts.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

function createSchedulerTestHarness(ctx: ReturnType<typeof createIntegrationContext>) {
  const taskId = newId("task");
  const executionId = newId("exec");
  const workflowId = "scheduler_test_workflow";
  const testNow = nowIso();

  ctx.db.transaction(() => {
    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId: null,
      title: "Scheduler integration test task",
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: JSON.stringify({ request: "Test scheduler integration" }),
      normalizedInputJson: JSON.stringify({ request: "Test scheduler integration" }),
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: testNow,
      updatedAt: testNow,
      completedAt: null,
    });

    ctx.store.insertExecution({
      id: executionId,
      taskId,
      workflowId,
      parentExecutionId: null,
      agentId: "agent-scheduler-test",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: `trace-${executionId}`,
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
      startedAt: testNow,
      finishedAt: null,
      createdAt: testNow,
      updatedAt: testNow,
    });

    ctx.store.insertWorkflowState({
      taskId,
      divisionId: "general_ops",
      workflowId,
      currentStepIndex: 0,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: testNow,
      updatedAt: testNow,
    });
  });

  return { ctx, taskId, executionId, workflowId, service: new LongRunningWorkflowService(ctx.store) };
}

test("LongRunningWorkflowService suspends workflow and updates status to paused", () => {
  const ctx = createIntegrationContext("aa-scheduler-suspend-");
  try {
    const h = createSchedulerTestHarness(ctx);

    const suspension = h.service.suspend({
      taskId: h.taskId,
      executionId: h.executionId,
      reasonCode: "test_suspend",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "fail_workflow",
    });

    assert.equal(suspension.taskId, h.taskId);
    assert.equal(suspension.status, "active");
    assert.equal(suspension.reasonCode, "test_suspend");

    const workflowState = h.ctx.store.workflow.getWorkflowState(h.taskId);
    assert.equal(workflowState?.status, "paused");
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService resumes workflow when resumeAfter is past", () => {
  const ctx = createIntegrationContext("aa-scheduler-resume-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const pastTime = new Date(Date.now() - 1000).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "test_resume",
      waitKind: "timer",
      resumableFromStep: "step_1",
      resumeAfter: pastTime,
      timeoutPolicy: "fail_workflow",
    });

    const decision = h.service.resume(suspension.suspensionId);

    assert.equal(decision.allowed, true);
    assert.equal(decision.reasonCode, "workflow_sleep.resume_allowed");
    assert.equal(decision.nextWorkflowStatus, "resuming");

    const workflowState = h.ctx.store.workflow.getWorkflowState(h.taskId);
    assert.equal(workflowState?.status, "resuming");
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService rejects resume when resumeAfter is in future", () => {
  const ctx = createIntegrationContext("aa-scheduler-reject-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const futureTime = new Date(Date.now() + 60000).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "premature_resume",
      waitKind: "timer",
      resumableFromStep: "wait_step",
      resumeAfter: futureTime,
      timeoutPolicy: "fail_workflow",
    });

    const decision = h.service.resume(suspension.suspensionId);

    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "workflow_sleep.resume_not_due");
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService expires workflow when timeoutPolicy is fail_workflow", () => {
  const ctx = createIntegrationContext("aa-scheduler-expire-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const pastExpiry = new Date(Date.now() - 500).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "approval_timeout",
      waitKind: "human_input",
      resumableFromStep: "pending_approval",
      expiresAt: pastExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const decisions = h.service.sweepExpired();

    const expireDecision = decisions.find((d) => d.suspensionId === suspension.suspensionId);
    assert.ok(expireDecision != null);
    assert.equal(expireDecision?.reasonCode, "workflow_sleep.expired_failed");
    assert.equal(expireDecision?.nextWorkflowStatus, "failed");
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService expire with remain_pending does not change workflow status", () => {
  const ctx = createIntegrationContext("aa-scheduler-remain-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const pastExpiry = new Date(Date.now() - 500).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "optional_wait",
      waitKind: "timer",
      resumableFromStep: "wait_step",
      expiresAt: pastExpiry,
      timeoutPolicy: "remain_pending",
    });

    const decisions = h.service.sweepExpired();

    const expireDecision = decisions.find((d) => d.suspensionId === suspension.suspensionId);
    assert.ok(expireDecision != null);
    assert.equal(expireDecision?.reasonCode, "workflow_sleep.expired_remain_pending");
    assert.equal(expireDecision?.nextWorkflowStatus, null);
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService marks suspensions due when resumeAfter is past", () => {
  const ctx = createIntegrationContext("aa-scheduler-markdue-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const pastTime = new Date(Date.now() - 1000).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "timer_wait",
      waitKind: "timer",
      resumableFromStep: "wait_step",
      resumeAfter: pastTime,
      timeoutPolicy: "fail_workflow",
    });

    const due = h.service.markDue();
    const ourDue = due.find((d) => d.suspensionId === suspension.suspensionId);

    assert.ok(ourDue != null);
    assert.equal(ourDue?.status, "resumable");
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService emits workflow events on suspend and resume", () => {
  const ctx = createIntegrationContext("aa-scheduler-events-");
  try {
    const h = createSchedulerTestHarness(ctx);

    h.service.suspend({
      taskId: h.taskId,
      reasonCode: "event_test",
      waitKind: "timer",
      resumableFromStep: "event_step",
      timeoutPolicy: "fail_workflow",
    });

    const eventsAfterSuspend = h.ctx.store.listEventsForTask(h.taskId);
    const suspendEvent = eventsAfterSuspend.find((e) => e.eventType === "workflow:suspended");
    assert.ok(suspendEvent != null, "should emit workflow:suspended event");

    const suspensions = h.service.listSuspensions();
    const suspension = suspensions.find((s) => s.reasonCode === "event_test");
    assert.ok(suspension != null);

    h.service.resume(suspension.suspensionId);

    const eventsAfterResume = h.ctx.store.listEventsForTask(h.taskId);
    const resumeEvent = eventsAfterResume.find((e) => e.eventType === "workflow:resume_requested");
    assert.ok(resumeEvent != null, "should emit workflow:resume_requested event");
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService handles all waitKind types", () => {
  const ctx = createIntegrationContext("aa-scheduler-waitkinds-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const waitKinds = ["timer", "human_input", "external_event", "throttled", "deployment_window"] as const;

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

      const retrieved = h.service.getSuspension(suspension.suspensionId);
      assert.ok(retrieved != null);
      assert.equal(retrieved?.waitKind, waitKind);
    }
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService listSuspensions returns all suspensions", () => {
  const ctx = createIntegrationContext("aa-scheduler-list-");
  try {
    const h = createSchedulerTestHarness(ctx);

    h.service.suspend({
      taskId: h.taskId,
      reasonCode: "suspension_1",
      waitKind: "timer",
      resumableFromStep: "step_1",
      timeoutPolicy: "remain_pending",
    });

    h.service.suspend({
      taskId: h.taskId,
      reasonCode: "suspension_2",
      waitKind: "human_input",
      resumableFromStep: "step_2",
      timeoutPolicy: "fail_workflow",
    });

    const allSuspensions = h.service.listSuspensions();
    assert.ok(allSuspensions.length >= 2);
  } finally {
    ctx.cleanup();
  }
});

test("toWorkflowSleepLease transforms suspension record correctly", () => {
  const ctx = createIntegrationContext("aa-scheduler-lease-");
  try {
    const h = createSchedulerTestHarness(ctx);

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "lease_test",
      waitKind: "throttled",
      resumableFromStep: "throttled_step",
      resumeAfter: new Date(Date.now() + 60000).toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      checkpointArtifactId: "artifact_checkpoint_xyz",
      timeoutPolicy: "remain_pending",
      metadata: { queueDepth: 100, priority: "high" },
    });

    const lease = toWorkflowSleepLease(suspension);

    assert.equal(lease.suspensionId, suspension.suspensionId);
    assert.equal(lease.taskId, h.taskId);
    assert.equal(lease.waitKind, "throttled");
    assert.equal(lease.status, "active");
    assert.equal(lease.checkpointArtifactId, "artifact_checkpoint_xyz");
    assert.equal(lease.timeoutPolicy, "remain_pending");
    assert.deepEqual(lease.metadata, { queueDepth: 100, priority: "high" });
  } finally {
    ctx.cleanup();
  }
});

test("toWorkflowResumeWindow identifies wait action for future resumeAfter", () => {
  const ctx = createIntegrationContext("aa-scheduler-window-wait-");
  try {
    const h = createSchedulerTestHarness(ctx);
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

    const window = toWorkflowResumeWindow(suspension, nowIso());

    assert.equal(window.due, false);
    assert.equal(window.expired, false);
    assert.equal(window.nextAction, "wait");
    assert.equal(window.resumableFromStep, "check_availability");
  } finally {
    ctx.cleanup();
  }
});

test("toWorkflowResumeWindow identifies resume action when due", () => {
  const ctx = createIntegrationContext("aa-scheduler-window-resume-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const pastTime = new Date(Date.now() - 1000).toISOString();
    const futureExpiry = new Date(Date.now() + 600000).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "timer_fired",
      waitKind: "timer",
      resumableFromStep: "process_timer",
      resumeAfter: pastTime,
      expiresAt: futureExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const window = toWorkflowResumeWindow(suspension, nowIso());

    assert.equal(window.due, true);
    assert.equal(window.expired, false);
    assert.equal(window.nextAction, "resume");
  } finally {
    ctx.cleanup();
  }
});

test("toWorkflowResumeWindow identifies expire action when expired", () => {
  const ctx = createIntegrationContext("aa-scheduler-window-expire-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const pastTime = new Date(Date.now() - 1000).toISOString();
    const pastExpiry = new Date(Date.now() - 500).toISOString();

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "approval_expired",
      waitKind: "human_input",
      resumableFromStep: "pending_approval",
      resumeAfter: pastTime,
      expiresAt: pastExpiry,
      timeoutPolicy: "fail_workflow",
    });

    const window = toWorkflowResumeWindow(suspension, nowIso());

    assert.equal(window.due, false);
    assert.equal(window.expired, true);
    assert.equal(window.nextAction, "expire");
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService sweeper handles multiple suspensions with mixed timeout policies", () => {
  const ctx = createIntegrationContext("aa-scheduler-sweep-multi-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const testNow = nowIso();
    const pastExpiry = new Date(Date.now() - 500).toISOString();

    // Insert second task and workflow for sweep test
    const taskId2 = newId("task");
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId2,
        parentId: null,
        rootId: taskId2,
        divisionId: "general_ops",
        tenantId: null,
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
        createdAt: testNow,
        updatedAt: testNow,
        completedAt: null,
      });

      ctx.store.insertWorkflowState({
        taskId: taskId2,
        divisionId: "general_ops",
        workflowId: "sweep_workflow",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: testNow,
        updatedAt: testNow,
      });
    });

    // Suspend first task with fail_workflow
    h.service.suspend({
      taskId: h.taskId,
      reasonCode: "expire_fail",
      waitKind: "timer",
      resumableFromStep: "step1",
      expiresAt: pastExpiry,
      timeoutPolicy: "fail_workflow",
    });

    // Suspend second task with remain_pending
    h.service.suspend({
      taskId: taskId2,
      reasonCode: "expire_remain",
      waitKind: "human_input",
      resumableFromStep: "step2",
      expiresAt: pastExpiry,
      timeoutPolicy: "remain_pending",
    });

    const decisions = h.service.sweepExpired();

    const failDecision = decisions.find((d) => d.reasonCode === "workflow_sleep.expired_failed");
    const remainDecision = decisions.find((d) => d.reasonCode === "workflow_sleep.expired_remain_pending");

    assert.ok(failDecision != null, "should have fail_workflow decision");
    assert.equal(failDecision?.nextWorkflowStatus, "failed");
    assert.ok(remainDecision != null, "should have remain_pending decision");
    assert.equal(remainDecision?.nextWorkflowStatus, null);
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService throws error when suspending terminal workflow", () => {
  const ctx = createIntegrationContext("aa-scheduler-terminal-");
  try {
    const h = createSchedulerTestHarness(ctx);

    // First complete the workflow
    h.ctx.store.workflow.updateWorkflowState(
      h.taskId,
      "completed",
      0,
      "{}",
      nowIso(),
      null
    );

    assert.throws(
      () =>
        h.service.suspend({
          taskId: h.taskId,
          reasonCode: "should_fail",
          waitKind: "timer",
          resumableFromStep: "step_1",
          timeoutPolicy: "fail_workflow",
        }),
      (error) =>
        error instanceof Error && error.message.includes("terminal_workflow"),
    );
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService throws error when suspending non-existent workflow", () => {
  const ctx = createIntegrationContext("aa-scheduler-notfound-");
  try {
    const h = createSchedulerTestHarness(ctx);

    assert.throws(
      () =>
        h.service.suspend({
          taskId: "non_existent_task",
          reasonCode: "should_fail",
          waitKind: "timer",
          resumableFromStep: "step_1",
          timeoutPolicy: "fail_workflow",
        }),
      (error) =>
        error instanceof Error && error.message.includes("workflow_not_found"),
    );
  } finally {
    ctx.cleanup();
  }
});

test("LongRunningWorkflowService preserves metadata through suspend and resume lifecycle", () => {
  const ctx = createIntegrationContext("aa-scheduler-metadata-");
  try {
    const h = createSchedulerTestHarness(ctx);
    const metadata = { source: "integration_test", correlationId: "test-123", extra: { nested: true } };

    const suspension = h.service.suspend({
      taskId: h.taskId,
      reasonCode: "metadata_test",
      waitKind: "external_event",
      resumableFromStep: "process_event",
      timeoutPolicy: "remain_pending",
      metadata,
    });

    const retrieved = h.service.getSuspension(suspension.suspensionId);
    assert.deepEqual(retrieved?.metadata, metadata);

    const lease = toWorkflowSleepLease(retrieved!);
    assert.deepEqual(lease.metadata, metadata);
  } finally {
    ctx.cleanup();
  }
});
