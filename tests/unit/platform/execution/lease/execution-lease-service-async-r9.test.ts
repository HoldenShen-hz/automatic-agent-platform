import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionLeaseServiceAsync } from "../../../../../src/platform/execution/lease/execution-lease-service-async.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../../../../src/platform/contracts/types/domain.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";
import { MIN_LEASE_TTL_MS, MAX_LEASE_TTL_MS } from "../../../../../src/platform/execution/lease/types.js";

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
      listExpiredExecutionLeases(now: string): ExecutionLeaseRecord[] {
        const nowTime = new Date(now).getTime();
        return Array.from(state.leases.values()).filter(
          (l) => l.status === "active" && new Date(l.expiresAt).getTime() < nowTime,
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
      renewExecutionLease(leaseId: string, expiresAt: string, lastHeartbeatAt: string): void {
        const lease = state.leases.get(leaseId);
        if (lease) {
          const updated = { ...lease, expiresAt, lastHeartbeatAt };
          state.leases.set(leaseId, updated);
        }
      },
      insertLeaseAudit(audit: LeaseAuditRecord): void {
        state.audits.push(audit);
      },
      getWorkerSnapshot(_workerId: string) {
        return state.workers.get(_workerId) as any;
      },
      upsertWorkerSnapshot(_snapshot: any): void {},
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

function createMockRepo(state: MockStoreState) {
  return {
    worker: state.worker,
  };
}

// ---------------------------------------------------------------------------
// Tests: Lease TTL Bounds + Expiry Validation (R9-01 / R9-08)
// ---------------------------------------------------------------------------

test("acquireLease rejects TTL below MIN_LEASE_TTL_MS", async () => {
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
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: MIN_LEASE_TTL_MS - 1,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "ttl_out_of_bounds");
  assert.equal(result.lease, null);
});

test("acquireLease rejects TTL above MAX_LEASE_TTL_MS", async () => {
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
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: MAX_LEASE_TTL_MS + 1,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "ttl_out_of_bounds");
  assert.equal(result.lease, null);
});

test("acquireLease increments fencing token from previous lease for same execution", async () => {
  const previousLease = createLease({
    id: "lease-previous",
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 5,
  });

  const state: MockStoreState = {
    leases: new Map([["lease-previous", previousLease]]),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map([["exec-1", previousLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "granted");
  assert.equal(result.lease!.fencingToken, 6); // previous + 1
});

// ---------------------------------------------------------------------------
// Tests: Lease Expiry Validation (R9-01)
// ---------------------------------------------------------------------------

test("acquireLease expires existing lease that has already passed expiration", async () => {
  const expiredTime = new Date(Date.now() - 5000).toISOString();
  const expiredLease = createLease({
    id: "lease-expired",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: expiredTime,
  });

  const state: MockStoreState = {
    leases: new Map([["lease-expired", expiredLease]]),
    activeLeaseByExecution: new Map([["exec-1", expiredLease]]),
    latestLeaseByExecution: new Map([["exec-1", expiredLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "granted");
  assert.ok(result.lease != null);
  assert.equal(result.lease!.workerId, "worker-2");

  const closedLease = state.leases.get("lease-expired");
  assert.notEqual(closedLease!.status, "active");
});

test("acquireLease creates lease with correct expiresAt based on ttlMs", async () => {
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
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const beforeAcquire = Date.now();
  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: 15_000,
  });

  const afterAcquire = Date.now();
  assert.equal(result.outcome, "granted");
  assert.ok(result.lease != null);

  const expiresAtTime = new Date(result.lease!.expiresAt).getTime();
  assert.ok(expiresAtTime >= beforeAcquire + 15_000);
  assert.ok(expiresAtTime <= afterAcquire + 15_000 + 1000);
});

// ---------------------------------------------------------------------------
// Tests: Double-Release Prevention (R9-03)
// ---------------------------------------------------------------------------

test("releaseLease blocks when lease already released (double-release prevention)", async () => {
  const releasedLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    status: "released",
    releasedAt: new Date(Date.now() - 5000).toISOString(),
  });

  const state: MockStoreState = {
    leases: new Map([["lease-1", releasedLease]]),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map([["exec-1", releasedLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = await service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-1",
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_active");
});

test("releaseLease blocks when trying to release expired lease", async () => {
  const expiredLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    status: "expired",
    releasedAt: new Date(Date.now() - 1000).toISOString(),
  });

  const state: MockStoreState = {
    leases: new Map([["lease-1", expiredLease]]),
    activeLeaseByExecution: new Map(),
    latestLeaseByExecution: new Map([["exec-1", expiredLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = await service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-1",
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_active");
});

// ---------------------------------------------------------------------------
// Tests: Fencing Token + Lease Expiry Enforcement
// ---------------------------------------------------------------------------

test("validateWriteAccess denies when lease has expired even if other fields match", () => {
  const expiredTime = new Date(Date.now() - 5000).toISOString();
  const existingLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 42,
    expiresAt: expiredTime,
  });

  const state: MockStoreState = {
    leases: new Map([["lease-1", existingLease]]),
    activeLeaseByExecution: new Map([["exec-1", existingLease]]),
    latestLeaseByExecution: new Map([["exec-1", existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    leaseId: "lease-1",
    workerId: "worker-1",
    fencingToken: 42,
  });

  // Note: reasonCode is "lease_expired" but eventType is "stale_write_rejected"
  // because validateWriteAccess is rejecting a stale WRITE, not closing an expired lease
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "lease_expired");
  assert.ok(state.audits.some((audit) => audit.eventType === "stale_write_rejected"));
});

test("validateWriteAccess allows access when fence token matches and lease is active", () => {
  const existingLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 42,
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
  });

  const state: MockStoreState = {
    leases: new Map([["lease-1", existingLease]]),
    activeLeaseByExecution: new Map([["exec-1", existingLease]]),
    latestLeaseByExecution: new Map([["exec-1", existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    leaseId: "lease-1", // Must match active lease id
    workerId: "worker-1",
    fencingToken: 42,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.authoritativeFencingToken, 42);
  assert.equal(result.activeLeaseId, "lease-1");
});

// ---------------------------------------------------------------------------
// Tests: renewLease with expired lease
// ---------------------------------------------------------------------------

test("renewLease blocks when lease has expired", async () => {
  const expiredTime = new Date(Date.now() - 5000).toISOString();
  const existingLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: expiredTime,
  });

  const state: MockStoreState = {
    leases: new Map([["lease-1", existingLease]]),
    activeLeaseByExecution: new Map([["exec-1", existingLease]]),
    latestLeaseByExecution: new Map([["exec-1", existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map(),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const service = new ExecutionLeaseServiceAsync(db, store, {} as any);

  const result = await service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_expired");
});
