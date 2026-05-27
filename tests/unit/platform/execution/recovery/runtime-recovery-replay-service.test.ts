import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRecoveryReplayService,
  type RecoveryReplayExecutionOutcome,
  type RecoveryReplayTaskOutcome,
  type RecoveryReplayDecision,
  type RecoveryReplayRepair,
  type RecoveryReplayTimelineEvent,
} from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-replay-service.js";

// Mock store helper - minimal mock for basic tests
function createMockStore(overrides: {
  tasks?: Array<{ id: string; divisionId?: string | null; status: string }>;
  executions?: Array<{ id: string; taskId: string; traceId: string; attempt: number; status: string; lastErrorCode?: string | null }>;
  deadLetters?: Array<{ id: string; executionId: string; taskId: string; finalReasonCode: string; retryCount: number; lastErrorMessage: string; movedAt: string }>;
  events?: Array<{ id: string; taskId: string; executionId?: string | null; eventType: string; payloadJson: string; createdAt: string; traceId?: string | null }>;
  recoveryRecords?: Array<Record<string, unknown>>;
  approvals?: Array<{ id: string; taskId: string; status: string }>;
  prechecks?: Array<{ executionId: string; allowed: number; reasonCode: string | null; resolvedBudgetUsd: number | null; resolvedTimeoutMs: number; resolvedSandboxMode: string; resolvedToolsJson: string | null; resolvedPathsJson: string | null; checkedAt: string }>;
} = {}) {
  return {
    listEventsForTask: (taskId: string) => overrides.events?.filter((event) => event.taskId === taskId) ?? [],
    task: {
      getTask: (id: string) => overrides.tasks?.find((t) => t.id === id) ?? null,
    },
    execution: {
      listExecutionsByTask: (taskId: string) => overrides.executions?.filter((execution) => execution.taskId === taskId) ?? [],
      getExecutionPrecheck: (executionId: string) => overrides.prechecks?.find((precheck) => precheck.executionId === executionId) ?? null,
    },
    dispatch: {
      getExecution: (executionId: string) => overrides.executions?.find((execution) => execution.id === executionId) ?? null,
      getDeadLetterByExecutionId: (executionId: string) => overrides.deadLetters?.find((deadLetter) => deadLetter.executionId === executionId) ?? null,
      listDeadLettersByTask: (taskId: string) => overrides.deadLetters?.filter((deadLetter) => deadLetter.taskId === taskId) ?? [],
      getExecutionPrecheck: (executionId: string) => overrides.prechecks?.find((precheck) => precheck.executionId === executionId) ?? null,
    },
    event: {
      listEventsForTask: (taskId: string) => overrides.events?.filter((event) => event.taskId === taskId) ?? [],
    },
    operations: {
      buildRuntimeRecoveryView: () => overrides.recoveryRecords ?? [],
    },
    approval: {
      listApprovalsByTask: (taskId: string) => overrides.approvals?.filter((approval) => approval.taskId === taskId) ?? [],
    },
    artifact: {
      listArtifactsByTask: () => [],
    },
  };
}

function createRecoveryRecord(overrides: Record<string, unknown> = {}) {
  return {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "division-1",
    taskStatus: "in_progress",
    status: "executing",
    attempt: 2,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: "E1",
    updatedAt: "2026-04-24T00:00:00.000Z",
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    ...overrides,
  };
}

test("RuntimeRecoveryReplayService can be instantiated [runtime-recovery-replay-service]", () => {
  const store = createMockStore();
  const service = new RuntimeRecoveryReplayService(store);

  assert.ok(service != null);
});

test("RuntimeRecoveryReplayService.buildTaskReplayReport throws when task not found [runtime-recovery-replay-service]", () => {
  const store = createMockStore({ tasks: [] });
  const service = new RuntimeRecoveryReplayService(store);

  assert.throws(
    () => service.buildTaskReplayReport("nonexistent-task"),
    (err: unknown) => (err as Error).message.includes("Task not found"),
  );
});

test("RuntimeRecoveryReplayService.buildExecutionReplayReport throws when execution not found [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
  });
  const service = new RuntimeRecoveryReplayService(store);

  assert.throws(
    () => service.buildExecutionReplayReport("nonexistent-exec"),
    (err: unknown) => (err as Error).message.includes("Execution not found"),
  );
});

