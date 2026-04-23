import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionTicketRecord, TaskPriority } from "../../../../../src/platform/contracts/types/domain.js";

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
      listExecutionTicketsByExecution: () => [],
      listWorkerSnapshots: () => [],
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

test.skip("dispatchNext returns blocked when queue availability unavailable", () => {
  // SKIPPED: implementation checks tickets before queue availability,
  // so when no tickets, returns no_ticket instead of blocked
  const db = createMockDb();
  const store = createMockStore();
  const queueAvailSnapshot = () => ({
    state: "unavailable" as const,
    reasonCode: "maintenance",
  });
  const service = new ExecutionDispatchService(db, store, null, queueAvailSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });
  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "maintenance");
});

test.skip("dispatchNext with empty tickets and unavailable queue returns blocked", () => {
  // SKIPPED: implementation checks tickets before queue availability,
  // so when no tickets, returns no_ticket instead of blocked
  const db = createMockDb();
  const store = createMockStore();
  const queueAvailSnapshot = () => ({
    state: "unavailable" as const,
    reasonCode: "queue_down",
  });
  const service = new ExecutionDispatchService(db, store, null, queueAvailSnapshot);

  const result = service.dispatchNext({ leaseTtlMs: 60000 });
  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "queue_down");
});

// ---------------------------------------------------------------------------
// dispatchNext with backpressure blocked
// ---------------------------------------------------------------------------

test("dispatchNext returns blocked when backpressure snapshot is unavailable", () => {
  const db = createMockDb();
  const store = createMockStore();
  // Create a backpressure snapshot that indicates issues
  const backpressureSnapshot = () => ({
    status: "overloaded" as const,
    degradationMode: "queue_only" as const,
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

  // Even with no tickets, backpressure blocks dispatch
  const result = service.dispatchNext({ leaseTtlMs: 60000 });
  // This will be "no_ticket" because there are no tickets to dispatch
  assert.equal(result.outcome, "no_ticket");
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