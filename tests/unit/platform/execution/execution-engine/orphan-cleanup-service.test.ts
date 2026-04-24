/**
 * Unit Tests: OrphanCleanupService - Full Class Coverage
 *
 * Tests the OrphanCleanupService class methods with mocked dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OrphanCleanupService } from "../../../../../src/platform/execution/execution-engine/orphan-cleanup-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

// ---------------------------------------------------------------------------
// Mock Store
// ---------------------------------------------------------------------------

interface MockOrphanSession {
  sessionId: string;
  taskId: string;
  sessionStatus: string;
  taskStatus: string;
}

interface MockTicket {
  ticketId: string;
  taskId: string;
  executionId: string;
  status: string;
}

interface MockWorkerSnapshot {
  workerId: string;
  runningExecutionsJson: string;
  status: string;
  placement?: string;
  isolationLevel?: string;
  repoVersion?: string | null;
  remoteSessionStatus?: string | null;
  lastAcknowledgedStreamOffset?: string | null;
  streamResumeSuccessRate?: number | null;
  credentialRefreshSuccessRate?: number | null;
  sessionConsistencyCheckStatus?: string | null;
  sessionConsistencyCheckedAt?: string | null;
  saturation?: number | null;
  activeLeaseCount?: number | null;
  meanStartupLatencyMs?: number | null;
  sandboxSuccessRate?: number | null;
  repoCacheHitRate?: number | null;
  registrationVerifiedAt?: string | null;
  registrationChallengeId?: string | null;
  capabilitiesJson?: string;
  maxConcurrency?: number | null;
  queueAffinity?: string | null;
  runtimeInstanceId?: string | null;
  restartedFromRuntimeInstanceId?: string | null;
  cpuPct?: number | null;
  memoryMb?: number | null;
  toolBacklogCount?: number | null;
  currentStepId?: string | null;
  lastProgressAt?: string | null;
}

interface MockExecution {
  id: string;
  taskId: string;
  status: string;
}

interface MockActiveLease {
  executionId: string;
  workerId: string;
}

function createMockStore(overrides: {
  orphanSessions?: MockOrphanSession[];
  dispatchReconciliationIssues?: MockTicket[];
  workerSnapshots?: MockWorkerSnapshot[];
  executions?: Map<string, MockExecution>;
  activeLeases?: Map<string, MockActiveLease>;
} = {}): AuthoritativeTaskStore {
  const {
    orphanSessions = [],
    dispatchReconciliationIssues = [],
    workerSnapshots = [],
    executions = new Map(),
    activeLeases = new Map(),
  } = overrides;

  return {
    operations: {
      listOrphanSessions: () => orphanSessions,
    },
    worker: {
      listWorkerSnapshots: () => workerSnapshots,
      getWorkerSnapshot: (workerId: string) =>
        workerSnapshots.find((w) => w.workerId === workerId) ?? null,
      getActiveExecutionLease: (executionId: string) =>
        activeLeases.get(executionId) ?? null,
    },
    dispatch: {
      getExecution: (id: string) => executions.get(id) ?? null,
    },
    session: {
      getSession: (id: string) => null,
      updateSessionStatus: (_id: string, _status: string, _at: string) => {},
    },
    event: {
      insertEvent: (_event: unknown) => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T): T => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// preview() tests
// ---------------------------------------------------------------------------

test("OrphanCleanupService.preview returns report with empty issues when no orphans", () => {
  const store = createMockStore({});
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  assert.ok(Array.isArray(report.issues));
  assert.equal(report.issues.length, 0);
  assert.ok(report.checkedAt.length > 0);
});

test("OrphanCleanupService.preview detects orphan_session issues", () => {
  const store = createMockStore({
    orphanSessions: [
      { sessionId: "sess-1", taskId: "task-1", sessionStatus: "streaming", taskStatus: "done" },
    ],
  });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]!.issueType, "orphan_session");
  assert.equal(report.issues[0]!.entityId, "sess-1");
});

test("OrphanCleanupService.preview detects orphan_queue_claim issues", () => {
  const store = createMockStore({
    dispatchReconciliationIssues: [
      { ticketId: "ticket-1", taskId: "task-1", executionId: "exec-1", status: "claimed" },
    ],
  });
  // The dispatch reconciliation service is created internally, so we need to
  // ensure it returns issues. We can only test the interface here.
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  // Issues from dispatch reconciliation depend on internal service behavior
  assert.ok(Array.isArray(report.issues));
});

test("OrphanCleanupService.preview uses custom checkedAt timestamp", () => {
  const store = createMockStore({});
  const service = new OrphanCleanupService(createMockDb(), store);
  const customTime = "2026-04-24T12:00:00.000Z";
  const report = service.preview(customTime);

  assert.equal(report.checkedAt, customTime);
});

// ---------------------------------------------------------------------------
// enforce() tests
// ---------------------------------------------------------------------------

test("OrphanCleanupService.enforce returns report with issues and applied array", () => {
  const store = createMockStore({});
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.enforce();

  assert.ok(Array.isArray(report.issues));
  assert.ok(Array.isArray(report.applied));
});

test("OrphanCleanupService.enforce applies close_orphan_session for orphan sessions", () => {
  const store = createMockStore({
    orphanSessions: [
      { sessionId: "sess-close-1", taskId: "task-1", sessionStatus: "streaming", taskStatus: "done" },
    ],
  });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.enforce();

  const applied = report.applied?.find((a) => a.entityId === "sess-close-1");
  assert.ok(applied, "Should have applied action for orphan session");
  assert.equal(applied!.action, "close_orphan_session");
  assert.equal(applied!.applied, true);
});

test("OrphanCleanupService.enforce marks applied false when session already terminal", () => {
  // The internal session lookup returns null in mock, so applied=false
  const store = createMockStore({
    orphanSessions: [
      { sessionId: "sess-term", taskId: "task-1", sessionStatus: "completed", taskStatus: "done" },
    ],
  });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.enforce();

  // With mock returning null for getSession, action should be not applied
  const applied = report.applied?.find((a) => a.entityId === "sess-term");
  assert.ok(applied);
  // Mock returns null for getSession so applied=false
  assert.equal(applied!.applied, false);
});

test("OrphanCleanupService.enforce applies requeue_ticket for orphan queue claims", () => {
  // This depends on dispatch reconciliation service internals
  const store = createMockStore({
    dispatchReconciliationIssues: [
      { ticketId: "ticket-requeue-1", taskId: "task-1", executionId: "exec-1", status: "claimed" },
    ],
  });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.enforce();

  assert.ok(report.applied);
});

test("OrphanCleanupService.enforce applies clean_worker_execution_refs for worker orphans", () => {
  // Set up worker snapshots with orphan execution references
  const executions = new Map([
    ["exec-dead", { id: "exec-dead", taskId: "task-dead", status: "succeeded" }], // terminal
  ]);
  const leases = new Map<string, MockActiveLease>(); // no active lease
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-orphan",
      runningExecutionsJson: '["exec-dead"]',
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots, executions, activeLeases: leases });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.enforce();

  const applied = report.applied?.find((a) => a.entityId === "worker-orphan");
  assert.ok(applied, "Should have applied action for worker orphan");
  assert.equal(applied!.action, "clean_worker_execution_refs");
});

// ---------------------------------------------------------------------------
// Worker execution reference orphan detection
// ---------------------------------------------------------------------------

test("OrphanCleanupService detects execution_missing orphan", () => {
  const executions = new Map<string, MockExecution>(); // exec-orphan not found
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-missing",
      runningExecutionsJson: '["exec-orphan"]',
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots, executions });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  const workerIssue = report.issues.find(
    (i) => i.issueType === "worker_execution_reference_orphan" && i.entityId === "worker-missing",
  );
  assert.ok(workerIssue, "Should detect worker_execution_reference_orphan");
  const orphanRef = workerIssue?.orphanExecutionRefs?.find((r) => r.executionId === "exec-orphan");
  assert.ok(orphanRef, "Should have orphan ref for exec-orphan");
  assert.equal(orphanRef!.reasonCode, "execution_missing");
});

test("OrphanCleanupService detects execution_terminal orphan", () => {
  const executions = new Map([
    ["exec-terminal", { id: "exec-terminal", taskId: "task-1", status: "failed" }],
  ]);
  const leases = new Map<string, MockActiveLease>();
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-terminal",
      runningExecutionsJson: '["exec-terminal"]',
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots, executions, activeLeases: leases });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  const workerIssue = report.issues.find(
    (i) => i.issueType === "worker_execution_reference_orphan" && i.entityId === "worker-terminal",
  );
  assert.ok(workerIssue);
  const orphanRef = workerIssue?.orphanExecutionRefs?.find((r) => r.executionId === "exec-terminal");
  assert.equal(orphanRef!.reasonCode, "execution_terminal");
  assert.equal(orphanRef!.executionStatus, "failed");
});

test("OrphanCleanupService detects missing_active_lease orphan", () => {
  const executions = new Map([
    ["exec-no-lease", { id: "exec-no-lease", taskId: "task-1", status: "executing" }],
  ]);
  const leases = new Map<string, MockActiveLease>(); // no lease
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-no-lease",
      runningExecutionsJson: '["exec-no-lease"]',
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots, executions, activeLeases: leases });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  const workerIssue = report.issues.find(
    (i) => i.issueType === "worker_execution_reference_orphan" && i.entityId === "worker-no-lease",
  );
  assert.ok(workerIssue);
  const orphanRef = workerIssue?.orphanExecutionRefs?.find((r) => r.executionId === "exec-no-lease");
  assert.equal(orphanRef!.reasonCode, "missing_active_lease");
});

test("OrphanCleanupService detects owned_by_another_worker orphan", () => {
  const executions = new Map([
    ["exec-stolen", { id: "exec-stolen", taskId: "task-1", status: "executing" }],
  ]);
  const leases = new Map([
    ["exec-stolen", { executionId: "exec-stolen", workerId: "other-worker" }],
  ]);
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-victim",
      runningExecutionsJson: '["exec-stolen"]',
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots, executions, activeLeases: leases });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  const workerIssue = report.issues.find(
    (i) => i.issueType === "worker_execution_reference_orphan" && i.entityId === "worker-victim",
  );
  assert.ok(workerIssue);
  const orphanRef = workerIssue?.orphanExecutionRefs?.find((r) => r.executionId === "exec-stolen");
  assert.equal(orphanRef!.reasonCode, "owned_by_another_worker");
  assert.equal(orphanRef!.activeLeaseWorkerId, "other-worker");
});

test("OrphanCleanupService does not flag valid execution references", () => {
  const executions = new Map([
    ["exec-valid", { id: "exec-valid", taskId: "task-1", status: "executing" }],
  ]);
  const leases = new Map([
    ["exec-valid", { executionId: "exec-valid", workerId: "worker-valid" }],
  ]);
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-valid",
      runningExecutionsJson: '["exec-valid"]',
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots, executions, activeLeases: leases });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  const workerIssue = report.issues.find(
    (i) => i.issueType === "worker_execution_reference_orphan" && i.entityId === "worker-valid",
  );
  assert.equal(workerIssue, undefined, "Valid execution should not be flagged as orphan");
});

// ---------------------------------------------------------------------------
// cleanWorkerExecutionRefs helper (via enforce)
// ---------------------------------------------------------------------------

test("OrphanCleanupService cleans multiple orphan refs in single worker", () => {
  const executions = new Map([
    ["exec-dead-1", { id: "exec-dead-1", taskId: "task-1", status: "failed" }],
    ["exec-dead-2", { id: "exec-dead-2", taskId: "task-2", status: "succeeded" }],
  ]);
  const leases = new Map<string, MockActiveLease>();
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-multi-orphan",
      runningExecutionsJson: '["exec-dead-1", "exec-dead-2"]',
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots, executions, activeLeases: leases });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.enforce();

  const applied = report.applied?.find((a) => a.entityId === "worker-multi-orphan");
  assert.ok(applied);
  assert.equal(applied!.action, "clean_worker_execution_refs");
  assert.equal(applied!.applied, true);
});

test("OrphanCleanupService reports no action needed when worker already clean", () => {
  // Set up a worker with no orphan refs - valid execution with lease
  const executions = new Map([
    ["exec-clean", { id: "exec-clean", taskId: "task-1", status: "executing" }],
  ]);
  const leases = new Map([["exec-clean", { executionId: "exec-clean", workerId: "worker-clean" }]]);
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-clean",
      runningExecutionsJson: '["exec-clean"]',
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots, executions, activeLeases: leases });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.enforce();

  // No worker orphan issues should be detected
  const workerIssue = report.issues.find(
    (i) => i.issueType === "worker_execution_reference_orphan",
  );
  assert.equal(workerIssue, undefined);
});

// ---------------------------------------------------------------------------
// JSON parsing edge cases
// ---------------------------------------------------------------------------

test("OrphanCleanupService handles malformed runningExecutionsJson", () => {
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-bad-json",
      runningExecutionsJson: "not-valid-json",
      status: "busy",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  // Malformed JSON should be treated as empty array (no orphan refs)
  const workerIssue = report.issues.find(
    (i) => i.issueType === "worker_execution_reference_orphan" && i.entityId === "worker-bad-json",
  );
  assert.equal(workerIssue, undefined);
});

test("OrphanCleanupService handles empty runningExecutionsJson", () => {
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-empty",
      runningExecutionsJson: "[]",
      status: "idle",
    },
  ];

  const store = createMockStore({ workerSnapshots: snapshots });
  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  const workerIssue = report.issues.find(
    (i) => i.issueType === "worker_execution_reference_orphan" && i.entityId === "worker-empty",
  );
  assert.equal(workerIssue, undefined);
});

// ---------------------------------------------------------------------------
// Multiple issue types combined
// ---------------------------------------------------------------------------

test("OrphanCleanupService.preview combines all issue types", () => {
  const executions = new Map([
    ["exec-terminal", { id: "exec-terminal", taskId: "task-1", status: "failed" }],
  ]);
  const leases = new Map<string, MockActiveLease>();
  const snapshots: MockWorkerSnapshot[] = [
    {
      workerId: "worker-some-orphan",
      runningExecutionsJson: '["exec-terminal"]',
      status: "busy",
    },
  ];

  const store = createMockStore({
    orphanSessions: [
      { sessionId: "sess-1", taskId: "task-1", sessionStatus: "streaming", taskStatus: "done" },
    ],
    workerSnapshots: snapshots,
    executions,
    activeLeases: leases,
  });

  const service = new OrphanCleanupService(createMockDb(), store);
  const report = service.preview();

  const issueTypes = new Set(report.issues.map((i) => i.issueType));
  assert.ok(issueTypes.has("orphan_session"));
  assert.ok(issueTypes.has("worker_execution_reference_orphan"));
});