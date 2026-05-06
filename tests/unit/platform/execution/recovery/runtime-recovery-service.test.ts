import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRecoveryService,
  type RuntimeRecoveryCandidate,
  type RecoverySuggestedAction,
  type TaskRuntimeRecoveryView,
  type DivisionRecoveryOverview,
  type LegacyRecoveryCandidate,
} from "../../../../../src/platform/execution/recovery/runtime-recovery-service.js";
import type { RuntimeRecoveryRecord } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

function createMockStore(overrides: {
  tasks?: Array<{ id: string; divisionId?: string | null; status: string }>;
  operations?: {
    listRecoverableExecutingRuns?: () => RuntimeRecoveryRecord[];
    listStaleRuns?: () => RuntimeRecoveryRecord[];
    buildRuntimeRecoveryView?: () => RuntimeRecoveryRecord[];
    listRuntimeRecoveryRecords?: () => RuntimeRecoveryRecord[];
  };
  event?: {
    listEventsForTask?: () => {
      events: Array<{
        id: string;
        eventType: string;
        payloadJson: string;
        createdAt: string;
        traceId?: string | null;
      }>;
    };
  };
  artifact?: {
    listArtifactsByTask?: () => Array<{
      artifactId: string;
      artifactType: string;
      createdAt: string;
    }>;
  };
  approval?: {
    listApprovalsByTask?: () => Array<{ id: string; status: string }>;
  };
  dispatch?: {
    listDeadLettersByTask?: () => Array<{ id: string }>;
  };
  task?: {
    getTask?: (id: string) => { id: string; divisionId?: string | null; status: string } | null;
  };
} = {}) {
  return {
    task: {
      getTask: (id: string) => {
        const task = overrides.tasks?.find((t) => t.id === id);
        return task ? { id: task.id, divisionId: task.divisionId ?? null, status: task.status ?? "pending" } : null;
      },
    },
    operations: {
      listRecoverableExecutingRuns: overrides.operations?.listRecoverableExecutingRuns ?? (() => []),
      listStaleRuns: overrides.operations?.listStaleRuns ?? (() => []),
      buildRuntimeRecoveryView: overrides.operations?.buildRuntimeRecoveryView ?? (() => []),
      listRuntimeRecoveryRecords: overrides.operations?.listRuntimeRecoveryRecords ?? (() => []),
    },
    listBlockedRunsAwaitingApproval: () => overrides.operations?.listBlockedRunsAwaitingApproval?.() ?? [],
    event: {
      listEventsForTask: overrides.event?.listEventsForTask ?? (() => ({ events: [] })),
    },
    artifact: {
      listArtifactsByTask: overrides.artifact?.listArtifactsByTask ?? (() => []),
    },
    approval: {
      listApprovalsByTask: overrides.approval?.listApprovalsByTask ?? (() => []),
    },
    dispatch: {
      listDeadLettersByTask: overrides.dispatch?.listDeadLettersByTask ?? (() => []),
    },
  } as unknown as ReturnType<typeof RuntimeRecoveryService> extends { store: infer S } ? S : never;
}

function makeRecoveryRecord(overrides: Partial<RuntimeRecoveryRecord> = {}): RuntimeRecoveryRecord {
  return {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: new Date().toISOString(),
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    ...overrides,
  };
}

test("RuntimeRecoveryService can be instantiated with a store", () => {
  const store = createMockStore();
  const service = new RuntimeRecoveryService(store);
  assert.ok(service != null);
});

test("RuntimeRecoveryService.listRecoverableExecutingRuns returns empty when no records", () => {
  const store = createMockStore();
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.deepEqual(results, []);
});

test("RuntimeRecoveryService.listRecoverableExecutingRuns returns candidates", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1" });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results.length, 1);
  assert.equal(results[0]!.executionId, "exec-1");
});

test("RuntimeRecoveryService.listRecoverableExecutingRuns includes taskId in candidate", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-xyz" });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.taskId, "task-xyz");
});