test("RuntimeRecoveryReplayService.buildExecutionReplayReport fails closed when task report omits execution [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
    executions: [{ id: "exec-hidden", taskId: "task-1", traceId: "trace-1", attempt: 1, status: "failed", lastErrorCode: "E1" }],
  });
  const service = new RuntimeRecoveryReplayService(store as never);
  const originalBuildTaskReplayReport = service.buildTaskReplayReport.bind(service);
  service.buildTaskReplayReport = ((taskId: string, generatedAt?: string) => ({
    ...originalBuildTaskReplayReport(taskId, generatedAt),
    executions: [],
  })) as RuntimeRecoveryReplayService["buildTaskReplayReport"];

  assert.throws(
    () => service.buildExecutionReplayReport("exec-hidden"),
    (err: unknown) => (err as Error).message.includes("Execution replay report not found"),
  );
});

test("RecoveryReplayExecutionOutcome type accepts all valid values [runtime-recovery-replay-service]", () => {
  const outcomes: RecoveryReplayExecutionOutcome[] = [
    "active",
    "repair_pending",
    "manual_handoff",
    "dead_lettered",
    "cancelled",
    "no_recovery_activity",
  ];

  assert.equal(outcomes.length, 6);
});

test("RecoveryReplayTaskOutcome type accepts all valid values [runtime-recovery-replay-service]", () => {
  const outcomes: RecoveryReplayTaskOutcome[] = [
    "active",
    "repair_pending",
    "manual_handoff",
    "dead_lettered",
    "cancelled",
    "no_recovery_activity",
    "mixed",
  ];

  assert.equal(outcomes.length, 7);
});

test("RecoveryReplayDecision has correct structure [runtime-recovery-replay-service]", () => {
  const decision: RecoveryReplayDecision = {
    eventId: "evt-1",
    decisionId: "dec-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    action: "cancel",
    reason: "execution_error:E1",
    decidedBy: "service",
  };

  assert.ok("eventId" in decision);
  assert.ok("decisionId" in decision);
  assert.ok("createdAt" in decision);
  assert.ok("action" in decision);
  assert.ok("reason" in decision);
  assert.ok("decidedBy" in decision);
});

test("RecoveryReplayRepair has correct structure [runtime-recovery-replay-service]", () => {
  const repair: RecoveryReplayRepair = {
    eventId: "evt-1",
    createdAt: "2025-01-01T00:00:00.000Z",
    repairAction: "requeue_execution",
    targetId: "exec-1",
    detail: "execution requeued",
  };

  assert.ok("eventId" in repair);
  assert.ok("createdAt" in repair);
  assert.ok("repairAction" in repair);
  assert.ok("targetId" in repair);
  assert.ok("detail" in repair);
});

test("RecoveryReplayTimelineEvent has correct structure [runtime-recovery-replay-service]", () => {
  const event: RecoveryReplayTimelineEvent = {
    eventId: "evt-1",
    eventType: "recovery:repair_applied",
    createdAt: "2025-01-01T00:00:00.000Z",
    traceId: "trace-1",
    summary: "repair requeue_execution applied to exec-1",
    decisionId: null,
    decisionAction: null,
    reason: null,
    decidedBy: null,
    repairAction: "requeue_execution",
    targetId: "exec-1",
    deadLetterId: null,
  };

  assert.ok("eventId" in event);
  assert.ok("eventType" in event);
  assert.ok("createdAt" in event);
  assert.ok("traceId" in event);
  assert.ok("summary" in event);
  assert.ok("decisionId" in event);
  assert.ok("decisionAction" in event);
  assert.ok("reason" in event);
  assert.ok("decidedBy" in event);
  assert.ok("repairAction" in event);
  assert.ok("targetId" in event);
  assert.ok("deadLetterId" in event);
});

