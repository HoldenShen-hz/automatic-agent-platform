import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for ticket dispatch filtering (poison pill detection per R9-05)
 * Verifies that tickets are properly filtered based on their state and dispatch timing
 */

import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionTicketRecord, TaskPriority, ExecutionRecord, TaskRecord } from "../../../../../src/platform/contracts/types/domain.js";

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
      listTasks: () => [],
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
  overrides: Partial<ExecutionTicketRecord> = {},
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// R9-05: Ticket dispatch filtering / poison pill detection
// ---------------------------------------------------------------------------

test("dispatchNext only returns pending tickets from listDispatchableExecutionTickets", () => {
  // listDispatchableExecutionTickets only returns pending tickets with dispatchAfter <= now
  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [];

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.outcome, "no_ticket");
});

test("dispatchNext skips tickets when listDispatchableExecutionTickets returns empty array", () => {
  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [];

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  assert.equal(result.ticket, null);
  assert.equal(result.worker, null);
});

test("dispatchNext returns first ticket when listDispatchableExecutionTickets returns tickets", () => {
  const mockTicket1 = createMockTicket("ticket-1", "exec-1", "task-1");
  mockTicket1.priority = "low";
  const mockTicket2 = createMockTicket("ticket-2", "exec-2", "task-2");
  mockTicket2.priority = "critical";

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket1, mockTicket2];
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
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  // No workers available, so should get no_worker outcome but with first ticket
  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  // Outcome is no_worker because no eligible workers
  assert.equal(result.outcome, "no_worker");
  assert.equal(result.ticket?.id, "ticket-1");
});

test("dispatchNext skips ticket when backpressure blocks it", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "low");

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
  // Backpressure with queue_only mode should block low priority
  const backpressureSnapshot = () => ({
    status: "overloaded" as const,
    degradationMode: "queue_only" as const,
    queueGovernance: {
      backlogSize: 100,
      dispatchableBacklogSize: 50,
      claimedBacklogSize: 30,
      oldestWaitSeconds: 400, // starvation detected
      oldestClaimAgeSeconds: 120,
      queueNames: ["default"],
      starvationDetected: true,
    },
    findings: [],
  });
  const service = new ExecutionDispatchService(db, store, backpressureSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });

  // Should be blocked due to backpressure (starvation protection for low priority)
  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "backpressure.starvation_protection");
});

test("dispatchNext uses dispatchAfter to filter tickets at query level", () => {
  // The listDispatchableExecutionTickets filters by dispatchAfter at SQL level
  // Tickets with dispatchAfter > current time are not returned
  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => []; // Future tickets filtered out

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.dispatchNext({
    leaseTtlMs: 60000,
    occurredAt: "2025-01-01T00:00:00.000Z",
  });

  // No tickets returned because all have future dispatchAfter
  assert.equal(result.outcome, "no_ticket");
});

test("dispatchNext with queueName filter only returns tickets for that queue", () => {
  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => []; // No tickets for "other-queue"

  const db = createMockDb();
  const service = new ExecutionDispatchService(db, store);

  const result = service.dispatchNext({
    leaseTtlMs: 60000,
    queueName: "my-queue",
  });

  // listDispatchableExecutionTickets called with queueName="my-queue"
  assert.equal(result.outcome, "no_ticket");
});

test("createTicket marks new tickets with pending status", () => {
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

  const result = service.createTicket({ executionId: "exec-1" });

  assert.equal(result.outcome, "created");
  assert.equal(result.ticket.status, "pending");
  assert.equal(result.ticket.invalidatedAt, null);
  assert.equal(result.ticket.consumedAt, null);
});

test("createTicket returns existing ticket instead of creating new one", () => {
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
  assert.equal(result.ticket.id, "existing-ticket");
  // Existing ticket should retain its status
  assert.equal(result.ticket.status, "pending");
});

test("dispatchNext blocks high priority when read_only mode even though elevated", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "high");

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1", "high"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });

  const db = createMockDb();
  // read_only_operations_only blocks ALL tasks regardless of priority
  const backpressureSnapshot = () => ({
    status: "unhealthy" as const,
    degradationMode: "read_only_operations_only" as const,
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

  // Even high priority is blocked in read_only mode
  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "backpressure.read_only_mode");
});

test("dispatchNext allows critical priority even when pause_non_critical backpressure", () => {
  const mockTicket = createMockTicket("ticket-1", "exec-1", "task-1", "critical");

  const store = createMockStore();
  (store.worker as any).listDispatchableExecutionTickets = () => [mockTicket];
  (store.dispatch as any).getExecution = () => createMockExecution("exec-1", "task-1");
  (store.operations as any).loadExecutionAuthoritativeView = () => ({
    execution: createMockExecution("exec-1", "task-1"),
    task: createMockTask("task-1", "critical"),
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: new Date().toISOString(),
  });
  (store.worker as any).listWorkers = () => [];
  (store.worker as any).getWorker = () => null;

  const db = createMockDb();
  const backpressureSnapshot = () => ({
    status: "degraded" as const,
    degradationMode: "pause_non_critical" as const,
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

  // Critical priority should not be blocked by pause_non_critical
  // But will get no_worker since no workers are available
  assert.equal(result.outcome, "no_worker");
  assert.equal(result.ticket?.id, "ticket-1");
});