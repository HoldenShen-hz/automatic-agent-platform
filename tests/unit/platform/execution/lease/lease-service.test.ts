import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionLeaseServiceAsync } from "../../../../../src/platform/five-plane-execution/lease/execution-lease-service-async.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { LeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../../../../src/platform/contracts/types/domain.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Mock Store Factory
// ---------------------------------------------------------------------------

interface MockStoreState {
  leases: Map<string, ExecutionLeaseRecord>;
  activeLeaseByExecution: Map<string, ExecutionLeaseRecord>;
  latestLeaseByExecution: Map<string, ExecutionLeaseRecord>;
  audits: LeaseAuditRecord[];
  executions: Map<string, { id: string; attempt: number; taskId: string; traceId: string }>;
  workers: Map<string, { runningExecutionsJson: string; maxConcurrency: number; capabilitiesJson: string }>;
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
        return Array.from(state.leases.values()).filter(
          (l) => l.status === "active" && l.expiresAt <= now,
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
      insertLeaseAudit(audit: any): void {
        state.audits.push(audit as LeaseAuditRecord);
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

function createMockRepo(): LeaseRepository {
  return {
    async insertLease(_lease: ExecutionLeaseRecord): Promise<void> {},
    async getLease(_leaseId: string): Promise<ExecutionLeaseRecord | undefined> { return undefined; },
    async getActiveLeaseForExecution(_executionId: string): Promise<ExecutionLeaseRecord | undefined> { return undefined; },
    async getLatestFencingToken(_executionId: string): Promise<number> { return 0; },
    async listExecutionLeases(_executionId: string): Promise<ExecutionLeaseRecord[]> { return []; },
    async updateLeaseStatus(_leaseId: string, _status: ExecutionLeaseRecord["status"]): Promise<void> {},
    async updateLeaseHeartbeat(_leaseId: string, _lastHeartbeatAt: string): Promise<void> {},
    async updateLeaseRelease(_leaseId: string, _releasedAt: string, _reasonCode: string | null): Promise<void> {},
    async insertLeaseAudit(_audit: LeaseAuditRecord): Promise<void> {},
    async listLeaseAudits(_executionId: string): Promise<LeaseAuditRecord[]> { return []; },
  };
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

test("ExecutionLeaseServiceAsync constructor creates instance", () => {
  const store = createMockStore();
  const db = createMockDb((work) => work());
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);
  assert.ok(service != null);
});

test("ExecutionLeaseServiceAsync has all required methods", () => {
  const store = createMockStore();
  const db = createMockDb((work) => work());
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);
  assert.equal(typeof service.acquireLease, "function");
  assert.equal(typeof service.renewLease, "function");
  assert.equal(typeof service.releaseLease, "function");
  assert.equal(typeof service.validateWriteAccess, "function");
  assert.equal(typeof service.reclaimExpiredLeases, "function");
  assert.equal(typeof service.handoverLease, "function");
});

// ---------------------------------------------------------------------------
// Tests: acquireLease
// ---------------------------------------------------------------------------

test("acquireLease grants lease when no active lease exists", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.acquireLease({
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

test("acquireLease blocks when active lease already exists", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "active_lease_exists");
  assert.ok(result.lease != null);
  assert.equal(result.lease!.id, "lease-existing");
});

test("acquireLease throws when execution not found", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  await assert.rejects(
    async () => service.acquireLease({ executionId: "nonexistent", workerId: "worker-1", ttlMs: 10_000 }),
    (err: any) => err.code === "storage.execution_not_found",
  );
});

test("acquireLease increments fencing token", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "granted");
  assert.equal(result.lease!.fencingToken, 1);
});

test("acquireLease creates audit record", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "lease_granted");
});

test("acquireLease with queueName sets queue on lease", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-1",
    ttlMs: 10_000,
    queueName: "priority-queue",
  });

  assert.equal(result.outcome, "granted");
  assert.equal(result.lease!.queueName, "priority-queue");
});

// ---------------------------------------------------------------------------
// Tests: renewLease
// ---------------------------------------------------------------------------

test("renewLease renews lease when valid", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "renewed");
  assert.ok(result.lease != null);
});

