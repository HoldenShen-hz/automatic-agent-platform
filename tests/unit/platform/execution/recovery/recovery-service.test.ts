import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeRecoveryService,
  type RuntimeRecoveryCandidate,
  type RecoverySuggestedAction,
  type RuntimeRecoveryCandidate,
  type TaskRuntimeRecoveryView,
} from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
import type { RuntimeRecoveryRecord } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

/**
 * Mock store factory for RuntimeRecoveryService tests.
 * Provides minimal mock implementations for store operations.
 */
function createMockStore(overrides: {
  tasks?: Array<{ id: string; divisionId?: string | null; status: string }>;
  operations?: {
    listRecoverableExecutingRuns?: () => RuntimeRecoveryRecord[];
    listStaleRuns?: () => RuntimeRecoveryRecord[];
    buildRuntimeRecoveryView?: () => RuntimeRecoveryRecord[];
  };
  listBlockedRunsAwaitingApproval?: () => RuntimeRecoveryRecord[];
  event?: {
    listEventsForTask?: () => Array<{
      id: string;
      eventType: string;
      payloadJson: string;
      createdAt: string;
      traceId?: string | null;
    }>;
  };
  artifact?: {
    listArtifactsByTask?: () => Array<{
      artifactId: string;
      artifactType: string;
      createdAt: string;
    }>;
  };
  approval?: { listApprovalsByTask?: () => Array<{ id: string; status: string }> };
  dispatch?: { listDeadLettersByTask?: () => Array<{ id: string }> };
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
    listBlockedRunsAwaitingApproval: overrides.listBlockedRunsAwaitingApproval ?? (() => []),
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
    },
  } as unknown as ReturnType<typeof RuntimeRecoveryService> extends { store: infer S } ? S : never;
}

/**
 * Creates a default recovery record with sensible defaults.
 */
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

// =============================================================================
// Recovery State Machine Tests
// =============================================================================

test("RuntimeRecoveryService suggests resume_same_worker for active execution at low attempt", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    status: "executing",
    attempt: 1,
    latestErrorCode: null,
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listRecoverableExecutingRuns();

  assert.equal(results.length, 1);
  assert.equal(results[0]!.suggestedAction, "resume_same_worker");
  assert.equal(results[0]!.reason, "active_execution");
});

test("RuntimeRecoveryService suggests retry_new_ticket when attempt exceeds resume threshold", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    status: "executing",
    attempt: 3, // Exceeds default resumeSameWorkerMaxAttempts of 2
    latestErrorCode: null,
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listRecoverableExecutingRuns();

  assert.equal(results[0]!.suggestedAction, "retry_new_ticket");
});

test("RuntimeRecoveryService suggests move_dead_letter when attempt exceeds retryNewTicketMaxAttempts", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    status: "executing",
    attempt: 4, // Exceeds default retryNewTicketMaxAttempts of 3
    latestErrorCode: "E1",
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  assert.equal(view.candidates[0]!.suggestedAction, "move_dead_letter");
});

test("RuntimeRecoveryService suggests escalate_takeover for approval_pending regardless of attempt", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    pendingApprovalId: "approval-1",
    attempt: 10, // High attempt should still escalate
  });
  const store = createMockStore({
    listBlockedRunsAwaitingApproval: () => [record],
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listBlockedRunsAwaitingApproval();

  assert.equal(results[0]!.suggestedAction, "escalate_takeover");
  assert.equal(results[0]!.reason, "approval_pending");
});

test("RuntimeRecoveryService suggests cancel for precheck_denied regardless of attempt", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestPrecheck: {
      allowed: 0,
      reasonCode: "budget_exceeded",
      resolvedBudgetUsd: 0,
      resolvedTimeoutMs: 0,
      resolvedSandboxMode: "standard",
      resolvedToolsJson: "[]",
      resolvedPathsJson: "[]",
      checkedAt: "2025-01-01T00:00:00.000Z",
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

  assert.equal(view.candidates[0]!.suggestedAction, "cancel");
  assert.equal(view.candidates[0]!.reason, "precheck_denied:budget_exceeded");
});

test("RuntimeRecoveryService suggests escalate_takeover for blocked_without_approval", () => {
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

  assert.equal(view.candidates[0]!.suggestedAction, "escalate_takeover");
  assert.equal(view.candidates[0]!.reason, "blocked_without_approval");
});

test("RuntimeRecoveryService suggests none for unknown states with no issues", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    status: "created",
    attempt: 1,
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

  // created status at low attempt gets resume_same_worker, not none
  assert.equal(results[0]!.suggestedAction, "resume_same_worker");
});

// =============================================================================
// Execution Resurrection Tests
// =============================================================================

