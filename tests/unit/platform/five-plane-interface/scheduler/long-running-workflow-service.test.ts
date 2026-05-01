import { strict as assert } from "node:assert";
import { test } from "node:test";
import { LongRunningWorkflowService } from "../../../../../src/platform/five-plane-interface/scheduler/long-running-workflow-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { WorkflowStateRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMockTaskStore(workflowOverrides?: Partial<WorkflowStateRecord>): AuthoritativeTaskStore {
  const workflow: WorkflowStateRecord = {
    taskId: "task_123",
    workflowId: "wf_456",
    divisionId: "div_789",
    status: "running",
    currentStepIndex: 2,
    outputsJson: "{}",
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: null,
    startedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...workflowOverrides,
  };

  return {
    workflow: {
      getWorkflowState: (taskId: string) => {
        if (taskId === workflow.taskId) {
          return workflow;
        }
        return null;
      },
      updateWorkflowState: () => {},
    },
    event: {
      insertEvent: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

test("LongRunningWorkflowService suspend creates suspension record", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const result = service.suspend({
    taskId: "task_123",
    executionId: "exec_456",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-05-01T01:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  assert.ok(result.suspensionId.startsWith("workflow_sleep_"));
  assert.equal(result.taskId, "task_123");
  assert.equal(result.executionId, "exec_456");
  assert.equal(result.workflowId, "wf_456");
  assert.equal(result.divisionId, "div_789");
  assert.equal(result.reasonCode, "timer");
  assert.equal(result.waitKind, "timer");
  assert.equal(result.status, "active");
  assert.equal(result.resumableFromStep, "step_3");
  assert.equal(result.timeoutPolicy, "fail_workflow");
});

test("LongRunningWorkflowService suspend throws for terminal workflow", () => {
  const store = createMockTaskStore({ status: "completed" });
  const service = new LongRunningWorkflowService(store);

  assert.throws(
    () =>
      service.suspend({
        taskId: "task_123",
        reasonCode: "timer",
        waitKind: "timer",
        resumableFromStep: "step_3",
        timeoutPolicy: "fail_workflow",
      }),
    /terminal_workflow/,
  );
});

test("LongRunningWorkflowService suspend throws for non-existent task", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  assert.throws(
    () =>
      service.suspend({
        taskId: "non_existent_task",
        reasonCode: "timer",
        waitKind: "timer",
        resumableFromStep: "step_3",
        timeoutPolicy: "fail_workflow",
      }),
    /workflow_not_found/,
  );
});

test("LongRunningWorkflowService markDue returns suspensions ready to resume", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-04-30T00:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const due = service.markDue("2026-05-01T00:00:00.000Z");

  assert.equal(due.length, 1);
  assert.equal(due[0].status, "resumable");
});

test("LongRunningWorkflowService markDue excludes future suspensions", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-05-02T00:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const due = service.markDue("2026-05-01T00:00:00.000Z");

  assert.equal(due.length, 0);
});

test("LongRunningWorkflowService markDue excludes expired suspensions", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const record = service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-04-30T00:00:00.000Z",
    expiresAt: "2026-04-30T00:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const due = service.markDue("2026-05-01T00:00:00.000Z");

  assert.equal(due.length, 0);
});

test("LongRunningWorkflowService resume returns allowed decision when due", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const record = service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-04-30T00:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const decision = service.resume(record.suspensionId, "2026-05-01T00:00:00.000Z");

  assert.ok(decision.allowed);
  assert.equal(decision.suspensionId, record.suspensionId);
  assert.equal(decision.taskId, "task_123");
  assert.equal(decision.nextWorkflowStatus, "resuming");
});

test("LongRunningWorkflowService resume returns not allowed when not yet due", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const record = service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-05-02T00:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const decision = service.resume(record.suspensionId, "2026-05-01T00:00:00.000Z");

  assert.ok(!decision.allowed);
  assert.equal(decision.reasonCode, "workflow_sleep.resume_not_due");
});

test("LongRunningWorkflowService resume expires when past expiresAt", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const record = service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-05-02T00:00:00.000Z",
    expiresAt: "2026-05-01T00:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const decision = service.resume(record.suspensionId, "2026-05-01T00:00:00.000Z");

  assert.ok(!decision.allowed);
  assert.equal(decision.reasonCode, "workflow_sleep.expired_failed");
  assert.equal(decision.nextWorkflowStatus, "failed");
});