test("renewLease blocks when lease not found", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.renewLease({
    leaseId: "nonexistent",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_found");
});

test("renewLease blocks when worker mismatch", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("renewLease blocks when lease not active", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_active");
});

test("renewLease blocks when lease expired", async () => {
  const expiredTime = new Date(Date.now() - 5000).toISOString();
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.renewLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_expired");
});

test("renewLease creates audit record", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  await service.renewLease({
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

test("releaseLease releases lease when valid", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-1",
  });

  assert.equal(result.outcome, "released");
});

test("releaseLease blocks when lease not found", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.releaseLease({
    leaseId: "nonexistent",
    workerId: "worker-1",
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_found");
});

test("releaseLease blocks when worker mismatch", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-2",
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("releaseLease blocks when lease is not active", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.releaseLease({
    leaseId: "lease-1",
    workerId: "worker-1",
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_active");
});

test("releaseLease creates audit record with reasonCode", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  await service.releaseLease({
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 5,
    leaseId: "lease-1",
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 1,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "no_active_lease");
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 3,
    leaseId: "lease-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "stale_fencing_token");
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-2",
    fencingToken: 5,
    leaseId: "lease-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("validateWriteAccess denies when leaseId mismatch", () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = service.validateWriteAccess({
    executionId: "exec-1",
    workerId: "worker-1",
    fencingToken: 5,
    leaseId: "wrong-lease-id",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "lease_mismatch");
});

// ---------------------------------------------------------------------------
// Tests: reclaimExpiredLeases
// ---------------------------------------------------------------------------

test("reclaimExpiredLeases returns empty when no expired leases", () => {
  const existingLease = createLease({
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: new Date(Date.now() + 10_000).toISOString(),
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const now = nowIso();
  const result = service.reclaimExpiredLeases(now);

  assert.equal(result.length, 0);
});

test("reclaimExpiredLeases reclaims expired leases", () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const now = nowIso();
  const result = service.reclaimExpiredLeases(now);

  assert.equal(result.length, 1);
  assert.equal(result[0], "lease-1");
});

test("reclaimExpiredLeases creates audit records for reclaimed leases", () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  service.reclaimExpiredLeases(nowIso());

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "lease_reclaimed");
});

// ---------------------------------------------------------------------------
// Tests: handoverLease
// ---------------------------------------------------------------------------

test("handoverLease hands over lease when valid", async () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", fencingToken: 1 });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map([["worker-2", { runningExecutionsJson: "[]", maxConcurrency: 10, capabilitiesJson: "[]" }]]),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "handed_over");
  assert.ok(result.lease != null);
  assert.equal(result.lease!.workerId, "worker-2");
  assert.equal(result.lease!.fencingToken, 2);
});

test("handoverLease blocks when lease not found", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.handoverLease({
    leaseId: "nonexistent",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "lease_not_found");
});

test("handoverLease blocks when worker mismatch", async () => {
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-2",
    newWorkerId: "worker-3",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.reasonCode, "worker_mismatch");
});

test("handoverLease creates audit records for release and granted", async () => {
  const existingLease = createLease({ id: "lease-1", executionId: "exec-1", workerId: "worker-1", fencingToken: 1 });
  const state: MockStoreState = {
    leases: new Map([[existingLease.id, existingLease]]),
    activeLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    latestLeaseByExecution: new Map([[existingLease.executionId, existingLease]]),
    audits: [],
    executions: new Map([["exec-1", createExecution()]]),
    workers: new Map([["worker-2", { runningExecutionsJson: "[]", maxConcurrency: 10, capabilitiesJson: "[]" }]]),
    agentExecutionRecords: new Map(),
  };
  const store = createMockStore(state);
  const db = createMockDb((work) => work());
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  await service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "lease_released");
});

// ---------------------------------------------------------------------------
// Tests: expireActiveLeaseIfNeeded (via acquireLease)
// ---------------------------------------------------------------------------

test("acquireLease expires active lease that has passed expiration time", async () => {
  const expiredLease = createLease({
    id: "lease-old",
    executionId: "exec-1",
    workerId: "worker-old",
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
  const repo = createMockRepo();
  const service = new ExecutionLeaseServiceAsync(db, store, repo);

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-new",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "granted");
  assert.equal(result.lease!.workerId, "worker-new");
});