test("RuntimeRecoveryService.listRecoverableExecutingRuns includes divisionId", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", divisionId: "div-123" });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.divisionId, "div-123");
});

test("RuntimeRecoveryService.listRecoverableExecutingRuns includes traceId", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", traceId: "trace-abc" });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.traceId, "trace-abc");
});

test("RuntimeRecoveryService.listRecoverableExecutingRuns includes attempt count", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", attempt: 5 });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.attempt, 5);
});

test("RuntimeRecoveryService.listRecoverableExecutingRuns includes workflowId", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", workflowId: "wf-1" });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.workflowId, "wf-1");
});

test("RuntimeRecoveryService.listStaleRuns returns candidates with stale_execution reason", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", status: "executing" });
  const store = createMockStore({
    operations: {
      listStaleRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listStaleRuns("2025-01-01T00:00:00.000Z");
  assert.equal(results.length, 1);
  assert.equal(results[0]!.executionId, "exec-1");
  assert.equal(results[0]!.reason, "stale_execution");
  assert.equal(results[0]!.suggestedAction, "retry_new_ticket");
});

test("RuntimeRecoveryService.listBlockedRunsAwaitingApproval returns candidates", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    pendingApprovalId: "approval-1",
  });
  const store = createMockStore({
    operations: {
      listBlockedRunsAwaitingApproval: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listBlockedRunsAwaitingApproval();
  assert.equal(results.length, 1);
  assert.equal(results[0]!.executionId, "exec-1");
  assert.equal(results[0]!.reason, "approval_pending");
  assert.equal(results[0]!.suggestedAction, "escalate_takeover");
});

test("RuntimeRecoveryService.buildRuntimeRecoveryView throws when task not found", () => {
  const store = createMockStore({
    tasks: [],
  });
  const service = new RuntimeRecoveryService(store);
  assert.throws(
    () => service.buildRuntimeRecoveryView("nonexistent-task"),
    (err: unknown) => (err as Error).message.includes("Task not found"),
  );
});

test("RuntimeRecoveryService.buildRuntimeRecoveryView returns view for valid task", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1" });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "div-1", status: "pending" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.taskId, "task-1");
  assert.equal(view.divisionId, "div-1");
  assert.equal(view.candidates.length, 1);
  assert.equal(view.requestedApprovals.length, 0);
  assert.equal(view.deadLetters.length, 0);
});

test("RuntimeRecoveryService.buildRuntimeRecoveryView includes pending approvals", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1" });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    approval: {
      listApprovalsByTask: () => [{ id: "approval-1", status: "requested" }],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.requestedApprovals.length, 1);
  assert.equal(view.requestedApprovals[0]!.id, "approval-1");
});

test("RuntimeRecoveryService.buildRuntimeRecoveryView includes dead letters", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1" });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "failed" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    dispatch: {
      listDeadLettersByTask: () => [{ id: "dlq-1" }],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.deadLetters.length, 1);
  assert.equal(view.deadLetters[0]!.id, "dlq-1");
});

test("RuntimeRecoveryService.buildRuntimeRecoveryView filters non-requested approvals", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1" });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    approval: {
      listApprovalsByTask: () => [
        { id: "approval-1", status: "requested" },
        { id: "approval-2", status: "approved" },
      ],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.requestedApprovals.length, 1);
  assert.equal(view.requestedApprovals[0]!.id, "approval-1");
});

test("RuntimeRecoveryService.listDivisionRecoveryOverview returns empty when no active candidates", () => {
  const store = createMockStore();
  const service = new RuntimeRecoveryService(store);
  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");
  assert.deepEqual(overview, []);
});

