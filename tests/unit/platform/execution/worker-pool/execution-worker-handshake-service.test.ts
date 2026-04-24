import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionWorkerHandshakeService } from "../../../../../src/platform/execution/worker-pool/execution-worker-handshake-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionTicketRecord, WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

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
      getLatestExecutionLease: () => null,
      getLatestFencingToken: () => 0,
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

function makeTicket(overrides: Partial<ExecutionTicketRecord> = {}): ExecutionTicketRecord {
  return {
    id: "ticket-001",
    taskId: "task-001",
    executionId: "exec-001",
    // @ts-ignore
    priority: 0,
    // @ts-ignore
    queueName: null,
    status: "claimed",
    assignedWorkerId: "worker-001",
    leaseId: "lease-001",
    claimedAt: "2024-01-01T00:00:00.000Z",
    // @ts-ignore
    consumedAt: null,
    // @ts-ignore
    invalidatedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    requiredCapabilitiesJson: "[]",
    // @ts-ignore
    dispatchAfter: null,
    attempt: 1,
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
// claimExecution
// ---------------------------------------------------------------------------

test("claimExecution returns ticket_not_found when ticket does not exist", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.claimExecution({
    ticketId: "nonexistent",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "ticket_not_found");
});

test("claimExecution returns worker_not_registered when worker snapshot not found", () => {
  const store = createMockStore();
  store.worker.getExecutionTicket = () => makeTicket();
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.claimExecution({
    ticketId: "ticket-001",
    workerId: "nonexistent",
    leaseId: "lease-001",
    fencingToken: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "worker_not_registered");
});

test("claimExecution returns worker_not_trusted for remote worker without registrationVerifiedAt", () => {
  const store = createMockStore();
  store.worker.getExecutionTicket = () => makeTicket();
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot({ placement: "remote", registrationVerifiedAt: null });
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.claimExecution({
    ticketId: "ticket-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "worker_not_trusted");
});

test("claimExecution returns ticket_not_claimed when ticket status is not claimed", () => {
  const store = createMockStore();
  store.worker.getExecutionTicket = () => makeTicket({ status: "pending" });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.claimExecution({
    ticketId: "ticket-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "ticket_not_claimed");
});

test("claimExecution returns worker_mismatch when ticket assigned to different worker", () => {
  const store = createMockStore();
  store.worker.getExecutionTicket = () => makeTicket({ assignedWorkerId: "other-worker" });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.claimExecution({
    ticketId: "ticket-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("claimExecution returns lease_mismatch when leaseId does not match", () => {
  const store = createMockStore();
  store.worker.getExecutionTicket = () => makeTicket({ leaseId: "lease-001" });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.claimExecution({
    ticketId: "ticket-001",
    workerId: "worker-001",
    leaseId: "different-lease",
    fencingToken: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "lease_mismatch");
});

test("claimExecution returns execution_not_found when execution does not exist", () => {
  const store = createMockStore();
  store.worker.getExecutionTicket = () => makeTicket();
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  store.dispatch.getExecution = () => null;
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.claimExecution({
    ticketId: "ticket-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "execution_not_found");
});

test("claimExecution returns resource_limit_exceeded when resource ceiling guard fails", () => {
  const store = createMockStore();
  const ticket = makeTicket();
  store.worker.getExecutionTicket = () => ticket;
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  store.dispatch.getExecution = () => ({
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    parentExecutionId: null,
    agentId: "agent-001",
    roleId: null,
    runKind: "task_run" as const,
    status: "created",
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
    startedAt: null,
    finishedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.claimExecution({
    ticketId: "ticket-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    runtimeInstanceId: "runtime-bad",
    memoryMb: 99999,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "resource_limit_exceeded");
});

// ---------------------------------------------------------------------------
// recordHeartbeat
// ---------------------------------------------------------------------------

test("recordHeartbeat returns execution_not_found when execution does not exist", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.recordHeartbeat({
    executionId: "nonexistent",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    ttlMs: 30000,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "execution_not_found");
});

test("recordHeartbeat returns worker_not_registered when worker snapshot not found", () => {
  const store = createMockStore();
  store.dispatch.getExecution = () => ({
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    parentExecutionId: null,
    agentId: "agent-001",
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
  });
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.recordHeartbeat({
    executionId: "exec-001",
    workerId: "nonexistent",
    leaseId: "lease-001",
    fencingToken: 1,
    ttlMs: 30000,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "worker_not_registered");
});

test("recordHeartbeat returns worker_not_trusted for remote worker without registrationVerifiedAt", () => {
  const store = createMockStore();
  store.dispatch.getExecution = () => ({
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    parentExecutionId: null,
    agentId: "agent-001",
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
  });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot({ placement: "remote", registrationVerifiedAt: null });
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.recordHeartbeat({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    ttlMs: 30000,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "worker_not_trusted");
});

test("recordHeartbeat returns resource_limit_exceeded when resource ceiling guard fails", () => {
  const store = createMockStore();
  store.dispatch.getExecution = () => ({
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    parentExecutionId: null,
    agentId: "agent-001",
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
  });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  store.worker.getAgentExecutionRecord = () => undefined;
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.recordHeartbeat({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "lease-001",
    fencingToken: 1,
    ttlMs: 30000,
    runtimeInstanceId: "runtime-bad",
    memoryMb: 99999,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "resource_limit_exceeded");
});

test("recordHeartbeat returns rejected reason when lease renewal fails", () => {
  const store = createMockStore();
  store.dispatch.getExecution = () => ({
    id: "exec-001",
    taskId: "task-001",
    workflowId: "wf-001",
    parentExecutionId: null,
    agentId: "agent-001",
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
  });
  store.worker.getWorkerSnapshot = () => makeWorkerSnapshot();
  store.worker.getAgentExecutionRecord = () => undefined;
  const db = createMockDb();
  const service = new ExecutionWorkerHandshakeService(db, store);

  const result = service.recordHeartbeat({
    executionId: "exec-001",
    workerId: "worker-001",
    leaseId: "nonexistent-lease",
    fencingToken: 1,
    ttlMs: 30000,
  });

  assert.equal(result.accepted, false);
  assert.notEqual(result.reasonCode, null);
});
