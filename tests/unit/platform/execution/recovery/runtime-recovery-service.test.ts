import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRecoveryService,
  type RuntimeRecoveryCandidate,
  type RecoverySuggestedAction,
} from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
import type { RuntimeRecoveryRecord } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// Helper to create mock store
function createMockStore(overrides: {
  tasks?: Array<{ id: string; divisionId?: string | null; status: string }>;
  operations?: {
    listRecoverableExecutingRuns?: () => RuntimeRecoveryRecord[];
    listStaleRuns?: () => RuntimeRecoveryRecord[];
    buildRuntimeRecoveryView?: () => RuntimeRecoveryRecord[];
  };
  event?: { listEventsForTask?: () => Array<{ id: string; eventType: string; payloadJson: string; createdAt: string; traceId?: string | null }> };
  artifact?: { listArtifactsByTask?: () => Array<{ artifactId: string; artifactType: string; createdAt: string }> };
  approval?: { listApprovalsByTask?: () => Array<{ id: string; status: string }> };
  dispatch?: {
    listDeadLettersByTask?: () => Array<{ id: string }>;
    getExecution?: (executionId: string, tenantId?: string | null) => { id: string; taskId: string } | null;
  };
  task?: { getTask?: (id: string) => { id: string; divisionId?: string | null; status: string } | null };
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
    },
    listBlockedRunsAwaitingApproval: () => overrides.operations?.listBlockedRunsAwaitingApproval?.() ?? [],
    event: {
      listEventsForTask: overrides.event?.listEventsForTask ?? (() => []),
    },
    artifact: {
      listArtifactsByTask: overrides.artifact?.listArtifactsByTask ?? (() => []),
    },
    approval: {
      listApprovalsByTask: overrides.approval?.listApprovalsByTask ?? (() => []),
    },
    dispatch: {
      listDeadLettersByTask: overrides.dispatch?.listDeadLettersByTask ?? (() => []),
      getExecution: overrides.dispatch?.getExecution ?? (() => null),
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

test("RuntimeRecoveryService.listStaleRuns returns candidates", () => {
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
  // Stale executions should have stale_execution reason
  assert.equal(results[0]!.reason, "stale_execution");
  assert.equal(results[0]!.suggestedAction, "retry_new_ticket");
});

test("RuntimeRecoveryService.findStaleExecuting computes staleBefore in the past", () => {
  let capturedStaleBefore: string | null = null;
  const now = Date.now();
  const store = createMockStore({
    operations: {
      listStaleRuns: (staleBefore?: string) => {
        capturedStaleBefore = staleBefore ?? null;
        return [];
      },
    },
  });
  const service = new RuntimeRecoveryService(store);

  service.findStaleExecuting({ stalenessThresholdMs: 60_000 });

  assert.ok(capturedStaleBefore !== null);
  const staleBeforeMs = new Date(capturedStaleBefore!).getTime();
  assert.ok(staleBeforeMs <= now - 55_000, `expected staleBefore in the past, got ${capturedStaleBefore}`);
  assert.ok(staleBeforeMs >= now - 65_000, `expected staleBefore close to threshold, got ${capturedStaleBefore}`);
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
    tasks: [], // No tasks
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
        { id: "approval-2", status: "approved" }, // Should be filtered
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
      listStaleRuns: () => activeRecords, // exec-1 is also stale
      listBlockedRunsAwaitingApproval: () => activeRecords, // exec-1 is also blocked
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

test("RuntimeRecoveryService listRecoverableExecutingRuns uses active_execution reason", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestErrorCode: "E1",
    pendingApprovalId: null,
    attempt: 1,
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listRecoverableExecutingRuns();

  // Note: listRecoverableExecutingRuns always uses "active_execution" as reason
  // The actual reason inference happens in buildRuntimeRecoveryView
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
    makeRecoveryRecord({ executionId: "exec-2", taskId: "task-1", divisionId: "div-1" }), // Same task
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
  // task-1 should only appear once despite having 2 executions
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
    latestPrecheck: { allowed: 1, reasonCode: null, resolvedBudgetUsd: 100, resolvedTimeoutMs: 60000, resolvedSandboxMode: "standard", resolvedToolsJson: null, resolvedPathsJson: null, checkedAt: "" },
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listRecoverableExecutingRuns();

  assert.equal(results[0]!.latestPrecheck?.allowed, true);
  // No error code, so reason should be active_execution
  assert.equal(results[0]!.reason, "active_execution");
});

test("RuntimeRecoveryService.buildCompensationPlan resolves task via execution lookup", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-from-execution",
    status: "failed",
    latestErrorCode: "runtime.failed",
    latestPrecheck: {
      allowed: 1,
      reasonCode: null,
      resolvedBudgetUsd: 42,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "standard",
      resolvedToolsJson: null,
      resolvedPathsJson: null,
      checkedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  const store = createMockStore({
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    dispatch: {
      getExecution: (executionId: string) => executionId === "exec-1" ? { id: "exec-1", taskId: "task-from-execution" } : null,
    },
  });
  const service = new RuntimeRecoveryService(store);

  const plan = service.buildCompensationPlan("exec-1");

  assert.ok(plan);
  assert.equal(plan?.executionId, "exec-1");
  assert.equal(plan?.actions.length, 3);
  assert.equal(plan?.actions[0]?.actionType, "release_budget_reservation");
});