test("RuntimeRecoveryService.listDivisionRecoveryOverview groups by division", () => {
  const records = [
    makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1", divisionId: "div-1" }),
    makeRecoveryRecord({ executionId: "exec-2", taskId: "task-2", divisionId: "div-1" }),
    makeRecoveryRecord({ executionId: "exec-3", taskId: "task-3", divisionId: "div-2" }),
  ];
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => records,
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");
  assert.equal(overview.length, 2);
  const div1 = overview.find((d) => d.divisionId === "div-1");
  const div2 = overview.find((d) => d.divisionId === "div-2");
  assert.ok(div1);
  assert.ok(div2);
  assert.equal(div1!.activeCandidateCount, 2);
  assert.equal(div2!.activeCandidateCount, 1);
});

test("RuntimeRecoveryService.listDivisionRecoveryOverview tracks stale and blocked counts", () => {
  const activeRecords = [
    makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1", divisionId: "div-1" }),
  ];
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => activeRecords,
      listStaleRuns: () => activeRecords,
      listBlockedRunsAwaitingApproval: () => activeRecords,
    },
  });
  const service = new RuntimeRecoveryService(store);
  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");
  assert.equal(overview.length, 1);
  assert.equal(overview[0]!.staleExecutionCount, 1);
  assert.equal(overview[0]!.blockedApprovalCount, 1);
});

test("RuntimeRecoveryService.listDivisionRecoveryOverview handles null divisionId as unassigned", () => {
  const records = [
    makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1", divisionId: null }),
  ];
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => records,
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");
  assert.equal(overview.length, 1);
  assert.equal(overview[0]!.divisionId, "unassigned");
});

test("RuntimeRecoveryService infers reason as active_execution when no issues", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestErrorCode: null,
    pendingApprovalId: null,
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.reason, "active_execution");
  assert.equal(results[0]!.suggestedAction, "resume_same_worker");
});

test("RuntimeRecoveryService suggests cancel for precheck denied", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestPrecheck: {
      allowed: 0,
      reasonCode: "budget_exceeded",
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "standard",
      resolvedToolsJson: "[]",
      resolvedPathsJson: "[]",
      checkedAt: "2026-04-24T00:00:00.000Z",
    },
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.candidates[0]!.reason, "precheck_denied:budget_exceeded");
  assert.equal(view.candidates[0]!.suggestedAction, "cancel");
});

test("RuntimeRecoveryService suggests escalate_takeover for blocked without approval", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    status: "blocked",
    pendingApprovalId: null,
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.candidates[0]!.reason, "blocked_without_approval");
  assert.equal(view.candidates[0]!.suggestedAction, "escalate_takeover");
});

test("RuntimeRecoveryService tracks unique taskIds per division", () => {
  const records = [
    makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1", divisionId: "div-1" }),
    makeRecoveryRecord({ executionId: "exec-2", taskId: "task-1", divisionId: "div-1" }),
    makeRecoveryRecord({ executionId: "exec-3", taskId: "task-2", divisionId: "div-1" }),
  ];
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => records,
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");
  assert.equal(overview.length, 1);
  assert.equal(overview[0]!.taskIds.length, 2);
  assert.ok(overview[0]!.taskIds.includes("task-1"));
  assert.ok(overview[0]!.taskIds.includes("task-2"));
});

test("RuntimeRecoveryCandidate has correct structure", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "div-1",
    status: "executing",
    attempt: 2,
    traceId: "trace-abc",
    workflowId: "wf-1",
    latestErrorCode: "E1",
    lastHeartbeatAt: "2025-01-01T00:00:00.000Z",
    pendingApprovalId: null,
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  const candidate = results[0]!;
  assert.ok("executionId" in candidate);
  assert.ok("taskId" in candidate);
  assert.ok("divisionId" in candidate);
  assert.ok("status" in candidate);
  assert.ok("attempt" in candidate);
  assert.ok("traceId" in candidate);
  assert.ok("workflowId" in candidate);
  assert.ok("latestErrorCode" in candidate);
  assert.ok("updatedAt" in candidate);
  assert.ok("lastHeartbeatAt" in candidate);
  assert.ok("pendingApprovalId" in candidate);
  assert.ok("latestPrecheck" in candidate);
  assert.ok("reason" in candidate);
  assert.ok("suggestedAction" in candidate);
});

