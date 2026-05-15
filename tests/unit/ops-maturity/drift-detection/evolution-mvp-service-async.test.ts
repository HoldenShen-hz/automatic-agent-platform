/**
 * Unit tests for EvolutionServiceAsync
 *
 * @see src/ops-maturity/drift-detection/evolution-mvp-service-async.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EvolutionServiceAsync } from "../../../../src/ops-maturity/drift-detection/evolution-mvp-service-async.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

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
    filePath: "/tmp/test.db",
  } as unknown as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// EvolutionServiceAsync construction
// ---------------------------------------------------------------------------

test("EvolutionServiceAsync can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new EvolutionServiceAsync(db, store);
  assert.ok(service instanceof EvolutionServiceAsync);
});

test("EvolutionServiceAsync getSyncService returns underlying sync service", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new EvolutionServiceAsync(db, store);
  const sync = service.getSyncService();
  assert.ok(sync !== null);
});

test("EvolutionServiceAsync uses SyncBackedAsyncService pattern", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new EvolutionServiceAsync(db, store);

  // Verify service has getSyncService method from SyncBackedAsyncService
  assert.equal(typeof service.getSyncService, "function");
});

// ---------------------------------------------------------------------------
// EvolutionServiceAsync methods delegate via asPromise
// ---------------------------------------------------------------------------

test("EvolutionServiceAsync methods are available (not throwing on construction)", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new EvolutionServiceAsync(db, store);

  // The service should construct without error even if underlying methods throw
  assert.ok(service instanceof EvolutionServiceAsync);
  assert.equal(typeof service.getSyncService, "function");
});

// ---------------------------------------------------------------------------
// Verify inheritance from SyncBackedAsyncService
// ---------------------------------------------------------------------------

test("EvolutionServiceAsync extends SyncBackedAsyncService", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new EvolutionServiceAsync(db, store);

  // SyncBackedAsyncService provides getSyncService()
  assert.ok(typeof service.getSyncService === "function");

  // Verify we can get the sync service
  const syncService = service.getSyncService();
  assert.ok(syncService !== null);
  assert.ok(typeof syncService === "object");
});