test("RuntimeRecoveryReplayService.buildTaskReplayReport returns report [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "division-1", status: "in_progress" }],
    executions: [{ id: "exec-1", taskId: "task-1", traceId: "trace-1", attempt: 2, status: "executing", lastErrorCode: "E1" }],
    recoveryRecords: [createRecoveryRecord()],
    approvals: [{ id: "approval-1", taskId: "task-1", status: "requested" }],
    events: [
      {
        id: "evt-1",
        taskId: "task-1",
        executionId: "exec-1",
        eventType: "recovery:decision_recorded",
        payloadJson: JSON.stringify({ decisionId: "dec-1", action: "move_dead_letter", reason: "execution_error:E1", decidedBy: "service" }),
        createdAt: "2026-04-24T00:00:00.000Z",
        traceId: "trace-1",
      },
      {
        id: "evt-2",
        taskId: "task-1",
        executionId: "exec-1",
        eventType: "recovery:repair_applied",
        payloadJson: JSON.stringify({ repairAction: "requeue_execution", targetId: "exec-1" }),
        createdAt: "2026-04-24T00:00:01.000Z",
        traceId: "trace-1",
      },
    ],
  });
  const service = new RuntimeRecoveryReplayService(store as never);

  const report = service.buildTaskReplayReport("task-1");

  assert.equal(report.taskId, "task-1");
  assert.equal(report.activeExecutionId, "exec-1");
  assert.equal(report.candidateCount, 1);
  assert.equal(report.requestedApprovalCount, 1);
  assert.equal(report.recoveryEventCount, 2);
  assert.equal(report.executions.length, 1);
});

test("RuntimeRecoveryReplayService.buildExecutionReplayReport returns report [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "division-1", status: "in_progress" }],
    executions: [{ id: "exec-1", taskId: "task-1", traceId: "trace-1", attempt: 2, status: "failed", lastErrorCode: "E1" }],
    deadLetters: [{ id: "dlq-1", executionId: "exec-1", taskId: "task-1", finalReasonCode: "E1", retryCount: 2, lastErrorMessage: "boom", movedAt: "2026-04-24T00:00:02.000Z" }],
    recoveryRecords: [createRecoveryRecord({ status: "failed" })],
    events: [
      {
        id: "evt-1",
        taskId: "task-1",
        executionId: "exec-1",
        eventType: "recovery:decision_recorded",
        payloadJson: JSON.stringify({ decisionId: "dec-1", action: "move_dead_letter", reason: "execution_error:E1", decidedBy: "service" }),
        createdAt: "2026-04-24T00:00:00.000Z",
        traceId: "trace-1",
      },
      {
        id: "evt-2",
        taskId: "task-1",
        executionId: "exec-1",
        eventType: "recovery:dead_lettered",
        payloadJson: JSON.stringify({ deadLetterId: "dlq-1" }),
        createdAt: "2026-04-24T00:00:02.000Z",
        traceId: "trace-1",
      },
    ],
  });
  const service = new RuntimeRecoveryReplayService(store as never);

  const report = service.buildExecutionReplayReport("exec-1");

  assert.equal(report.executionId, "exec-1");
  assert.equal(report.latestErrorCode, "E1");
  assert.equal(report.decisions.length, 1);
  assert.equal(report.timeline.length, 2);
  assert.equal(report.deadLetter?.id, "dlq-1");
  assert.equal(report.finalOutcome, "dead_lettered");
});

test("RuntimeRecoveryReplayService identifies active execution and counts candidates [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "division-1", status: "in_progress" }],
    executions: [
      { id: "exec-1", taskId: "task-1", traceId: "trace-1", attempt: 1, status: "executing", lastErrorCode: null },
      { id: "exec-2", taskId: "task-1", traceId: "trace-2", attempt: 2, status: "failed", lastErrorCode: "E1" },
    ],
    recoveryRecords: [createRecoveryRecord({ executionId: "exec-2", status: "failed" })],
  });
  const service = new RuntimeRecoveryReplayService(store as never);

  const report = service.buildTaskReplayReport("task-1");

  assert.equal(report.activeExecutionId, "exec-1");
  assert.equal(report.candidateCount, 1);
  assert.equal(report.executions.length, 2);
});