test("RecoverySuggestedAction type accepts all valid values", () => {
  const actions: RecoverySuggestedAction[] = [
    "resume_same_worker",
    "retry_new_ticket",
    "escalate_takeover",
    "move_dead_letter",
    "cancel",
    "none",
  ];
  assert.equal(actions.length, 6);
});

test("RuntimeRecoveryService handles precheck with allowed true", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestPrecheck: {
      allowed: 1,
      reasonCode: null,
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "standard",
      resolvedToolsJson: null,
      resolvedPathsJson: null,
      checkedAt: "",
    },
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.latestPrecheck?.allowed, true);
  assert.equal(results[0]!.reason, "active_execution");
});

test("RuntimeRecoveryService infers execution_error reason from error code", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestErrorCode: "E8-OutOfMemory",
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.ok(view.candidates[0]!.reason.startsWith("execution_error:"));
});

test("RuntimeRecoveryService maps latestErrorCode through reason", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestErrorCode: "E7-LockTimeout",
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.ok(view.candidates[0]!.latestErrorCode, "E7-LockTimeout");
});

test("TaskRuntimeRecoveryView includes recentRecoveryEvents", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1" });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    event: {
      listEventsForTask: () => ({
        events: [
          {
            id: "event-1",
            eventType: "recovery:started",
            payloadJson: '{"action":"resume_same_worker","targetId":"exec-1"}',
            createdAt: "2026-04-27T00:00:00.000Z",
            traceId: "trace-1",
          },
        ],
      }),
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.recentRecoveryEvents.length, 1);
  assert.equal(view.recentRecoveryEvents[0]!.eventType, "recovery:started");
});

test("TaskRuntimeRecoveryView filters non-recovery events", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1" });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    event: {
      listEventsForTask: () => ({
        events: [
          {
            id: "event-1",
            eventType: "platform.execution.started",
            payloadJson: "{}",
            createdAt: "2026-04-27T00:00:00.000Z",
            traceId: null,
          },
          {
            id: "event-2",
            eventType: "recovery:started",
            payloadJson: "{}",
            createdAt: "2026-04-27T00:01:00.000Z",
            traceId: null,
          },
        ],
      }),
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.recentRecoveryEvents.length, 1);
  assert.equal(view.recentRecoveryEvents[0]!.eventId, "event-2");
});

test("DivisionRecoveryOverview structure", () => {
  const records = [
    makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1", divisionId: "div-1" }),
  ];
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => records,
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");
  const div = overview[0]!;
  assert.ok("divisionId" in div);
  assert.ok("taskIds" in div);
  assert.ok("activeCandidateCount" in div);
  assert.ok("blockedApprovalCount" in div);
  assert.ok("staleExecutionCount" in div);
  assert.ok("newestCandidateAt" in div);
});

test("RuntimeRecoveryService newestCandidateAt tracks most recent candidate", () => {
  const olderRecord = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "div-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const newerRecord = makeRecoveryRecord({
    executionId: "exec-2",
    taskId: "task-2",
    divisionId: "div-1",
    updatedAt: "2026-04-28T00:00:00.000Z",
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [olderRecord, newerRecord],
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");
  assert.equal(overview[0]!.newestCandidateAt, "2026-04-28T00:00:00.000Z");
});

