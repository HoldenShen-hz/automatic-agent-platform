import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionLeaseService } from "../../../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../../../../src/platform/contracts/types/domain.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";
import { StorageError } from "../../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Mock Store Factory
// ---------------------------------------------------------------------------

interface MockStoreState {
  leases: Map<string, ExecutionLeaseRecord>;
  activeLeaseByExecution: Map<string, ExecutionLeaseRecord>;
  latestLeaseByExecution: Map<string, ExecutionLeaseRecord>;
  audits: LeaseAuditRecord[];
  executions: Map<string, { id: string; attempt: number; taskId: string; traceId: string }>;
  workers: Map<string, { runningExecutionsJson: string; maxConcurrency: number }>;
  agentExecutionRecords: Map<string, { agentId: string }>;
}

function createMockStore(state: MockStoreState = {
  leases: new Map(),
  activeLeaseByExecution: new Map(),
  latestLeaseByExecution: new Map(),
  audits: [],
  executions: new Map(),
  workers: new Map(),
  agentExecutionRecords: new Map(),
}): AuthoritativeTaskStore {
  return {
    worker: {
      getExecutionLease(leaseId: string): ExecutionLeaseRecord | undefined {
        return state.leases.get(leaseId);
      },
      getActiveExecutionLease(executionId: string): ExecutionLeaseRecord | undefined {
        return state.activeLeaseByExecution.get(executionId);
      },
      getLatestExecutionLease(executionId: string): ExecutionLeaseRecord | undefined {
        return state.latestLeaseByExecution.get(executionId);
      },
      getLatestFencingToken(executionId: string): number {
        const lease = state.latestLeaseByExecution.get(executionId);
        return lease?.fencingToken ?? 0;
      },
      listExpiredExecutionLeases(_now: string): ExecutionLeaseRecord[] {
        const now = new Date();
        return Array.from(state.leases.values()).filter(
          (l) => l.status === "active" && new Date(l.expiresAt) < now,
        );
      },
      insertExecutionLease(lease: ExecutionLeaseRecord): void {
        state.leases.set(lease.id, lease);
        state.latestLeaseByExecution.set(lease.executionId, lease);
        if (lease.status === "active") {
          state.activeLeaseByExecution.set(lease.executionId, lease);
        }
      },
      closeExecutionLease(input: {
        leaseId: string;
        status: ExecutionLeaseRecord["status"];
        releasedAt: string;
        reasonCode: string | null;
      }): void {
        const lease = state.leases.get(input.leaseId);
        if (lease) {
          const updated = { ...lease, status: input.status, releasedAt: input.releasedAt, reasonCode: input.reasonCode };
          state.leases.set(input.leaseId, updated);
          if (input.status !== "active") {
            state.activeLeaseByExecution.delete(lease.executionId);
          }
        }
      },
      renewExecutionLease(leaseId: string, _expiresAt: string, _lastHeartbeatAt: string): void {
        const lease = state.leases.get(leaseId);
        if (lease) {
          const updated = { ...lease, lastHeartbeatAt: _lastHeartbeatAt };
          state.leases.set(leaseId, updated);
        }
      },
      insertLeaseAudit(audit: LeaseAuditRecord): void {
        state.audits.push(audit);
      },
      getWorkerSnapshot(_workerId: string) {
        return state.workers.get(_workerId) as any;
      },
      upsertWorkerSnapshot(_snapshot: any): void {
        // Mock implementation - just store it
      },
      getAgentExecutionRecord(executionId: string) {
        return state.agentExecutionRecords.get(executionId);
      },
      upsertAgentExecutionRecord(_record: any): void {},
    } as any,
    dispatch: {
      getExecution(executionId: string) {
        return state.executions.get(executionId);
      },
    } as any,
    execution: {
      updateExecutionAgent(_executionId: string, _agentId: string, _occurredAt: string): void {},
    } as any,
    event: {
      insertEvent(_event: any): void {},
    } as any,
  } as any;
}

