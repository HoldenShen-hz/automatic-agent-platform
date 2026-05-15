import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionTicketRecord, TaskPriority, ExecutionRecord, TaskRecord, WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { RegisteredWorkerView } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";

// ---------------------------------------------------------------------------
// Helper types
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
      getAgentExecutionRecord: () => null,
      upsertAgentExecutionRecord: () => {},
      getActiveExecutionLease: () => null,
      listExecutionTicketsByStatuses: () => [],
      listWorkers: () => [],
      getWorker: () => null,
      getWorkerSnapshot: () => null,
      listExecutionTicketsByExecution: () => [],
      listWorkerSnapshots: () => [],
      upsertWorkerSnapshot: () => {},
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

function createMockExecution(id = "exec-1", taskId = "task-1", attempt = 1): ExecutionRecord {
  return {
    id,
    taskId,
    workflowId: "wf-1",
    roleId: "role-1",
    agentId: "agent-1",
    status: "executing",
    runKind: "task_run",
    attempt,
    traceId: "trace-1",
    parentExecutionId: null,
    inputRef: null,
    budgetUsdLimit: null,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 3,
    retryBackoff: "exponential",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeoutMs: 3600000,
  };
}

function createMockTask(id = "task-1", priority: TaskPriority = "normal"): TaskRecord {
  return {
    id,
    title: "Test Task",
    status: "in_progress",
    source: "user",
    priority,
    parentId: null,
    rootId: id,
    divisionId: null,
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function createMockTicket(
  id = "ticket-1",
  executionId = "exec-1",
  taskId = "task-1",
  priority: TaskPriority = "normal",
): ExecutionTicketRecord {
  return {
    id,
    executionId,
    taskId,
    priority,
    queueName: null,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilitiesJson: "[]",
    dispatchAfter: null,
    attempt: 1,
    status: "pending",
    assignedWorkerId: null,
    leaseId: null,
    claimedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ExecutionDispatchService construction
// ---------------------------------------------------------------------------

test("ExecutionDispatchService can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchService(db, store);
  assert.ok(service instanceof ExecutionDispatchService);
});

test("ExecutionDispatchService accepts optional backpressure snapshot function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const backpressureSnapshot = () => null;
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);
  assert.ok(service instanceof ExecutionDispatchService);
});

test("ExecutionDispatchService accepts optional queue availability snapshot function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const queueAvailSnapshot = () => null;
  const service = new ExecutionDispatchService(db, store, null, queueAvailSnapshot);
  assert.ok(service instanceof ExecutionDispatchService);
});

// ---------------------------------------------------------------------------
// createTicket throws when execution not found
// ---------------------------------------------------------------------------

test("createTicket throws StorageError when execution not found", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchService(db, store);

  assert.throws(
    () => service.createTicket({ executionId: "nonexistent" }),
    (err: unknown) => {
      if (err instanceof Error && err.message.includes("Execution not found")) {
        return true;
      }
      return false;
    },
  );
});

// ---------------------------------------------------------------------------
// createTicket returns exists when ticket already active
// ---------------------------------------------------------------------------

test("createTicket returns outcome=exists when active ticket already exists", () => {
  const existingTicket = createMockTicket("existing-ticket", "exec-1", "task-1");
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => existingTicket;

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({ executionId: "exec-1" });

  assert.equal(result.outcome, "exists");
  assert.equal(result.ticket, existingTicket);
});

// ---------------------------------------------------------------------------
// createTicket throws when task not found
// ---------------------------------------------------------------------------

test("createTicket throws StorageError when task not found", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: null, // No task
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  assert.throws(
    () => service.createTicket({ executionId: "exec-1" }),
    (err: unknown) => {
      if (err instanceof Error && err.message.includes("Task not found")) {
        return true;
      }
      return false;
    },
  );
});

// ---------------------------------------------------------------------------
// createTicket creates new ticket successfully
// ---------------------------------------------------------------------------

test("createTicket creates new ticket with default priority from task", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1", "high");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({ executionId: "exec-1" });

  assert.equal(result.outcome, "created");
  assert.ok(result.ticket != null);
  assert.equal(result.ticket.executionId, "exec-1");
  assert.equal(result.ticket.taskId, "task-1");
  assert.equal(result.ticket.priority, "high"); // From task
  assert.equal(result.ticket.status, "pending");
});

