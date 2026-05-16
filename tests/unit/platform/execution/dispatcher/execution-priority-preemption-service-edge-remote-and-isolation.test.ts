import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionPriorityPreemptionService, type PriorityPreemptionRequest } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service.js";
import type { ExecutionTicketRecord, TaskPriority, WorkerIsolationLevel } from "../../../../../src/platform/contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

function createMockStore(overrides: Partial<{
  workers: Record<string, unknown>;
  dispatch: Record<string, unknown>;
  workflow: Record<string, unknown>;
  task: Record<string, unknown>;
}> = {}): AuthoritativeTaskStore {
  return {
    operations: {
      loadExecutionAuthoritativeView: () => null,
      listActiveExecutionActivity: () => [],
    },
    task: {
      countQueuedTasks: () => 0,
      getTask: () => null,
      ...overrides.task,
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
      listExecutionTicketsByExecution: () => [],
      listWorkerSnapshots: () => [],
      ...overrides.workers,
    },
    dispatch: {
      getExecution: () => null,
      ...overrides.dispatch,
    },
    workflow: {
      getWorkflowState: () => null,
      updateWorkflowRecoveryState: () => {},
      ...overrides.workflow,
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockTicket(priority: TaskPriority = "normal", overrides: Partial<ExecutionTicketRecord> = {}): ExecutionTicketRecord {
  return {
    id: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
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
    ...overrides,
  };
}

function createMockWorker(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    workerId: "worker-1",
    status: "idle",
    schedulingStatus: "healthy",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
    queueAffinity: null,
    availableSlots: 1,
    maxConcurrency: 1,
    runningExecutionIds: [],
    capabilities: [],
    trusted: true,
    currentStepId: null,
    lastProgressAt: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    ...overrides,
  };
}

function createPreemptionRequest(ticket: ExecutionTicketRecord, overrides: Partial<PriorityPreemptionRequest> = {}): PriorityPreemptionRequest {
  return {
    ticket,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    preferredWorkerId: null,
    includeDegraded: false,
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

test("preemptForUrgentTicket rejects standard isolation when required is strict", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    isolationLevel: "standard",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });

  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket, { requiredIsolationLevel: "strict" as WorkerIsolationLevel });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket rejects hardened isolation when required is strict", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    isolationLevel: "hardened",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });

  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket, { requiredIsolationLevel: "strict" as WorkerIsolationLevel });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters remote worker with viewer_only session", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    placement: "remote",
    trusted: true,
    remoteSessionStatus: "viewer_only",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters remote worker with disconnected session", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    placement: "remote",
    trusted: true,
    remoteSessionStatus: "disconnected",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: null,
    workspaceSyncStatus: null,
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters remote worker with consistency mismatch", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    placement: "remote",
    trusted: true,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "mismatch",
    workspaceSyncStatus: "aligned",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters remote worker with workspace sync conflict", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    placement: "remote",
    trusted: true,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "conflict",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters remote worker with null stream offset", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    placement: "remote",
    trusted: true,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: null,
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});