test("LongRunningWorkflowService resume remain_pending when timeoutPolicy is remain_pending", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const record = service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    expiresAt: "2026-05-01T00:00:00.000Z",
    timeoutPolicy: "remain_pending",
  });

  const decision = service.resume(record.suspensionId, "2026-05-01T00:00:00.000Z");

  assert.ok(!decision.allowed);
  assert.equal(decision.reasonCode, "workflow_sleep.expired_remain_pending");
  assert.equal(decision.nextWorkflowStatus, null);
});

test("LongRunningWorkflowService sweepExpired expires active suspensions past deadline", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    expiresAt: "2026-05-01T00:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const decisions = service.sweepExpired("2026-05-01T00:00:00.000Z");

  assert.equal(decisions.length, 1);
  assert.ok(!decisions[0].allowed);
  assert.equal(decisions[0].reasonCode, "workflow_sleep.expired_failed");
});

test("LongRunningWorkflowService sweepExpired ignores non-expired suspensions", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    expiresAt: "2026-05-02T00:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const decisions = service.sweepExpired("2026-05-01T00:00:00.000Z");

  assert.equal(decisions.length, 0);
});

test("LongRunningWorkflowService getSuspension returns record by id", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const record = service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    timeoutPolicy: "fail_workflow",
  });

  const found = service.getSuspension(record.suspensionId);

  assert.ok(found);
  assert.equal(found!.suspensionId, record.suspensionId);
});

test("LongRunningWorkflowService getSuspension returns null for unknown id", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const found = service.getSuspension("unknown_suspension");

  assert.equal(found, null);
});

test("LongRunningWorkflowService listSuspensions returns all records", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    timeoutPolicy: "fail_workflow",
  });

  service.suspend({
    taskId: "task_123",
    reasonCode: "human_input",
    waitKind: "human_input",
    resumableFromStep: "step_3",
    timeoutPolicy: "fail_workflow",
  });

  const suspensions = service.listSuspensions();

  assert.equal(suspensions.length, 2);
});

test("LongRunningWorkflowService buildSleepLease creates lease from suspension", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const record = service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-05-01T01:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const lease = service.buildSleepLease(record.suspensionId);

  assert.equal(lease.suspensionId, record.suspensionId);
  assert.equal(lease.taskId, record.taskId);
  assert.equal(lease.workflowId, record.workflowId);
  assert.equal(lease.status, "active");
});

test("LongRunningWorkflowService buildSleepLease throws for unknown suspension", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  assert.throws(
    () => service.buildSleepLease("unknown_suspension"),
    /suspension_not_found/,
  );
});

test("LongRunningWorkflowService buildResumeWindow creates window for suspension", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  const record = service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-05-01T01:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const window = service.buildResumeWindow(record.suspensionId, "2026-05-01T00:30:00.000Z");

  assert.equal(window.suspensionId, record.suspensionId);
  assert.ok(window.due);
  assert.ok(!window.expired);
  assert.equal(window.nextAction, "resume");
});

test("LongRunningWorkflowService listResumeWindows returns windows for all suspensions", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  service.suspend({
    taskId: "task_123",
    reasonCode: "timer",
    waitKind: "timer",
    resumableFromStep: "step_3",
    resumeAfter: "2026-05-01T01:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  service.suspend({
    taskId: "task_123",
    reasonCode: "human_input",
    waitKind: "human_input",
    resumableFromStep: "step_3",
    resumeAfter: "2026-05-01T02:00:00.000Z",
    expiresAt: "2026-05-01T12:00:00.000Z",
    timeoutPolicy: "fail_workflow",
  });

  const windows = service.listResumeWindows("2026-05-01T00:30:00.000Z");

  assert.equal(windows.length, 2);
  assert.ok(windows[0].due);
  assert.ok(!windows[1].due);
});

test("LongRunningWorkflowService resume throws for unknown suspension", () => {
  const store = createMockTaskStore();
  const service = new LongRunningWorkflowService(store);

  assert.throws(
    () => service.resume("unknown_suspension", "2026-05-01T00:00:00.000Z"),
    /suspension_not_found/,
  );
});