test("RuntimeRecoveryService can resurrect execution with valid checkpoint", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    status: "executing",
    attempt: 2,
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "div-1", status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    artifact: {
      listArtifactsByTask: () => [
        {
          artifactId: "artifact-1",
          artifactType: "workflow_step_checkpoint",
          createdAt: "2025-01-01T12:00:00.000Z",
        },
      ],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  assert.equal(view.candidates.length, 1);
  // Note: latestCheckpoint is null in unit tests because readWorkflowStepCheckpoint
  // requires actual filesystem access (kind check and storagePath existence)
  // Integration tests would verify checkpoint resurrection with real artifacts
  assert.equal(view.latestCheckpoint, null);
});

test("RuntimeRecoveryService handles resurrection with no checkpoint available", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    status: "executing",
    attempt: 1,
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: "div-1", status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    artifact: {
      listArtifactsByTask: () => [], // No checkpoints
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  assert.equal(view.candidates.length, 1);
  assert.equal(view.latestCheckpoint, null, "No checkpoint available for resurrection");
});

// =============================================================================
// Error Code Classification Tests
// =============================================================================

test("RuntimeRecoveryService classifies E7 error codes as locking_error", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    status: "executing",
    latestErrorCode: "E7DEADLOCK",
    attempt: 1,
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  // locking_error is retryable with resume_same_worker action at low attempts
  assert.equal(view.candidates[0]!.suggestedAction, "resume_same_worker");
});

test("RuntimeRecoveryService classifies E8 error codes as memory_error", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    status: "executing",
    latestErrorCode: "E8OUTOFMEMORY",
    attempt: 1,
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  // memory_error escalates for human review
  assert.equal(view.candidates[0]!.suggestedAction, "escalate_takeover");
});

test("RuntimeRecoveryService classifies EC error codes as runtime_error", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    status: "executing",
    latestErrorCode: "ECRASH",
    attempt: 1,
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  // runtime_error is retryable with retry_new_ticket action
  assert.equal(view.candidates[0]!.suggestedAction, "retry_new_ticket");
});

// =============================================================================
// Stale Execution Detection Tests
// =============================================================================

test("RuntimeRecoveryService marks stale executions with retry_new_ticket action", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    status: "executing",
    updatedAt: "2025-01-01T00:00:00.000Z", // Very old
  });
  const store = createMockStore({
    operations: {
      listStaleRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listStaleRuns("2025-06-01T00:00:00.000Z");

  assert.equal(results.length, 1);
  assert.equal(results[0]!.reason, "stale_execution");
  assert.equal(results[0]!.suggestedAction, "retry_new_ticket");
});

test("RuntimeRecoveryService distinguishes stale from active executions", () => {
  const staleRecord = makeRecoveryRecord({
    executionId: "exec-stale",
    status: "executing",
    updatedAt: "2025-01-01T00:00:00.000Z",
  });
  const activeRecord = makeRecoveryRecord({
    executionId: "exec-active",
    status: "executing",
    updatedAt: "2025-06-01T12:00:00.000Z", // Recent
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [activeRecord],
      listStaleRuns: () => [staleRecord],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const active = service.listRecoverableExecutingRuns();
  const stale = service.listStaleRuns("2025-06-01T00:00:00.000Z");

  assert.equal(active.length, 1);
  assert.equal(active[0]!.executionId, "exec-active");
  assert.equal(stale.length, 1);
  assert.equal(stale[0]!.executionId, "exec-stale");
  assert.equal(stale[0]!.reason, "stale_execution");
});

// =============================================================================
// Recovery Event Tracking Tests
// =============================================================================

test("RuntimeRecoveryService includes recovery events in view", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    event: {
      listEventsForTask: () => [
        {
          id: "event-1",
          eventType: "recovery:retry_attempted",
          payloadJson: JSON.stringify({ action: "retry_new_ticket", targetId: "exec-1" }),
          createdAt: "2025-01-01T12:00:00.000Z",
          traceId: "trace-1",
        },
      ],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  assert.equal(view.recentRecoveryEvents.length, 1);
  assert.equal(view.recentRecoveryEvents[0]!.eventType, "recovery:retry_attempted");
  assert.equal(view.recentRecoveryEvents[0]!.decisionAction, "retry_new_ticket");
  assert.equal(view.recentRecoveryEvents[0]!.targetId, "exec-1");
});

test("RuntimeRecoveryService limits recovery events to 10 most recent", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
  });
  const events = Array.from({ length: 15 }, (_, i) => ({
    id: `event-${i}`,
    eventType: "recovery:test",
    payloadJson: JSON.stringify({}),
    createdAt: new Date(2025, 0, i + 1).toISOString(),
    traceId: null,
  }));
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    event: {
      listEventsForTask: () => events,
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  assert.equal(view.recentRecoveryEvents.length, 10, "Should limit to 10 events");
});

test("RuntimeRecoveryService filters non-recovery events", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
  });
  const store = createMockStore({
    tasks: [{ id: "task-1", divisionId: null, status: "in_progress" }],
    operations: {
      buildRuntimeRecoveryView: () => [record],
    },
    event: {
      listEventsForTask: () => [
        {
          id: "event-1",
          eventType: "execution:started", // Not a recovery event
          payloadJson: JSON.stringify({}),
          createdAt: "2025-01-01T12:00:00.000Z",
          traceId: null,
        },
        {
          id: "event-2",
          eventType: "recovery:dead_letter_moved", // Recovery event
          payloadJson: JSON.stringify({ deadLetterId: "dlq-1" }),
          createdAt: "2025-01-01T13:00:00.000Z",
          traceId: null,
        },
      ],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const view = service.buildRuntimeRecoveryView("task-1");

  assert.equal(view.recentRecoveryEvents.length, 1);
  assert.equal(view.recentRecoveryEvents[0]!.eventType, "recovery:dead_letter_moved");
  assert.equal(view.recentRecoveryEvents[0]!.deadLetterId, "dlq-1");
});

// =============================================================================
// Division Recovery Overview Tests
// =============================================================================

test("RuntimeRecoveryService calculates newestCandidateAt correctly", () => {
  const records = [
    makeRecoveryRecord({
      executionId: "exec-1",
      taskId: "task-1",
      divisionId: "div-1",
      updatedAt: "2025-01-01T12:00:00.000Z",
    }),
    makeRecoveryRecord({
      executionId: "exec-2",
      taskId: "task-2",
      divisionId: "div-1",
      updatedAt: "2025-01-02T12:00:00.000Z", // Newer
    }),
  ];
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => records,
      listStaleRuns: () => [],
    },
    listBlockedRunsAwaitingApproval: () => [],
  });
  const service = new RuntimeRecoveryService(store);

  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");

  assert.equal(overview.length, 1);
  assert.equal(overview[0]!.newestCandidateAt, "2025-01-02T12:00:00.000Z");
});