test("createTicket creates new ticket with explicit priority override", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1", "normal");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({ executionId: "exec-1", priority: "urgent" });

  assert.equal(result.outcome, "created");
  assert.equal(result.ticket.priority, "urgent"); // Override
});

test("createTicket creates new ticket with queueName", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({ executionId: "exec-1", queueName: "priority-queue" });

  assert.equal(result.outcome, "created");
  assert.equal(result.ticket.queueName, "priority-queue");
});

test("createTicket creates new ticket with dispatchTarget", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({ executionId: "exec-1", dispatchTarget: "local_only" });

  assert.equal(result.outcome, "created");
  assert.equal(result.ticket.dispatchTarget, "local_only");
});

test("createTicket creates new ticket with requiredCapabilities", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({
    executionId: "exec-1",
    requiredCapabilities: ["gpu", "large_memory"],
  });

  assert.equal(result.outcome, "created");
  const capabilities = JSON.parse(result.ticket.requiredCapabilitiesJson);
  assert.deepStrictEqual(capabilities.sort(), ["gpu", "large_memory"]);
});

test("createTicket creates new ticket with requiredIsolationLevel", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({
    executionId: "exec-1",
    requiredIsolationLevel: "hardened",
  });

  assert.equal(result.outcome, "created");
  assert.equal(result.ticket.requiredIsolationLevel, "hardened");
});

test("createTicket creates new ticket with requiredRepoVersion", () => {
  const mockExecution = createMockExecution("exec-1", "task-1");
  const mockTask = createMockTask("task-1");

  const store = createMockStore();
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: mockExecution,
    task: mockTask,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).getActiveExecutionTicket = () => null;
  (store.worker as any).insertExecutionTicket = () => {};
  (store.event as any).insertEvent = () => {};

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.createTicket({
    executionId: "exec-1",
    requiredRepoVersion: "v2.0.0",
  });

  assert.equal(result.outcome, "created");
  assert.equal(result.ticket.requiredRepoVersion, "v2.0.0");
});

// ---------------------------------------------------------------------------
// dispatchNext returns no_ticket when no tickets available
// ---------------------------------------------------------------------------

test("dispatchNext returns no_ticket outcome when no tickets", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchService(db, store);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });
  assert.equal(result.outcome, "no_ticket");
  assert.equal(result.ticket, null);
  assert.equal(result.worker, null);
  assert.equal(result.leaseId, null);
});

test("dispatchNext with queueName returns no_ticket when no tickets", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchService(db, store);

  const result = service.dispatchNext({ leaseTtlMs: 60000, queueName: "test-queue" });
  assert.equal(result.outcome, "no_ticket");
});

// ---------------------------------------------------------------------------
// dispatchNext with queue unavailable
// ---------------------------------------------------------------------------

test("dispatchNext returns no_ticket when queue availability unavailable", () => {
  const db = createMockDb();
  const store = createMockStore();
  const queueAvailSnapshot = () => ({
    state: "unavailable" as const,
    reasonCode: "maintenance",
  });
  const service = new ExecutionDispatchService(db, store, null, queueAvailSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });
  assert.equal(result.outcome, "no_ticket");
});

test("dispatchNext with empty tickets and unavailable queue returns no_ticket", () => {
  const db = createMockDb();
  const store = createMockStore();
  const queueAvailSnapshot = () => ({
    state: "unavailable" as const,
    reasonCode: "queue_down",
  });
  const service = new ExecutionDispatchService(db, store, null, queueAvailSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });
  assert.equal(result.outcome, "no_ticket");
});

// ---------------------------------------------------------------------------
// dispatchNext with backpressure blocking
// ---------------------------------------------------------------------------

test("dispatchNext returns blocked for low priority ticket when queue_only backpressure", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "low");
  const mockWorker = createMockWorker("worker-1", { availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(mockWorker)];

  const backpressureSnapshot = () => ({
    status: "overloaded" as const,
    degradationMode: "queue_only" as const,
    queueGovernance: {
      backlogSize: 100,
      dispatchableBacklogSize: 50,
      claimedBacklogSize: 30,
      oldestWaitSeconds: 300,
      oldestClaimAgeSeconds: 120,
      queueNames: ["default"],
      starvationDetected: false,
    },
    findings: [],
  });

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "backpressure.queue_only");
});

// ---------------------------------------------------------------------------
// dispatchNext passes occurredAt to options
// ---------------------------------------------------------------------------

