/**
 * Execution Dispatch Service Unit Tests
 *
 * Tests the core dispatch logic: ticket creation, worker evaluation,
 * and dispatch decision making.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

function createMockStore(): AuthoritativeTaskStore {
  const store = {
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
  } as unknown as AuthoritativeTaskStore;
  return store;
}

test("ExecutionDispatchService.createTicket throws when execution not found", (t) => {
  const mockDb = {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
  const mockStore = createMockStore();
  mockStore.operations.loadExecutionAuthoritativeView = () => null;

  const service = new ExecutionDispatchService(mockDb, mockStore);
  assert.throws(
    () => service.createTicket({ executionId: "non-existent" }),
    /storage\.execution_not_found/,
  );
});

test("ExecutionDispatchService.createTicket returns exists when ticket already exists", (t) => {
  const mockDb = {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
  const mockStore = createMockStore();
  const existingTicket = { id: "existing-ticket", status: "pending" };
  mockStore.worker.getActiveExecutionTicket = () => existingTicket as ReturnType<typeof mockStore.worker.getActiveExecutionTicket>;
  mockStore.operations.loadExecutionAuthoritativeView = () => ({
    execution: { id: "exec-1", taskId: "task-1" },
    task: { id: "task-1", priority: "normal" as const },
  });

  const service = new ExecutionDispatchService(mockDb, mockStore);
  const result = service.createTicket({ executionId: "exec-1" });
  assert.equal(result.outcome, "exists");
  assert.equal(result.ticket, existingTicket);
});

test("ExecutionDispatchService.dispatchNext returns no_ticket when no tickets available", (t) => {
  const mockDb = {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
  const mockStore = createMockStore();
  mockStore.worker.listDispatchableExecutionTickets = () => [];

  const service = new ExecutionDispatchService(mockDb, mockStore);
  const result = service.dispatchNext({ queueName: "default", leaseTtlMs: 30_000 });
  assert.equal(result.outcome, "no_ticket");
  assert.equal(result.ticket, null);
  assert.equal(result.worker, null);
});

test("ExecutionDispatchService.createTicket creates ticket with correct fields", (t) => {
  const mockDb = {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
  const mockStore = createMockStore();
  let insertedTicket: ReturnType<typeof mockStore.worker.insertExecutionTicket> | null = null;
  mockStore.worker.insertExecutionTicket = (ticket) => { insertedTicket = ticket; };
  mockStore.operations.loadExecutionAuthoritativeView = () => ({
    execution: { id: "exec-1", taskId: "task-1", traceId: "trace-1" },
    task: { id: "task-1", priority: "high" as const },
  });

  const service = new ExecutionDispatchService(mockDb, mockStore);
  const result = service.createTicket({
    executionId: "exec-1",
    queueName: "priority",
    requiredCapabilities: ["bash"],
    priority: "high",
  });

  assert.equal(result.outcome, "created");
  assert.ok(insertedTicket);
  assert.equal(insertedTicket!.queueName, "priority");
  assert.equal(insertedTicket!.priority, "high");
});

test("ExecutionDispatchService.dispatchNext blocked by backpressure", (t) => {
  const mockDb = {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
  const mockStore = createMockStore();
  const ticket = {
    id: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
    priority: "normal" as const,
    queueName: "default",
    dispatchTarget: "any" as const,
    requiredIsolationLevel: "standard" as const,
    requiredRepoVersion: null,
    requiredCapabilitiesJson: "[]",
  };
  mockStore.worker.listDispatchableExecutionTickets = () => [ticket];
  mockStore.operations.loadExecutionAuthoritativeView = () => ({
    execution: { id: "exec-1", taskId: "task-1", traceId: "trace-1" },
    task: { id: "task-1", priority: "normal" as const },
  });

  const service = new ExecutionDispatchService(
    mockDb,
    mockStore,
    () => ({
      globalBackpressureScore: 1.0,
      nodeBackpressureScores: [],
      reasonCode: "backpressure_high",
      isGlobalBlocked: true,
    }),
  );
  const result = service.dispatchNext({ queueName: "default", leaseTtlMs: 30_000 });
  assert.equal(result.outcome, "blocked");
});

test("ExecutionDispatchService.evaluateWorkersForTicket filters workers by capabilities", (t) => {
  const mockDb = {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
  const mockStore = createMockStore();
  mockStore.worker.listDispatchableExecutionTickets = () => [
    {
      id: "ticket-cap",
      executionId: "exec-cap",
      taskId: "task-cap",
      priority: "normal" as const,
      queueName: "default",
      dispatchTarget: "any" as const,
      requiredIsolationLevel: "standard" as const,
      requiredRepoVersion: null,
      requiredCapabilitiesJson: JSON.stringify(["python", "bash"]),
    },
  ];
  mockStore.worker.listWorkers = () => [
    { workerId: "w1", status: "idle", capabilities: ["bash"], placement: "local" },
    { workerId: "w2", status: "idle", capabilities: ["bash", "python"], placement: "local" },
  ] as ReturnType<typeof mockStore.worker.listWorkers>;
  mockStore.operations.loadExecutionAuthoritativeView = () => ({
    execution: { id: "exec-cap", taskId: "task-cap", traceId: "trace-cap" },
    task: { id: "task-cap", priority: "normal" as const },
  });

  const service = new ExecutionDispatchService(mockDb, mockStore);
  service.dispatchNext({ queueName: "default", leaseTtlMs: 30_000, preferredWorkerId: null });

  // w1 rejected for missing_capabilities, w2 accepted
  const events = mockStore.event.insertEvent.mockcalls ?? [];
  assert.ok(events.length > 0);
});

test("ExecutionDispatchService.dispatchNext applies worker placement filter", (t) => {
  const mockDb = {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
  const mockStore = createMockStore();
  const ticket = {
    id: "ticket-placement",
    executionId: "exec-placement",
    taskId: "task-placement",
    priority: "normal" as const,
    queueName: "default",
    dispatchTarget: "local_only" as const,
    requiredIsolationLevel: "standard" as const,
    requiredRepoVersion: null,
    requiredCapabilitiesJson: "[]",
  };
  mockStore.worker.listDispatchableExecutionTickets = () => [ticket];
  mockStore.worker.listWorkers = () => [
    { workerId: "w-local", status: "idle", capabilities: ["bash"], placement: "local" },
    { workerId: "w-remote", status: "idle", capabilities: ["bash"], placement: "remote", trusted: false },
  ] as ReturnType<typeof mockStore.worker.listWorkers>;
  mockStore.operations.loadExecutionAuthoritativeView = () => ({
    execution: { id: "exec-placement", taskId: "task-placement", traceId: "trace-placement" },
    task: { id: "task-placement", priority: "normal" as const },
  });

  const service = new ExecutionDispatchService(mockDb, mockStore);
  const result = service.dispatchNext({ queueName: "default", leaseTtlMs: 30_000 });

  assert.equal(result.outcome, "dispatched");
  assert.equal(result.worker?.workerId, "w-local");
});

test("ExecutionDispatchService.createTicket uses task priority when not specified", (t) => {
  const mockDb = {
    transaction: (fn: () => void) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
  const mockStore = createMockStore();
  let insertedTicket: Parameters<typeof mockStore.worker.insertExecutionTicket>[0] | null = null;
  mockStore.worker.insertExecutionTicket = (ticket) => { insertedTicket = ticket; };
  mockStore.operations.loadExecutionAuthoritativeView = () => ({
    execution: { id: "exec-priority", taskId: "task-priority", traceId: "trace-priority" },
    task: { id: "task-priority", priority: "critical" as const },
  });

  const service = new ExecutionDispatchService(mockDb, mockStore);
  const result = service.createTicket({ executionId: "exec-priority" });

  assert.equal(result.outcome, "created");
  assert.equal(insertedTicket?.priority, "critical");
});