function createMockDb(transactionFn: <T>(work: () => T) => T): AuthoritativeSqlDatabase {
  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: { exec: () => {}, prepare: () => ({ run: () => {} }) },
    migrate: () => {},
    getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0 } as any),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: () => Promise.resolve(true),
    transaction: transactionFn,
    readTransaction: <T>(work: () => T) => work(),
  } as any;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createLease(overrides: Partial<ExecutionLeaseRecord> = {}): ExecutionLeaseRecord {
  const now = nowIso();
  return {
    id: newId("lease"),
    executionId: "exec-1",
    workerId: "worker-1",
    attempt: 1,
    fencingToken: 1,
    queueName: null,
    status: "active",
    leasedAt: now,
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
    lastHeartbeatAt: now,
    releasedAt: null,
    reasonCode: null,
    ...overrides,
  };
}

function createExecution(id: string = "exec-1", attempt: number = 1): { id: string; attempt: number; taskId: string; traceId: string } {
  return {
    id,
    attempt,
    taskId: "task-1",
    traceId: "trace-1",
  };
}

// ---------------------------------------------------------------------------
// Tests: Constructor
// ---------------------------------------------------------------------------

test("ExecutionLeaseService constructor creates instance", () => {
  const store = createMockStore();
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);
  assert.ok(service != null);
});

// ---------------------------------------------------------------------------
// Tests: acquireLease
// ---------------------------------------------------------------------------

test("acquireLease grants lease when no active lease exists", () => {
  const state: MockStoreState = {
    leases: new Map(),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map(),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "granted");
  assert.ok(result.lease != null);
  assert.equal(result.lease!.workerId, "worker-1");
  assert.equal(result.lease!.executionId, "exec-1");
  assert.equal(result.lease!.status, "active");
});

test("acquireLease blocks when active lease already exists", () => {
  const existingLease = createLease({ id: "lease-existing", executionId: "exec-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "active_lease_exists");
  assert.ok(result.lease != null);
  assert.equal(result.lease!.id, "lease-existing");
});

test("acquireLease throws when execution not found", () => {
  const state: MockStoreState = {
    leases: new Map(),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map(),
    audits: [],
    executions: new Map(),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  assert.throws(
    () => service.acquireLease({ executionId: "nonexistent", workerId: "worker-1", ttlMs: 10_000 }),
    (err: any) => err.code === "storage.execution_not_found",
  );
});

test("acquireLease grants lease with fencing token 1 when no previous lease exists", () => {
  const state: MockStoreState = {
    leases: new Map(),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map(),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "granted");
  assert.equal(result.lease!.fencingToken, 1); // first lease has token 1
});

test("acquireLease creates audit record", () => {
  const state: MockStoreState = {
    leases: new Map(),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map(),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "lease_granted");
});

// ---------------------------------------------------------------------------
// Tests: renewLease
// ---------------------------------------------------------------------------

test("renewLease renews lease when valid", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "renewed");
  assert.ok(result.lease != null);
});

test("renewLease blocks when lease not found", () => {
  const state: MockStoreState = {
    leases: new Map(),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map(),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.renewLease({
    leaseId: "nonexistent",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_found");
});

test("renewLease blocks when worker mismatch", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-2", // different worker
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("renewLease blocks when lease not active", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", status: "released" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_active");
});

test("renewLease blocks when lease expired", () => {
  const expiredTime = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
  const existingLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: expiredTime,
  });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_expired");
});

test("renewLease creates audit record", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "lease_renewed");
});

// ---------------------------------------------------------------------------
// Tests: releaseLease
// ---------------------------------------------------------------------------

test("releaseLease releases lease when valid", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-1",
  });

  assert.equal(result.outcome, "released");
});

test("releaseLease blocks when lease not found", () => {
  const state: MockStoreState = {
    leases: new Map(),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map(),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.releaseLease({
    leaseId: "nonexistent",
    workerId: "worker-1",
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_found");
});

test("releaseLease blocks when worker mismatch", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-2",
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("releaseLease blocks when lease not active", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", status: "released" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-1",
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_active");
});

test("releaseLease creates audit record", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    reasonCode: "work_complete",
  });

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "lease_released");
  assert.equal(state.audits[0]!.reasonCode, "work_complete");
});

// ---------------------------------------------------------------------------
// Tests: validateWriteAccess
// ---------------------------------------------------------------------------

test("validateWriteAccess allows access with valid lease", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", fencingToken: 5 });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 5,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.authoritativeFencingToken, 5);
});

test("validateWriteAccess denies when no active lease", () => {
  const state: MockStoreState = {
    leases: new Map(),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map(),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 1,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "lease_not_found");
});

test("validateWriteAccess denies when fencing token mismatch", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", fencingToken: 5 });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 3, // stale token
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "stale_fencing_token");
  assert.equal(result.authoritativeFencingToken, 5);
});