test("dispatchNext uses occurredAt from options", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchService(db, store);

  const occurredAt = "2024-01-01T00:00:00.000Z";
  const result = service.dispatchNext({ leaseTtlMs: 60000, occurredAt });
  assert.equal(result.outcome, "no_ticket");
});

test("dispatchNext accepts includeDegraded option", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchService(db, store);

  const result = service.dispatchNext({ leaseTtlMs: 60000, includeDegraded: true });
  assert.equal(result.outcome, "no_ticket");
});

test("dispatchNext accepts preferredWorkerId option", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchService(db, store);

  const result = service.dispatchNext({ leaseTtlMs: 60000, preferredWorkerId: "worker-1" });
  assert.equal(result.outcome, "no_ticket");
});

// ---------------------------------------------------------------------------
// dispatchNext returns no_worker when all workers filtered
// ---------------------------------------------------------------------------

function createMockWorker(workerId: string, overrides: Partial<RegisteredWorkerView> = {}): RegisteredWorkerView {
  return {
    workerId,
    status: "idle",
    schedulingStatus: "healthy",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    trusted: true,
    capabilities: [],
    runningExecutionIds: [],
    maxConcurrency: 10,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    availableSlots: 10,
    ...overrides,
  };
}

function workerToSnapshot(worker: RegisteredWorkerView): WorkerSnapshotRecord {
  return {
    workerId: worker.workerId,
    status: worker.status,
    placement: worker.placement,
    isolationLevel: worker.isolationLevel,
    repoVersion: worker.repoVersion,
    remoteSessionStatus: worker.remoteSessionStatus,
    lastAcknowledgedStreamOffset: worker.lastAcknowledgedStreamOffset,
    streamResumeSuccessRate: worker.streamResumeSuccessRate,
    credentialRefreshSuccessRate: worker.credentialRefreshSuccessRate,
    sessionConsistencyCheckStatus: worker.sessionConsistencyCheckStatus,
    sessionConsistencyCheckedAt: worker.sessionConsistencyCheckedAt,
    workspaceSyncStatus: worker.workspaceSyncStatus,
    workspaceSyncCheckedAt: worker.workspaceSyncCheckedAt,
    saturation: worker.saturation,
    activeLeaseCount: worker.activeLeaseCount,
    meanStartupLatencyMs: worker.meanStartupLatencyMs,
    sandboxSuccessRate: worker.sandboxSuccessRate,
    repoCacheHitRate: worker.repoCacheHitRate,
    registrationVerifiedAt: worker.registrationVerifiedAt,
    registrationChallengeId: worker.registrationChallengeId,
    capabilitiesJson: JSON.stringify(worker.capabilities),
    runningExecutionsJson: JSON.stringify(worker.runningExecutionIds),
    maxConcurrency: worker.maxConcurrency,
    queueAffinity: worker.queueAffinity,
    runtimeInstanceId: worker.runtimeInstanceId,
    restartedFromRuntimeInstanceId: worker.restartedFromRuntimeInstanceId,
    restartGeneration: worker.restartGeneration,
    cpuPct: worker.cpuPct,
    memoryMb: worker.memoryMb,
    toolBacklogCount: worker.toolBacklogCount,
    currentStepId: worker.currentStepId,
    lastProgressAt: worker.lastProgressAt,
    lastHeartbeatAt: worker.lastHeartbeatAt,
    updatedAt: worker.updatedAt,
  };
}

test("dispatchNext returns no_worker when all workers filtered out", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  mockTicket.requiredCapabilitiesJson = JSON.stringify(["nonexistent-capability"]);
  const worker1 = createMockWorker("worker-1", { capabilities: ["gpu"], availableSlots: 5 });
  const worker2 = createMockWorker("worker-2", { capabilities: ["memory"], availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.worker as any).listWorkerSnapshots = () => [workerToSnapshot(worker1), workerToSnapshot(worker2)];

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
  assert.equal(result.ticket, mockTicket);
  assert.equal(result.worker, null);
});

// ---------------------------------------------------------------------------
// dispatchNext with local_only dispatch target
// ---------------------------------------------------------------------------

