import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionLeaseServiceAsync } from "../../../../../src/platform/five-plane-execution/lease/execution-lease-service-async.js";
import type { LeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type {
  ExecutionLeaseRecord,
  LeaseAuditRecord,
} from "../../../../../src/platform/contracts/types/domain.js";

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    filePath: ":memory:",
    backendType: "sqlite",
    connection: {
      exec: () => {},
      prepare: () => ({ run: () => {}, get: () => undefined, all: () => [] }),
    },
    migrate: () => {},
    getSchemaStatus: () => ({
      currentVersion: 1,
      expectedVersion: 1,
      upToDate: true,
      pendingVersions: [],
      checksumMismatches: [],
    }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: async () => true,
    transaction<T>(work: () => T): T {
      return work();
    },
    readTransaction<T>(work: () => T): T {
      return work();
    },
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockStore(): AuthoritativeTaskStore {
  const leases = new Map<string, ExecutionLeaseRecord>();
  const activeLeases = new Map<string, ExecutionLeaseRecord>();
  const audits: LeaseAuditRecord[] = [];

  return {
    dispatch: {
      getExecution: (executionId: string) => {
        if (executionId !== "exec-001") {
          return undefined;
        }
        return {
          id: executionId,
          taskId: "task-001",
          status: "executing" as const,
          attempt: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
      },
    },
    worker: {
      insertExecutionLease(lease: ExecutionLeaseRecord): void {
        leases.set(lease.id, { ...lease });
        if (lease.status === "active") {
          activeLeases.set(lease.executionId, { ...lease });
        }
      },
      getExecutionLease(leaseId: string): ExecutionLeaseRecord | undefined {
        return leases.get(leaseId);
      },
      getActiveExecutionLease(executionId: string): ExecutionLeaseRecord | undefined {
        return activeLeases.get(executionId);
      },
      getLatestFencingToken(): number {
        return 0;
      },
      renewExecutionLease(leaseId: string, expiresAt: string, lastHeartbeatAt?: string): void {
        const lease = leases.get(leaseId);
        if (!lease) {
          return;
        }
        const updated = { ...lease, expiresAt, lastHeartbeatAt: lastHeartbeatAt ?? lease.lastHeartbeatAt };
        leases.set(leaseId, updated);
        if (updated.status === "active") {
          activeLeases.set(updated.executionId, updated);
        }
      },
      closeExecutionLease(input: {
        leaseId: string;
        status: ExecutionLeaseRecord["status"];
        releasedAt: string;
        reasonCode: string | null;
      }): void {
        const lease = leases.get(input.leaseId);
        if (!lease) {
          return;
        }
        const updated = {
          ...lease,
          status: input.status,
          releasedAt: input.releasedAt,
          reasonCode: input.reasonCode,
        };
        leases.set(input.leaseId, updated);
        if (input.status === "active") {
          activeLeases.set(updated.executionId, updated);
        } else {
          activeLeases.delete(updated.executionId);
        }
      },
      listExpiredExecutionLeases(): ExecutionLeaseRecord[] {
        return [];
      },
      insertLeaseAudit(audit: LeaseAuditRecord): void {
        audits.push(audit);
      },
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockRepo(): LeaseRepository {
  return {
    async insertLease(): Promise<void> {},
    async getLease(): Promise<ExecutionLeaseRecord | undefined> {
      return undefined;
    },
    async getActiveLeaseForExecution(): Promise<ExecutionLeaseRecord | undefined> {
      return undefined;
    },
    async getLatestFencingToken(): Promise<number> {
      return 0;
    },
    async listExecutionLeases(): Promise<ExecutionLeaseRecord[]> {
      return [];
    },
    async updateLeaseStatus(): Promise<void> {},
    async updateLeaseHeartbeat(): Promise<void> {},
    async updateLeaseRelease(): Promise<void> {},
    async insertLeaseAudit(): Promise<void> {},
    async listLeaseAudits(): Promise<LeaseAuditRecord[]> {
      return [];
    },
  };
}

function createService(): ExecutionLeaseServiceAsync {
  return new ExecutionLeaseServiceAsync(createMockDb(), createMockStore(), createMockRepo());
}

test("releaseLease blocks expired active leases instead of releasing them", async () => {
  const service = createService();
  const granted = await service.acquireLease({
    executionId: "exec-001",
    workerId: "worker-001",
    ttlMs: 5_000,
    occurredAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(granted.outcome, "granted");
  assert.ok(granted.lease);

  const released = await service.releaseLease({
    leaseId: granted.lease.id,
    workerId: "worker-001",
    occurredAt: "2026-01-01T00:00:06.000Z",
  });

  assert.equal(released.outcome, "blocked");
  assert.equal(released.reasonCode, "lease_expired");
  assert.equal(released.lease?.status, "active");
});

test("handoverLease blocks transfers from expired leases", async () => {
  const service = createService();
  const granted = await service.acquireLease({
    executionId: "exec-001",
    workerId: "worker-001",
    ttlMs: 5_000,
    occurredAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(granted.outcome, "granted");
  assert.ok(granted.lease);

  const handover = await service.handoverLease({
    leaseId: granted.lease.id,
    workerId: "worker-001",
    newWorkerId: "worker-002",
    ttlMs: 5_000,
    occurredAt: "2026-01-01T00:00:06.000Z",
  });

  assert.equal(handover.outcome, "blocked");
  assert.equal(handover.reasonCode, "lease_expired");
  assert.equal(handover.previousLease?.id, granted.lease.id);
  assert.equal(handover.lease, null);
});