test("validateWriteAccess denies when worker mismatch", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", fencingToken: 5 });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-2", // different worker
    fencingToken: 5,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("validateWriteAccess creates audit on stale write", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", fencingToken: 5 });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 3, // stale
  });

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "stale_write_rejected");
});

// ---------------------------------------------------------------------------
// Tests: reclaimExpiredLeases
// ---------------------------------------------------------------------------

test("reclaimExpiredLeases returns empty when no expired leases", () => {
  const existingLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: new Date(Date.now() + 10_000).toISOString(), // not expired
  });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.reclaimExpiredLeases();

  assert.equal(result.length, 0);
});

test("reclaimExpiredLeases reclaims expired leases", () => {
  const expiredLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: new Date(Date.now() - 5000).toISOString(), // expired 5 seconds ago
  });
  const state: MockStoreState = {
    leases: new Map([[expiredLease.id, expiredLease]]),
    activeLeaseByExecution: new Map([[expiredLease.executionId, expiredLease]]),
    latestLeaseByExecution: new Map([[expiredLease.executionId, expiredLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.reclaimExpiredLeases();

  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "lease-1");
});

test("reclaimExpiredLeases creates audit records", () => {
  const expiredLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: new Date(Date.now() - 5000).toISOString(),
  });
  const state: MockStoreState = {
    leases: new Map([[expiredLease.id, expiredLease]]),
    activeLeaseByExecution: new Map([[expiredLease.executionId, expiredLease]]),
    latestLeaseByExecution: new Map([[expiredLease.executionId, expiredLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  service.reclaimExpiredLeases();

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "lease_reclaimed");
});

// ---------------------------------------------------------------------------
// Tests: handoverLease
// ---------------------------------------------------------------------------

test("handoverLease hands over lease when valid", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const prevWorker: any = {
    workerId: "worker-1",
    runningExecutionsJson: "[\"exec-1\"]",
    capabilitiesJson: "[]",
    maxConcurrency: 10,
  };
  const nextWorker: any = {
    workerId: "worker-2",
    runningExecutionsJson: "[]",
    capabilitiesJson: "[]",
    maxConcurrency: 10,
  };
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map([["worker-1", prevWorker], ["worker-2", nextWorker]]),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "handed_over");
  assert.ok(result.lease != null);
  assert.equal(result.lease!.workerId, "worker-2");
  assert.equal(result.lease!.fencingToken, 2); // incremented from 1
});

test("handoverLease blocks when lease not found", () => {
  const state: MockStoreState = {
    leases: new Map(),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map(),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "nonexistent",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_found");
});

test("handoverLease blocks when worker mismatch", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-2", // wrong worker
    newWorkerId: "worker-3",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("handoverLease blocks when lease not active", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", status: "released" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_active");
});

test("handoverLease blocks when lease expired", () => {
  const expiredLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: new Date(Date.now() - 5000).toISOString(),
  });
  const state: MockStoreState = {
    leases: new Map([[expiredLease.id, expiredLease]]),
    activeLeaseByExecution: new Map([[expiredLease.executionId, expiredLease]]),
    latestLeaseByExecution: new Map([[expiredLease.executionId, expiredLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_expired");
});

test("handoverLease blocks when handover to same worker", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-1", // same worker
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "handover_same_worker");
});

test("handoverLease blocks when new worker not registered", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(), // worker-2 not registered
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "worker_not_registered");
});

test("handoverLease blocks when worker capacity full", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const nextWorker: any = {
    workerId: "worker-2",
    runningExecutionsJson: "[]",
    maxConcurrency: 0, // capacity full
  };
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map([["worker-2", nextWorker]]),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "worker_capacity_full");
});

test("handoverLease allows when worker already running this execution", () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1" });
  const prevWorker: any = {
    workerId: "worker-1",
    runningExecutionsJson: "[\"exec-1\"]",
    capabilitiesJson: "[]",
    maxConcurrency: 10,
  };
  const nextWorker: any = {
    workerId: "worker-2",
    runningExecutionsJson: "[\"exec-1\"]", // already running exec-1
    capabilitiesJson: "[]",
    maxConcurrency: 1,
  };
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map([["worker-1", prevWorker], ["worker-2", nextWorker]]),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseService(db, store);

  const result = service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "handed_over");
});
