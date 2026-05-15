import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionWorkerWritebackServiceAsync } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service-async.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerWritebackDecision } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.js";

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
    getExecutionLease: () => null,
    getWorkerSnapshot: () => null,
    getAgentExecutionRecord: () => null,
    upsertWorkerSnapshot: () => {},
    insertHeartbeatSnapshot: () => {},
    upsertAgentExecutionRecord: () => {},
    closeExecutionLease: () => {},
    insertLeaseAudit: () => {},
  },
  dispatch: {
    getExecution: () => null,
  },
  event: {
    insertEvent: () => {},
  },
  operations: {
    loadExecutionAuthoritativeView: () => null,
  },
} as unknown as AuthoritativeTaskStore;

function makeAsyncWritebackService(): ExecutionWorkerWritebackServiceAsync {
  return new ExecutionWorkerWritebackServiceAsync(FAKE_DB, FAKE_STORE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ExecutionWorkerWritebackServiceAsync is instantiable", () => {
  const service = makeAsyncWritebackService();
  assert.ok(service != null);
});

test("recordWriteback returns a promise resolving to WorkerWritebackDecision", async () => {
  const service = makeAsyncWritebackService();
  const decision = await service.recordWriteback({
    executionId: "exec_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    terminalStatus: "done",
  });
  // Without a real store, we get rejected decisions - but it should be a promise
  assert.ok(decision != null);
  assert.ok(typeof decision.accepted === "boolean");
});

test("recordWriteback promise resolves with execution_not_found when no execution", async () => {
  const service = makeAsyncWritebackService();
  const decision = await service.recordWriteback({
    executionId: "nonexistent_exec",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    terminalStatus: "done",
  });
  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "execution_not_found");
});

test("recordWriteback accepts valid writeback input with required fields", async () => {
  const service = makeAsyncWritebackService();
  const decision = await service.recordWriteback({
    executionId: "exec_1",
    workerId: "worker_1",
    leaseId: "lease_1",
    fencingToken: 1,
    terminalStatus: "failed",
    reasonCode: "error_code",
    progressMessage: "task failed",
  });
  // With a fake store that returns null views, execution won't be found
  assert.equal(decision.accepted, false);
});

test("recordWriteback handles different terminal statuses", async () => {
  const service = makeAsyncWritebackService();

  const statuses = ["done", "failed", "cancelled"] as const;
  for (const status of statuses) {
    const decision = await service.recordWriteback({
      executionId: "exec_1",
      workerId: "worker_1",
      leaseId: "lease_1",
      fencingToken: 1,
      terminalStatus: status,
    });
    assert.equal(decision.accepted, false, `Should reject ${status} without real store`);
    assert.equal(decision.terminalStatus, status);
  }
});
