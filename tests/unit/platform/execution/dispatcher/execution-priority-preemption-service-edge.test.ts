import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionPriorityPreemptionService, type PriorityPreemptionRequest } from "../../../../../src/platform/execution/dispatcher/execution-priority-preemption-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionTicketRecord, TaskPriority, WorkerIsolationLevel } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

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

function createMockExecution(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "exec-running-1",
    taskId: "task-1",
    workflowId: "wf-1",
    roleId: "role-1",
    agentId: "agent-1",
    status: "executing",
    runKind: "task_run",
    attempt: 1,
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
    ...overrides,
  };
}

function createMockWorkflow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taskId: "task-1",
    status: "running",
    currentStepIndex: 0,
    outputsJson: null,
    resumableFromStep: "step-1",
    retryCount: 0,
    lastErrorCode: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockLease(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "lease-1",
    executionId: "exec-running-1",
    workerId: "worker-1",
    status: "active",
    claimedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    releasedAt: null,
    releasedReason: null,
    ...overrides,
  };
}

function createMockAgentExecution(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    executionId: "exec-running-1",
    taskId: "task-1",
    agentId: "agent-1",
    workflowId: "wf-1",
    roleId: "role-1",
    runKind: "task_run",
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    planJson: "{}",
    currentStepId: null,
    lastToolName: null,
    toolCallCount: 0,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: null,
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
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

// ---------------------------------------------------------------------------
// preemptForUrgentTicket with worker compatibility scenarios
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket returns not_preempted when worker has available slots", () => {
  const worker = createMockWorker({
    availableSlots: 1,
    maxConcurrency: 1,
    runningExecutionIds: [],
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket returns not_preempted when worker maxConcurrency is not 1", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 2,
    runningExecutionIds: ["exec-1", "exec-2"],
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket returns not_preempted when worker has wrong runningExecutionIds count", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: [], // Empty, not matching maxConcurrency=1
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters by dispatchTarget local_only with remote worker", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    placement: "remote",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket, { dispatchTarget: "local_only" });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters by dispatchTarget require_remote with local worker", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    placement: "local",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket, { dispatchTarget: "require_remote" });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters worker by unavailable status", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    status: "unavailable",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters worker by quarantined status", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    status: "quarantined",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters worker by offline status", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    status: "offline",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters worker by draining status", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    status: "draining",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket excludes degraded workers when includeDegraded is false", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    status: "degraded",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket, { includeDegraded: false });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters untrusted remote workers", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    placement: "remote",
    trusted: false,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "100",
    sessionConsistencyCheckStatus: "passed",
    workspaceSyncStatus: "aligned",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters by queueAffinity mismatch", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    queueAffinity: "queue-alpha",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical", { queueName: "queue-beta" });
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters by insufficient isolation level", () => {
  const worker = createMockWorker({
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

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket, { requiredIsolationLevel: "hardened" as WorkerIsolationLevel });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters by repo version mismatch", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    repoVersion: "v1.0.0",
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket, { requiredRepoVersion: "v2.0.0" });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters by missing capabilities", () => {
  const worker = createMockWorker({
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    capabilities: ["gpu"],
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket, { requiredCapabilities: ["gpu", "large_memory"] });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters by preferredWorkerId mismatch", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket, { preferredWorkerId: "worker-2" });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket skips source execution in candidate selection", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-1"], // Same as ticket.executionId
  });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical", { executionId: "exec-1" });
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters execution with non-executing status", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
  });
  const execution = createMockExecution({ id: "exec-running-1", status: "pending" });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
    dispatch: {
      getExecution: () => execution,
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters when workflow status is not running", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
  });
  const execution = createMockExecution({ id: "exec-running-1" });
  const workflow = createMockWorkflow({ status: "paused" });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
    },
    dispatch: {
      getExecution: () => execution,
    },
    workflow: {
      getWorkflowState: () => workflow,
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters when no active lease", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
  });
  const execution = createMockExecution({ id: "exec-running-1" });
  const workflow = createMockWorkflow({ status: "running", resumableFromStep: "step-1" });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
      getActiveExecutionLease: () => null,
    },
    dispatch: {
      getExecution: () => execution,
    },
    workflow: {
      getWorkflowState: () => workflow,
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters when lease workerId does not match", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
  });
  const execution = createMockExecution({ id: "exec-running-1" });
  const workflow = createMockWorkflow({ status: "running", resumableFromStep: "step-1" });
  const lease = createMockLease({ workerId: "worker-2" }); // Different worker
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
      getActiveExecutionLease: () => lease,
    },
    dispatch: {
      getExecution: () => execution,
    },
    workflow: {
      getWorkflowState: () => workflow,
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters when no recovery step", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
  });
  const execution = createMockExecution({ id: "exec-running-1" });
  const workflow = createMockWorkflow({ status: "running", resumableFromStep: null });
  const lease = createMockLease({ workerId: "worker-1" });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
      getActiveExecutionLease: () => lease,
      listExecutionTicketsByExecution: () => [],
    },
    dispatch: {
      getExecution: () => execution,
    },
    workflow: {
      getWorkflowState: () => workflow,
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters when worker currentStepId does not match recovery step", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    currentStepId: "step-2", // Different from recovery step
  });
  const execution = createMockExecution({ id: "exec-running-1" });
  const workflow = createMockWorkflow({ status: "running", resumableFromStep: "step-1" });
  const lease = createMockLease({ workerId: "worker-1" });
  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
      getActiveExecutionLease: () => lease,
      listExecutionTicketsByExecution: () => [],
    },
    dispatch: {
      getExecution: () => execution,
    },
    workflow: {
      getWorkflowState: () => workflow,
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("preemptForUrgentTicket filters when agentExecution currentStepId does not match recovery step", () => {
  const worker = createMockWorker({
    workerId: "worker-1",
    availableSlots: 0,
    maxConcurrency: 1,
    runningExecutionIds: ["exec-running-1"],
    currentStepId: null, // Worker step is null
  });
  const execution = createMockExecution({ id: "exec-running-1" });
  const workflow = createMockWorkflow({ status: "running", resumableFromStep: "step-1" });
  const lease = createMockLease({ workerId: "worker-1" });
  const agentExecution = createMockAgentExecution({ currentStepId: "step-2" }); // Different from recovery

  const store = createMockStore({
    workers: {
      listWorkers: () => [worker],
      getActiveExecutionLease: () => lease,
      listExecutionTicketsByExecution: () => [],
      getAgentExecutionRecord: () => agentExecution,
    },
    dispatch: {
      getExecution: () => execution,
    },
    workflow: {
      getWorkflowState: () => workflow,
    },
  });
  const service = new ExecutionPriorityPreemptionService(createMockDb(), store);

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

// ---------------------------------------------------------------------------
// Additional isolation level tests
// ---------------------------------------------------------------------------

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

  const ticket = createMockTicket("critical");
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

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket, { requiredIsolationLevel: "strict" as WorkerIsolationLevel });
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

// ---------------------------------------------------------------------------
// Remote session readiness tests
// ---------------------------------------------------------------------------

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

  const ticket = createMockTicket("critical");
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

  const ticket = createMockTicket("critical");
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

  const ticket = createMockTicket("critical");
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

  const ticket = createMockTicket("critical");
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

  const ticket = createMockTicket("critical");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});