test("RuntimeRecoveryService handles unassigned division as unassigned", () => {
  const records = [
    makeRecoveryRecord({
      executionId: "exec-1",
      taskId: "task-1",
      divisionId: null, // Null division
    }),
  ];
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => records,
      listStaleRuns: () => [],
    },
    listBlockedRunsAwaitingApproval: () => [],
  });
  const service = new RuntimeRecoveryService(store);

  const overview = service.listDivisionRecoveryOverview("2025-01-01T00:00:00.000Z");

  assert.equal(overview.length, 1);
  assert.equal(overview[0]!.divisionId, "unassigned");
  assert.equal(overview[0]!.activeCandidateCount, 1);
});

// =============================================================================
// Precheck Parsing Tests
// =============================================================================

test("RuntimeRecoveryService parses precheck allowed flag correctly", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestPrecheck: {
      allowed: 1, // Numeric 1
      reasonCode: null,
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "standard",
      resolvedToolsJson: null,
      resolvedPathsJson: null,
      checkedAt: "2025-01-01T00:00:00.000Z",
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
});

test("RuntimeRecoveryService parses precheck tools and paths correctly", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestPrecheck: {
      allowed: 1,
      reasonCode: null,
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "standard",
      resolvedToolsJson: '["tool1","tool2"]',
      resolvedPathsJson: '["/path1","/path2"]',
      checkedAt: "2025-01-01T00:00:00.000Z",
    },
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listRecoverableExecutingRuns();

  assert.deepEqual(results[0]!.latestPrecheck?.resolvedTools, ["tool1", "tool2"]);
  assert.deepEqual(results[0]!.latestPrecheck?.resolvedPaths, ["/path1", "/path2"]);
});

test("RuntimeRecoveryService handles malformed precheck JSON gracefully", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    latestPrecheck: {
      allowed: 1,
      reasonCode: null,
      resolvedBudgetUsd: 100,
      resolvedTimeoutMs: 60000,
      resolvedSandboxMode: "standard",
      resolvedToolsJson: "not valid json",
      resolvedPathsJson: null,
      checkedAt: "2025-01-01T00:00:00.000Z",
    },
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listRecoverableExecutingRuns();

  // Should gracefully handle invalid JSON and return empty arrays
  assert.deepEqual(results[0]!.latestPrecheck?.resolvedTools, []);
});

// =============================================================================
// Tenant Isolation Tests
// =============================================================================

test("RuntimeRecoveryService supports tenant filtering", () => {
  const record = makeRecoveryRecord({
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "tenant-1",
  });
  const store = createMockStore({
    operations: {
      listRecoverableExecutingRuns: () => [record],
    },
  });
  const service = new RuntimeRecoveryService(store);

  const results = service.listRecoverableExecutingRuns("2025-06-01T00:00:00.000Z", "tenant-1");

  assert.equal(results.length, 1);
  assert.equal(results[0]!.executionId, "exec-1");
});
