import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionWorkerWritebackService } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.js";
import { ExecutionResourceCeilingGuard } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionAuthoritativeView } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/authoritative-task-store-types.js";
import type { TaskRecord, ExecutionRecord, WorkflowStateRecord, SessionRecord, WorkerSnapshotRecord, ExecutionLeaseRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockStore(): AuthoritativeTaskStore {
  return {
    operations: {
      loadExecutionAuthoritativeView: () => null,
      listActiveExecutionActivity: () => [],
    },
    task: {
      countQueuedTasks: () => 0,
      getTask: () => null,
    },
    execution: {
      countActiveExecutions: () => 0,
      getExecution: () => null,
      updateExecutionStatus: () => {},
      updateExecutionAgent: () => {},
    },
    event: {
      countPendingTier1Acks: () => 0,
      insertEvent: () => {},
    },
    worker: {
      getActiveExecutionTicket: () => null,
      insertExecutionTicket: () => {},
      listDispatchableExecutionTickets: () => [],
      claimExecutionTicket: () => {},
      getExecutionTicket: () => null,
      consumeExecutionTicket: () => {},
      getAgentExecutionRecord: () => null,
      upsertAgentExecutionRecord: () => {},
      getActiveExecutionLease: () => undefined,
      getLatestExecutionLease: () => undefined,
      listExecutionTicketsByStatuses: () => [],
      listWorkers: () => [],
      getWorker: () => null,
      listExecutionTicketsByExecution: () => [],
      listWorkerSnapshots: () => [],
      upsertWorkerSnapshot: () => {},
      getWorkerSnapshot: () => null,
      insertHeartbeatSnapshot: () => {},
      getExecutionLease: () => undefined,
      closeExecutionLease: () => {},
      insertLeaseAudit: () => {},
      listStaleWorkerSnapshots: () => [],
    },
    dispatch: {
      getExecution: () => null,
    },
    workflow: {
      getWorkflowState: () => null,
      updateWorkflowRecoveryState: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

function makeExecution(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    parentExecutionId: null,
    agentId: "",
    roleId: null,
    runKind: "task_run" as const,
    status: "executing",
    inputRef: null,
    traceId: "trace-001",
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: "2024-01-01T00:00:00.000Z",
    finishedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-001",
    parentId: null,
    rootId: "task-001",
    divisionId: "general-ops",
    tenantId: null,
    title: "Test task",
    status: "queued",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function makeWorkflow(overrides: Partial<WorkflowStateRecord> = {}): WorkflowStateRecord {
  return {
    workflowId: "wf-001",
    taskId: "task-001",
    divisionId: "general-ops",
    currentStepIndex: 0,
    status: "running",
    outputsJson: "{}",
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: null,
    startedAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-001",
    taskId: "task-001",
    channel: "test",
    status: "open",
    externalSessionId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeWorkerSnapshot(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  return {
    workerId: "worker-001",
    status: "idle",
    placement: "local",
    capabilitiesJson: "[]",
    runningExecutionsJson: "[]",
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeExecutionView(overrides: Partial<ExecutionAuthoritativeView> = {}): ExecutionAuthoritativeView {
  return {
    execution: makeExecution(),
    task: makeTask(),
    workflow: makeWorkflow(),
    session: makeSession(),
    consistency: "authoritative",
    observedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLease(overrides: Partial<ExecutionLeaseRecord> = {}): ExecutionLeaseRecord {
  return {
    id: "lease-001",
    executionId: "exec-001",
    workerId: "worker-001",
    attempt: 1,
    status: "active",
    fencingToken: 1,
    queueName: "default",
    leasedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    lastHeartbeatAt: "2024-01-01T00:00:00.000Z",
    releasedAt: null,
    reasonCode: null,
    ...overrides,
  };
}

function setActiveLease(store: AuthoritativeTaskStore, lease: ExecutionLeaseRecord | undefined): void {
  store.worker.getExecutionLease = () => lease;
  store.worker.getLatestExecutionLease = () => lease;
  store.worker.getActiveExecutionLease = () => lease;
}

// ---------------------------------------------------------------------------
// recordWriteback - execution not found
// ---------------------------------------------------------------------------

test("recordWriteback returns execution_not_found when execution view is null [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => null;
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "nonexistent",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "execution_not_found");
});

// ---------------------------------------------------------------------------
// recordWriteback - task not found
// ---------------------------------------------------------------------------

test("recordWriteback returns task_not_found when task is null in view [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  const events: Array<{ traceId: string | null; payloadJson: string }> = [];
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView({ task: null });
  store.event.insertEvent = (event: { traceId: string | null; payloadJson: string }) => {
    events.push(event);
  };
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "task_not_found");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.traceId, "trace-001");
  assert.equal(JSON.parse(events[0]!.payloadJson).orphanedTaskContext, true);
});

// ---------------------------------------------------------------------------
// recordWriteback - workflow not found
// ---------------------------------------------------------------------------

test("recordWriteback returns workflow_not_found when workflow is null in view [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView({ workflow: null });
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "workflow_not_found");
});

// ---------------------------------------------------------------------------
// recordWriteback - session not found
// ---------------------------------------------------------------------------

test("recordWriteback returns session_not_found when session is null in view [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView({ session: null });
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "session_not_found");
});

// ---------------------------------------------------------------------------
// recordWriteback - execution not executing
// ---------------------------------------------------------------------------

test("recordWriteback returns execution_not_executing when execution status is not executing [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView({ execution: makeExecution({ status: "succeeded" }) });
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "execution_not_executing");
});

