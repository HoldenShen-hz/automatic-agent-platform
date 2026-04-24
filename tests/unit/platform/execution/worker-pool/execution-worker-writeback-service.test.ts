import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionWorkerWritebackService } from "../../../../../src/platform/execution/worker-pool/execution-worker-writeback-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { TaskRecord, ExecutionRecord, WorkflowStateRecord, SessionRecord, WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

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
      getActiveExecutionLease: () => null,
      listExecutionTicketsByStatuses: () => [],
      listWorkers: () => [],
      getWorker: () => null,
      listExecutionTicketsByExecution: () => [],
      listWorkerSnapshots: () => [],
      upsertWorkerSnapshot: () => {},
      getWorkerSnapshot: () => null,
      insertHeartbeatSnapshot: () => {},
      getExecutionLease: () => null,
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
    agentId: null,
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
    divisionId: "general_ops",
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
    id: "wf-001",
    taskId: "task-001",
    status: "running",
    inputJson: "{}",
    outputsJson: null,
    stepsJson: "[]",
    stepStatesJson: "{}",
    planJson: null,
    errorPolicyJson: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-001",
    taskId: "task-001",
    status: "active",
    inputJson: "{}",
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

// ---------------------------------------------------------------------------
// recordWriteback - execution not found
// ---------------------------------------------------------------------------

test("recordWriteback returns execution_not_found when execution view is null", () => {
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

test("recordWriteback returns task_not_found when task is null in view", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution(),
    task: null,
    workflow: makeWorkflow(),
    session: makeSession(),
  });
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
});

// ---------------------------------------------------------------------------
// recordWriteback - workflow not found
// ---------------------------------------------------------------------------

test("recordWriteback returns workflow_not_found when workflow is null in view", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution(),
    task: makeTask(),
    workflow: null,
    session: makeSession(),
  });
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

test("recordWriteback returns session_not_found when session is null in view", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution(),
    task: makeTask(),
    workflow: makeWorkflow(),
    session: null,
  });
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

test("recordWriteback returns execution_not_executing when execution status is not executing", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution({ status: "succeeded" }),
    task: makeTask(),
    workflow: makeWorkflow(),
    session: makeSession(),
  });
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

test("recordWriteback returns lease_not_found when lease does not exist", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution(),
    task: makeTask(),
    workflow: makeWorkflow(),
    session: makeSession(),
  });
  store.worker.getExecutionLease = () => null;
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

test("recordWriteback returns worker_not_trusted for remote worker without registrationVerifiedAt", () => {
  const store = createMockStore();
  const execution = makeExecution();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution,
    task: makeTask(),
    workflow: makeWorkflow(),
    session: makeSession(),
  });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot({ placement: "remote", registrationVerifiedAt: null });
  store.worker.getExecutionLease = () => ({
    id: "lease-001",
    executionId: "exec-001",
    workerId: "worker-001",
    status: "active",
    fencingToken: 1,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
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

test("recordWriteback returns remote_authority_block_reason for remote worker with viewer_only session", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution(),
    task: makeTask(),
    workflow: makeWorkflow(),
    session: makeSession(),
  });
  store.worker.getWorkerSnapshot = () =>
    makeWorkerSnapshot({
      placement: "remote",
      registrationVerifiedAt: "2024-01-01T00:00:00.000Z",
      remoteSessionStatus: "viewer_only",
      lastAcknowledgedStreamOffset: "offset-123",
    });
  store.worker.getExecutionLease = () => ({
    id: "lease-001",
    executionId: "exec-001",
    workerId: "worker-001",
    status: "active",
    fencingToken: 1,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
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

test("recordWriteback returns remote_authority_block_reason for remote worker with consistency mismatch", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution(),
    task: makeTask(),
    workflow: makeWorkflow(),
    session: makeSession(),
  });
  store.worker.getWorkerSnapshot = () =>
    makeWorkerSnapshot({
      placement: "remote",
      registrationVerifiedAt: "2024-01-01T00:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "offset-123",
      sessionConsistencyCheckStatus: "mismatch",
    });
  store.worker.getExecutionLease = () => ({
    id: "lease-001",
    executionId: "exec-001",
    workerId: "worker-001",
    status: "active",
    fencingToken: 1,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
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

test("recordWriteback returns remote_authority_block_reason for remote worker with workspace conflict", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution(),
    task: makeTask(),
    workflow: makeWorkflow(),
    session: makeSession(),
  });
  store.worker.getWorkerSnapshot = () =>
    makeWorkerSnapshot({
      placement: "remote",
      registrationVerifiedAt: "2024-01-01T00:00:00.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "offset-123",
      workspaceSyncStatus: "conflict",
    });
  store.worker.getExecutionLease = () => ({
    id: "lease-001",
    executionId: "exec-001",
    workerId: "worker-001",
    status: "active",
    fencingToken: 1,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
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

test("recordWriteback returns resource_limit_exceeded when resource ceiling guard fails", () => {
  const store = createMockStore();
  store.operations.loadExecutionAuthoritativeView = () => ({
    execution: makeExecution(),
    task: makeTask(),
    workflow: makeWorkflow(),
    session: makeSession(),
  });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  store.worker.getExecutionLease = () => ({
    id: "lease-001",
    executionId: "exec-001",
    workerId: "worker-001",
    status: "active",
    fencingToken: 1,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  store.worker.getAgentExecutionRecord = () => null;
  const db = createMockDb();
  const service = new ExecutionWorkerWritebackService(db, store);

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
