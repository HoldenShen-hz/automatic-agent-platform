import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionWorkerHandshakeServiceAsync } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-service-async.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerHandshakeDecision } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FAKE_DB = {
  transaction<T>(_fn: () => T): T {
    return _fn();
  },
} as unknown as AuthoritativeSqlDatabase;

const FAKE_STORE = {
  worker: {
    getExecutionTicket: () => null,
    getWorkerSnapshot: () => null,
    getExecutionLease: () => null,
    upsertWorkerSnapshot: () => {},
    insertHeartbeatSnapshot: () => {},
    upsertAgentExecutionRecord: () => {},
    consumeExecutionTicket: () => {},
    getAgentExecutionRecord: () => null,
  },
  dispatch: {
    getExecution: () => null,
    updateExecutionAgent: () => {},
    updateExecutionStatus: () => {},
  },
  execution: {
    updateExecutionAgent: () => {},
    updateExecutionStatus: () => {},
  },
  event: {
    insertEvent: () => {},
  },
  operations: {
    loadExecutionAuthoritativeView: () => null,
  },
} as unknown as AuthoritativeTaskStore;

function makeAsyncService(): ExecutionWorkerHandshakeServiceAsync {
  return new ExecutionWorkerHandshakeServiceAsync(FAKE_DB, FAKE_STORE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerHandshakeServiceAsync is instantiable", () => {
  const service = makeAsyncService();
  assert.ok(service != null);
});

test("ExecutionWorkerHandshakeServiceAsync.getSyncService returns underlying sync service", () => {
  const service = makeAsyncService();
  const sync = service.getSyncService();
  assert.ok(sync != null);
});

test("claimExecution returns a promise resolving to WorkerHandshakeDecision", async () => {
  const service = makeAsyncService();
  const decision = await service.claimExecution({
    ticketId: "ticket_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
  });
  // Without a real store, we get rejected decisions - but it should be a promise
  assert.ok(decision != null);
  assert.ok(typeof decision.accepted === "boolean");
});

test("recordHeartbeat returns a promise resolving to WorkerHandshakeDecision", async () => {
  const service = makeAsyncService();
  const decision = await service.recordHeartbeat({
    executionId: "exec_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    ttlMs: 5000,
  });
  assert.ok(decision != null);
  assert.ok(typeof decision.accepted === "boolean");
});

test("claimExecution promise resolves with execution_not_found when no ticket", async () => {
  const service = makeAsyncService();
  const decision = await service.claimExecution({
    ticketId: "nonexistent_ticket",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "ticket_not_found");
});

test("recordHeartbeat promise resolves with execution_not_found when no execution", async () => {
  const service = makeAsyncService();
  const decision = await service.recordHeartbeat({
    executionId: "nonexistent_exec",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    ttlMs: 5000,
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "execution_not_found");
});