// ---------------------------------------------------------------------------
// recordWriteback - lease not found
// ---------------------------------------------------------------------------

test("recordWriteback returns lease_not_found when lease does not exist [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView();
  setActiveLease(store, undefined);
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "nonexistent",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "lease_not_found");
});

// ---------------------------------------------------------------------------
// recordWriteback - worker_not_trusted for remote worker
// ---------------------------------------------------------------------------

test("recordWriteback returns worker_not_trusted for remote worker without registrationVerifiedAt [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView();
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot({ placement: "remote", registrationVerifiedAt: null });
  setActiveLease(store, makeLease());
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "worker_not_trusted");
});

// ---------------------------------------------------------------------------
// recordWriteback - remote_authority_block_reason
// ---------------------------------------------------------------------------

test("recordWriteback returns remote_authority_block_reason for remote worker with viewer_only session [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView();
  store.worker.getWorkerSnapshot = () =>
    makeWorkerSnapshot({
      placement: "remote",
      registrationVerifiedAt: "2024-01-01T00:00:00.000Z",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "offset-123",
    });
  setActiveLease(store, makeLease());
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "remote_session_viewer_only");
});

test("recordWriteback returns remote_authority_block_reason for remote worker with consistency mismatch [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView();
  store.worker.getWorkerSnapshot = () =>
    makeWorkerSnapshot({
      placement: "remote",
      registrationVerifiedAt: "2024-01-01T00:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "offset-123",
      sessionConsistencyCheckStatus: "mismatch",
    });
  setActiveLease(store, makeLease());
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "remote_session_consistency_mismatch");
});

test("recordWriteback returns remote_authority_block_reason for remote worker with workspace conflict [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView();
  store.worker.getWorkerSnapshot = () =>
    makeWorkerSnapshot({
      placement: "remote",
      registrationVerifiedAt: "2024-01-01T00:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "offset-123",
      workspaceSyncStatus: "conflict",
    });
  setActiveLease(store, makeLease());
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "remote_workspace_sync_conflict");
});

// ---------------------------------------------------------------------------
// recordWriteback - resource_limit_exceeded
// ---------------------------------------------------------------------------

test("recordWriteback returns resource_limit_exceeded when resource ceiling guard fails [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView();
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  setActiveLease(store, makeLease());
  store.worker.getAgentExecutionRecord = () => undefined;
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store, {
    resourceCeilingGuard: new ExecutionResourceCeilingGuard({ maxMemoryMb: 1 }),
  });

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
    runtimeInstanceId: "runtime-bad",
    memoryMb: 99999,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "resource_limit_exceeded");
});

test("recordWriteback preserves null task output when neither input nor task row provides one [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView({
    task: makeTask({ outputJson: null, status: "in_progress" }),
    workflow: makeWorkflow({ status: "running" }),
    session: makeSession({ status: "open" }),
    execution: makeExecution({ status: "executing" }),
  });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  store.worker.getAgentExecutionRecord = () => undefined;
  setActiveLease(store, makeLease());
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);
  let terminalInput: unknown;
  (service as unknown as {
    transitions: {
      applyTaskTerminalState(input: unknown): void;
    };
  }).transitions = {
    applyTaskTerminalState(input: unknown) {
      terminalInput = input;
    },
  };

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, true);
  assert.equal((terminalInput as { taskOutputJson?: string | null }).taskOutputJson, null);
});

test("recordWriteback uses injected lease dependency when provided [execution-worker-writeback-service]", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => makeExecutionView();
  const db = createMockDb();
  let validateCalls = 0;
  const service = new ExecutionWorkerWritebackService(db, store, {
    leases: {
      validateWriteAccess() {
        validateCalls += 1;
        return {
          allowed: false,
          reasonCode: "stale_fencing_token",
          authoritativeFencingToken: 99,
          activeLeaseId: "lease-001",
        };
      },
    } as any,
  });

  const result = service.recordWriteback({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    terminalStatus: "done",
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "stale_fencing_token");
  assert.equal(validateCalls, 1);
});