test("RuntimeRecoveryReplayService counts recovery events and repairs [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "division-1", status: "in_progress" }],
    executions: [{ id: "exec-1", taskId: "task-1", traceId: "trace-1", attempt: 2, status: "failed", lastErrorCode: "E1" }],
    recoveryRecords: [createRecoveryRecord({ status: "failed" })],
    events: [
      {
        id: "evt-1",
        taskId: "task-1",
        executionId: "exec-1",
        eventType: "recovery:repair_applied",
        payloadJson: JSON.stringify({ repairAction: "requeue_execution", targetId: "exec-1" }),
        createdAt: "2026-04-24T00:00:00.000Z",
        traceId: "trace-1",
      },
    ],
  });
  const service = new RuntimeRecoveryReplayService(store as never);

  const report = service.buildExecutionReplayReport("exec-1");

  assert.equal(report.repairs.length, 1);
  assert.equal(report.timeline.length, 1);
  assert.equal(report.repairs[0]!.repairAction, "requeue_execution");
});

test("RuntimeRecoveryReplayService handles task with multiple executions and mixed outcomes [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "division-1", status: "in_progress" }],
    executions: [
      { id: "exec-1", taskId: "task-1", traceId: "trace-1", attempt: 1, status: "executing", lastErrorCode: null },
      { id: "exec-2", taskId: "task-1", traceId: "trace-2", attempt: 2, status: "cancelled", lastErrorCode: "E1" },
    ],
    recoveryRecords: [createRecoveryRecord({ executionId: "exec-2", status: "cancelled" })],
    events: [
      {
        id: "evt-1",
        taskId: "task-1",
        executionId: "exec-2",
        eventType: "recovery:cancelled",
        payloadJson: JSON.stringify({ action: "cancel", decidedBy: "service" }),
        createdAt: "2026-04-24T00:00:00.000Z",
        traceId: "trace-2",
      },
    ],
  });
  const service = new RuntimeRecoveryReplayService(store as never);

  const report = service.buildTaskReplayReport("task-1");

  assert.equal(report.outcome, "mixed");
  assert.ok(report.executions.some((execution) => execution.executionId === "exec-2" && execution.latestErrorCode === "E1"));
});

test("RuntimeRecoveryReplayService does not attach dead-letter targetId events to unrelated execution [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "division-1", status: "failed" }],
    executions: [{ id: "exec-1", taskId: "task-1", traceId: "trace-1", attempt: 1, status: "failed", lastErrorCode: "E1" }],
    events: [
      {
        id: "evt-dead-letter",
        taskId: "task-1",
        executionId: null,
        eventType: "recovery:dead_lettered",
        payloadJson: JSON.stringify({ targetId: "exec-1", deadLetterId: "dlq-1" }),
        createdAt: "2026-04-24T00:00:00.000Z",
        traceId: "trace-1",
      },
    ],
  });
  const service = new RuntimeRecoveryReplayService(store as never);

  const report = service.buildExecutionReplayReport("exec-1");

  assert.equal(report.timeline.length, 0);
  assert.equal(report.finalOutcome, "no_recovery_activity");
});

test("RuntimeRecoveryReplayService orders timeline by parsed timestamp before lexical timestamp [runtime-recovery-replay-service]", () => {
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "division-1", status: "failed" }],
    executions: [{ id: "exec-1", taskId: "task-1", traceId: "trace-1", attempt: 1, status: "failed", lastErrorCode: "E1" }],
    events: [
      {
        id: "evt-late",
        taskId: "task-1",
        executionId: "exec-1",
        eventType: "recovery:repair_applied",
        payloadJson: JSON.stringify({ repairAction: "late", targetId: "exec-1" }),
        createdAt: "2026-04-24T00:00:10.000+08:00",
        traceId: "trace-1",
      },
      {
        id: "evt-early",
        taskId: "task-1",
        executionId: "exec-1",
        eventType: "recovery:repair_applied",
        payloadJson: JSON.stringify({ repairAction: "early", targetId: "exec-1" }),
        createdAt: "2026-04-23T16:00:09.000Z",
        traceId: "trace-1",
      },
    ],
  });
  const service = new RuntimeRecoveryReplayService(store as never);

  const report = service.buildExecutionReplayReport("exec-1");

  assert.deepEqual(report.timeline.map((event) => event.eventId), ["evt-early", "evt-late"]);
});