test("dispatchNext with local_only dispatchTarget filters remote workers", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  mockTicket.dispatchTarget = "local_only";
  const remoteWorker = createMockWorker("worker-remote", { placement: "remote", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  // With only remote workers, local_only dispatch target should result in no_worker
  (store.worker as any).listWorkers = () => [remoteWorker];
  (store.worker as any).getWorker = () => remoteWorker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  // The remote worker should be filtered out by local_only, leaving no eligible workers
  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with require_remote dispatch target and no remote workers
// ---------------------------------------------------------------------------

test("dispatchNext with require_remote returns no_worker when no remote workers exist", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  mockTicket.dispatchTarget = "require_remote";
  const localWorker = createMockWorker("worker-local", { placement: "local", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [localWorker];
  (store.worker as any).getWorker = () => localWorker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  // With require_remote and no remote workers at all, the dispatch fail-closes as blocked.
  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "remote.unavailable");
});

// ---------------------------------------------------------------------------
// dispatchNext with prefer_remote and only local workers available
// ---------------------------------------------------------------------------

test("dispatchNext with prefer_remote returns no_worker when only unavailable workers", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  mockTicket.dispatchTarget = "prefer_remote";
  // Local worker with no available slots
  const localWorker = createMockWorker("worker-local", { placement: "local", availableSlots: 0 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  // With only local workers at capacity and prefer_remote, no eligible workers
  (store.worker as any).listWorkers = () => [localWorker];
  (store.worker as any).getWorker = () => localWorker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  // prefer_remote with no available local workers results in no_worker
  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with worker unavailable status
// ---------------------------------------------------------------------------

test("dispatchNext skips workers with unavailable status", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  const unavailableWorker = createMockWorker("worker-1", { status: "unavailable", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [unavailableWorker];
  (store.worker as any).getWorker = () => unavailableWorker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with worker quarantined status
// ---------------------------------------------------------------------------

test("dispatchNext skips workers with quarantined status", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  const quarantinedWorker = createMockWorker("worker-1", { status: "quarantined", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [quarantinedWorker];
  (store.worker as any).getWorker = () => quarantinedWorker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with worker offline status
// ---------------------------------------------------------------------------

test("dispatchNext skips workers with offline status", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  const offlineWorker = createMockWorker("worker-1", { status: "offline", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [offlineWorker];
  (store.worker as any).getWorker = () => offlineWorker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with worker draining status
// ---------------------------------------------------------------------------

test("dispatchNext skips workers with draining status", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  const drainingWorker = createMockWorker("worker-1", { status: "draining", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [drainingWorker];
  (store.worker as any).getWorker = () => drainingWorker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with worker at capacity
// ---------------------------------------------------------------------------

test("dispatchNext skips workers with no available slots", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  const worker = createMockWorker("worker-1", { availableSlots: 0 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [worker];
  (store.worker as any).getWorker = () => worker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with queue affinity mismatch
// ---------------------------------------------------------------------------

test("dispatchNext skips workers with queue affinity mismatch", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  mockTicket.queueName = "priority-queue";
  const worker = createMockWorker("worker-1", { queueAffinity: "different-queue", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [worker];
  (store.worker as any).getWorker = () => worker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with worker isolation level mismatch
// ---------------------------------------------------------------------------

test("dispatchNext skips workers with insufficient isolation level", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  mockTicket.requiredIsolationLevel = "strict";
  const worker = createMockWorker("worker-1", { isolationLevel: "standard", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [worker];
  (store.worker as any).getWorker = () => worker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with worker repo version mismatch
// ---------------------------------------------------------------------------

test("dispatchNext skips workers with repo version mismatch", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  mockTicket.requiredRepoVersion = "v2.0.0";
  const worker = createMockWorker("worker-1", { repoVersion: "v1.0.0", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [worker];
  (store.worker as any).getWorker = () => worker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with preferredWorkerId option
// ---------------------------------------------------------------------------

test("dispatchNext with preferredWorkerId returns no_worker when worker not found", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  // When preferredWorkerId is set but getWorker returns null, no worker is found
  (store.worker as any).listWorkers = () => [];
  (store.worker as any).getWorker = () => null;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000, preferredWorkerId: "nonexistent-worker" });

  assert.equal(result.outcome, "no_worker");
});

// ---------------------------------------------------------------------------
// dispatchNext with degraded workers included
// ---------------------------------------------------------------------------

test("dispatchNext without includeDegraded filters out degraded workers", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1");
  const degradedWorker = createMockWorker("worker-1", { status: "degraded", availableSlots: 5 });

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "ok" as const,
    degradationMode: "none" as const,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    findings: [],
  });

  (store.worker as any).listWorkers = () => [degradedWorker];
  (store.worker as any).getWorker = () => degradedWorker;

  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  // Without includeDegraded, degraded workers should be filtered out
  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_worker");
});
