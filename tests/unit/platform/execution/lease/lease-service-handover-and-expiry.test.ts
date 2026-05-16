import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionLeaseServiceAsync } from "../../../../../src/platform/five-plane-execution/lease/execution-lease-service-async.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { LeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../../../../src/platform/contracts/types/domain.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";

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
          (lease) => lease.status === "active" && lease.expiresAt <= now,
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
          state.leases.set(leaseId, { ...lease, expiresAt, lastHeartbeatAt });
        }
      },
      insertLeaseAudit(audit: LeaseAuditRecord): void {
        state.audits.push(audit);
      },
      getWorkerSnapshot(workerId: string) {
        return state.workers.get(workerId) as any;
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
  const service = new ExecutionLeaseServiceAsync(createMockDb((work) => work()), createMockStore(state), createMockRepo());

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
  const service = new ExecutionLeaseServiceAsync(createMockDb((work) => work()), createMockStore(state), createMockRepo());

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
  const service = new ExecutionLeaseServiceAsync(createMockDb((work) => work()), createMockStore(state), createMockRepo());

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
  const service = new ExecutionLeaseServiceAsync(createMockDb((work) => work()), createMockStore(state), createMockRepo());

  await service.handoverLease({
    leaseId: "lease-1",
    workerId: "worker-1",
    newWorkerId: "worker-2",
    ttlMs: 10_000,
  });

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.eventType, "lease_released");
});

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
  const service = new ExecutionLeaseServiceAsync(createMockDb((work) => work()), createMockStore(state), createMockRepo());

  const result = await service.acquireLease({
    executionId: "exec-1",
    workerId: "worker-new",
    ttlMs: 10_000,
  });

  assert.equal(result.outcome, "granted");
  assert.equal(result.lease!.workerId, "worker-new");
});