test("RuntimeRecoveryService findRecoveryCandidates returns legacy candidates", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    latestErrorCode: "E8-OutOfMemory",
  });
  const store = createMockStore({
    operations: {
      listRuntimeRecoveryRecords: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.findRecoveryCandidates();
  assert.equal(results.length, 1);
  assert.equal(results[0]!.errorClassification, "E8");
});

test("RuntimeRecoveryService findRecoveryCandidates classifies E7 errors", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestErrorCode: "E7-LockTimeout",
  });
  const store = createMockStore({
    operations: {
      listRuntimeRecoveryRecords: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.findRecoveryCandidates();
  assert.equal(results[0]!.errorClassification, "E7");
});

test("RuntimeRecoveryService findRecoveryCandidates classifies EC errors", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestErrorCode: "EC-RuntimeError",
  });
  const store = createMockStore({
    operations: {
      listRuntimeRecoveryRecords: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.findRecoveryCandidates();
  assert.equal(results[0]!.errorClassification, "EC");
});

test("RuntimeRecoveryService findRecoveryCandidates uses unknown for unclassified", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestErrorCode: null,
  });
  const store = createMockStore({
    operations: {
      listRuntimeRecoveryRecords: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.findRecoveryCandidates();
  assert.equal(results[0]!.errorClassification, "unknown");
});

test("RuntimeRecoveryService findStaleExecuting uses staleness threshold", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", status: "executing" });
  let receivedStaleBefore: string | undefined;
  const beforeCall = Date.now();
  const store = createMockStore({
    operations: {
      listStaleRuns: (staleBefore?: string) => {
        receivedStaleBefore = staleBefore;
        return [record];
      },
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.findStaleExecuting({ stalenessThresholdMs: 60000 });
  const afterCall = Date.now();
  assert.equal(results.length, 1);
  assert.ok(receivedStaleBefore);
  const parsed = Date.parse(receivedStaleBefore!);
  assert.ok(Number.isFinite(parsed));
  assert.ok(parsed >= beforeCall - 60_000);
  assert.ok(parsed <= afterCall - 60_000);
});

test("LegacyRecoveryCandidate extends RuntimeRecoveryCandidate with errorClassification", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    latestErrorCode: "E8",
  });
  const store = createMockStore({
    operations: {
      listRuntimeRecoveryRecords: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.findRecoveryCandidates();
  const legacy = results[0] as LegacyRecoveryCandidate;
  assert.ok("errorClassification" in legacy);
  assert.equal(legacy.errorClassification, "E8");
});

test("RuntimeRecoveryService handles missing latestCheckpoint gracefully", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1", taskId: "task-1" });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "pending" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    artifact: {
      listArtifactsByTask: () => [],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const view = service.buildRuntimeRecoveryView("task-1");
  assert.equal(view.latestCheckpoint, null);
});

test("RecoverySuggestedAction has correct string literal values", () => {
  const action1: RecoverySuggestedAction = "resume_same_worker";
  const action2: RecoverySuggestedAction = "retry_new_ticket";
  const action3: RecoverySuggestedAction = "escalate_takeover";
  const action4: RecoverySuggestedAction = "move_dead_letter";
  const action5: RecoverySuggestedAction = "cancel";
  const action6: RecoverySuggestedAction = "none";
  assert.equal(action1, "resume_same_worker");
  assert.equal(action2, "retry_new_ticket");
  assert.equal(action3, "escalate_takeover");
  assert.equal(action4, "move_dead_letter");
  assert.equal(action5, "cancel");
  assert.equal(action6, "none");
});

test("RuntimeRecoveryService latestPrecheck null when not set", () => {
  const record = makeRecoveryRecord({ executionId: "exec-1" });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.latestPrecheck, null);
});

test("RuntimeRecoveryService lastHeartbeatAt preserved from record", () => {
  const heartbeat = "2026-04-28T10:00:00.000Z";
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    lastHeartbeatAt: heartbeat,
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.lastHeartbeatAt, heartbeat);
});

test("RuntimeRecoveryService pendingApprovalId preserved from record", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    pendingApprovalId: "approval-xyz",
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);
  const results = service.listRecoverableExecutingRuns();
  assert.equal(results[0]!.pendingApprovalId, "approval-xyz");
});
