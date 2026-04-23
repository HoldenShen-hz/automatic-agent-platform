import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchServiceAsync } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service-async.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AdmissionBackpressureSnapshot } from "../../../../../src/platform/execution/dispatcher/admission-controller.js";

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
// ExecutionDispatchServiceAsync construction
// ---------------------------------------------------------------------------

test("ExecutionDispatchServiceAsync can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchServiceAsync(db, store);
  assert.ok(service instanceof ExecutionDispatchServiceAsync);
});

test("ExecutionDispatchServiceAsync getSyncService returns underlying sync service", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchServiceAsync(db, store);
  const sync = service.getSyncService();
  assert.ok(sync !== null);
  assert.equal((sync as unknown as { db: AuthoritativeSqlDatabase }).db, db);
});

// ---------------------------------------------------------------------------
// ExecutionDispatchServiceAsync createTicket returns Promise
// ---------------------------------------------------------------------------

test("ExecutionDispatchServiceAsync createTicket returns a Promise", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchServiceAsync(db, store);
  const result = service.createTicket({ executionId: "exec-1" });
  assert.ok(result instanceof Promise);
  // Without proper store setup, it will throw StorageError, but it should be a Promise
  try {
    await result;
    assert.fail("Should have thrown");
  } catch (error: unknown) {
    // Expected error - execution not found (StorageError has code, but also message)
    const err = error as { code?: string; message?: string };
    assert.ok(
      err.code?.includes("storage.execution_not_found") ||
      err.code?.includes("storage.task_not_found") ||
      err.message?.includes("Execution not found") ||
      err.message?.includes("Task not found")
    );
  }
});

// ---------------------------------------------------------------------------
// ExecutionDispatchServiceAsync dispatchNext returns Promise
// ---------------------------------------------------------------------------

test("ExecutionDispatchServiceAsync dispatchNext returns a Promise that resolves", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchServiceAsync(db, store);
  const result = service.dispatchNext({});
  assert.ok(result instanceof Promise);
  // With no tickets available, should return no_ticket outcome
  const decision = await result;
  assert.equal(decision.outcome, "no_ticket");
});

test("ExecutionDispatchServiceAsync dispatchNext with queueName option", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchServiceAsync(db, store);
  const decision = await service.dispatchNext({ queueName: "test-queue" });
  assert.equal(decision.outcome, "no_ticket");
});

// ---------------------------------------------------------------------------
// ExecutionDispatchServiceAsync with backpressure snapshot
// ---------------------------------------------------------------------------

test("ExecutionDispatchServiceAsync accepts backpressure snapshot function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const backpressure: AdmissionBackpressureSnapshot = {
    status: "healthy",
    degradationMode: "none",
    queueGovernance: { starvationDetected: false },
    findings: [],
  };
  const service = new ExecutionDispatchServiceAsync(db, store, () => backpressure);
  assert.ok(service instanceof ExecutionDispatchServiceAsync);
});

// ---------------------------------------------------------------------------
// ExecutionDispatchServiceAsync with queue availability snapshot
// ---------------------------------------------------------------------------

test("ExecutionDispatchServiceAsync accepts queue availability snapshot function", () => {
  const db = createMockDb();
  const store = createMockStore();
  const queueAvail = {
    state: "available" as const,
    reasonCode: null,
  };
  const service = new ExecutionDispatchServiceAsync(db, store, null, () => queueAvail);
  assert.ok(service instanceof ExecutionDispatchServiceAsync);
});

// ---------------------------------------------------------------------------
// Verify Promise resolution order is preserved
// ---------------------------------------------------------------------------

test("ExecutionDispatchServiceAsync returns Promise that resolves in correct order", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionDispatchServiceAsync(db, store);

  let resolved = false;
  const promise = service.dispatchNext({}).then(() => {
    resolved = true;
    return true;
  });

  assert.equal(resolved, false);
  await promise;
  assert.equal(resolved, true);
});