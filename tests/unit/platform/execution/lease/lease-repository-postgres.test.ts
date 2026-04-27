import assert from "node:assert/strict";
import test from "node:test";

import { PostgresLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository-postgres.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../../../../src/platform/contracts/types/domain.js";

// Mock async database
function createMockAsyncDb() {
  const leases: Map<string, ExecutionLeaseRecord> = new Map();
  const audits: LeaseAuditRecord[] = [];

  return {
    asyncConnection: {
      execute: async (sql: string, ...args: unknown[]) => {
        if (sql.includes("INSERT INTO execution_leases")) {
          const lease: ExecutionLeaseRecord = {
            id: args[0] as string,
            executionId: args[1] as string,
            workerId: args[2] as string,
            attempt: args[3] as number,
            fencingToken: args[4] as number,
            queueName: args[5] as string | null,
            status: args[6] as ExecutionLeaseRecord["status"],
            leasedAt: args[7] as string,
            expiresAt: args[8] as string,
            lastHeartbeatAt: args[9] as string,
            releasedAt: args[10] as string | null,
            reasonCode: args[11] as string | null,
          };
          leases.set(lease.id, lease);
          return { rowCount: 1 };
        }
        if (sql.includes("UPDATE execution_leases SET status")) {
          const status = args[0] as string;
          const leaseId = args[1] as string;
          const existing = leases.get(leaseId);
          if (existing) {
            leases.set(leaseId, { ...existing, status: status as ExecutionLeaseRecord["status"] });
          }
          return { rowCount: existing ? 1 : 0 };
        }
        if (sql.includes("UPDATE execution_leases SET last_heartbeat_at")) {
          const lastHeartbeatAt = args[0] as string;
          const leaseId = args[1] as string;
          const existing = leases.get(leaseId);
          if (existing) {
            leases.set(leaseId, { ...existing, lastHeartbeatAt });
          }
          return { rowCount: existing ? 1 : 0 };
        }
        if (sql.includes("UPDATE execution_leases SET status = 'released'")) {
          const releasedAt = args[0] as string;
          const reasonCode = args[1] as string | null;
          const leaseId = args[2] as string;
          const existing = leases.get(leaseId);
          if (existing) {
            leases.set(leaseId, { ...existing, status: "released", releasedAt, reasonCode });
          }
          return { rowCount: existing ? 1 : 0 };
        }
        if (sql.includes("INSERT INTO lease_audits")) {
          const audit: LeaseAuditRecord = {
            id: args[0] as string,
            executionId: args[1] as string,
            leaseId: args[2] as string,
            workerId: args[3] as string,
            fencingToken: args[4] as number,
            eventType: args[5] as string,
            reasonCode: args[6] as string | null,
            recordedAt: args[7] as string,
          };
          audits.push(audit);
          return { rowCount: 1 };
        }
        return { rowCount: 0 };
      },
      query: async <T>(sql: string, ...args: unknown[]): Promise<{ rows: T[] }> => {
        if (sql.includes("WHERE id = $1") && sql.includes("execution_leases")) {
          const leaseId = args[0] as string;
          const lease = leases.get(leaseId);
          return { rows: lease ? [lease as T] : [] };
        }
        if (sql.includes("WHERE execution_id = $1") && sql.includes("status = 'active'")) {
          const executionId = args[0] as string;
          const activeLease = Array.from(leases.values()).find(l => l.executionId === executionId && l.status === "active");
          return { rows: activeLease ? [activeLease as T] : [] };
        }
        if (sql.includes("WHERE execution_id = $1") && sql.includes("ORDER BY fencing_token")) {
          const executionId = args[0] as string;
          const execLeases = Array.from(leases.values())
            .filter(l => l.executionId === executionId)
            .sort((a, b) => a.fencingToken - b.fencingToken);
          return { rows: execLeases as T[] };
        }
        if (sql.includes("MAX(fencing_token)")) {
          const executionId = args[0] as string;
          const execLeases = Array.from(leases.values()).filter(l => l.executionId === executionId);
          const maxToken = execLeases.length > 0 ? Math.max(...execLeases.map(l => l.fencingToken)) : 0;
          return { rows: [{ maxFencingToken: maxToken }] as T[] };
        }
        if (sql.includes("FROM lease_audits WHERE execution_id")) {
          const executionId = args[0] as string;
          const execAudits = audits.filter(a => a.executionId === executionId);
          return { rows: execAudits as T[] };
        }
        return { rows: [] };
      },
    },
  };
}

function createTestLease(overrides: Partial<ExecutionLeaseRecord> = {}): ExecutionLeaseRecord {
  return {
    id: overrides.id ?? "lease-1",
    executionId: overrides.executionId ?? "exec-1",
    workerId: overrides.workerId ?? "worker-1",
    attempt: overrides.attempt ?? 1,
    fencingToken: overrides.fencingToken ?? 1,
    queueName: overrides.queueName ?? null,
    status: overrides.status ?? "active",
    leasedAt: overrides.leasedAt ?? new Date().toISOString(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60000).toISOString(),
    lastHeartbeatAt: overrides.lastHeartbeatAt ?? new Date().toISOString(),
    releasedAt: overrides.releasedAt ?? null,
    reasonCode: overrides.reasonCode ?? null,
  };
}

test("PostgresLeaseRepository implements LeaseRepository interface", () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb);

  assert.equal(typeof repo.insertLease, "function");
  assert.equal(typeof repo.getLease, "function");
  assert.equal(typeof repo.getActiveLeaseForExecution, "function");
  assert.equal(typeof repo.updateLeaseStatus, "function");
  assert.equal(typeof repo.insertLeaseAudit, "function");
});

test("PostgresLeaseRepository.insertLease and getLease work", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const lease = createTestLease({ id: "test-lease-1", executionId: "exec-1" });
  await repo.insertLease(lease);

  const retrieved = await repo.getLease("test-lease-1");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.id, "test-lease-1");
  assert.equal(retrieved?.executionId, "exec-1");
});

test("PostgresLeaseRepository.getLease returns undefined for non-existent", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const result = await repo.getLease("non-existent");
  assert.equal(result, undefined);
});

test("PostgresLeaseRepository.getActiveLeaseForExecution returns active lease", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const lease = createTestLease({ id: "active-lease", executionId: "exec-active", status: "active" });
  await repo.insertLease(lease);

  const retrieved = await repo.getActiveLeaseForExecution("exec-active");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.id, "active-lease");
  assert.equal(retrieved?.status, "active");
});

test("PostgresLeaseRepository.getActiveLeaseForExecution returns undefined when no active lease", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const lease = createTestLease({ id: "released-lease", executionId: "exec-released", status: "released" });
  await repo.insertLease(lease);

  const result = await repo.getActiveLeaseForExecution("exec-released");
  assert.equal(result, undefined);
});

test("PostgresLeaseRepository.listExecutionLeases returns all leases for execution", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const lease1 = createTestLease({ id: "lease-f1", executionId: "exec-list", fencingToken: 1 });
  const lease2 = createTestLease({ id: "lease-f2", executionId: "exec-list", fencingToken: 2 });
  await repo.insertLease(lease1);
  await repo.insertLease(lease2);

  const leases = await repo.listExecutionLeases("exec-list");
  assert.equal(leases.length, 2);
  assert.equal(leases[0].fencingToken, 1);
  assert.equal(leases[1].fencingToken, 2);
});

test("PostgresLeaseRepository.updateLeaseStatus changes status", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const lease = createTestLease({ id: "status-test-lease" });
  await repo.insertLease(lease);

  await repo.updateLeaseStatus("status-test-lease", "released");

  const retrieved = await repo.getLease("status-test-lease");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.status, "released");
});

test("PostgresLeaseRepository.updateLeaseHeartbeat updates timestamp", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const lease = createTestLease({ id: "heartbeat-test-lease" });
  await repo.insertLease(lease);

  const newHeartbeat = new Date().toISOString();
  await repo.updateLeaseHeartbeat("heartbeat-test-lease", newHeartbeat);

  const retrieved = await repo.getLease("heartbeat-test-lease");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.lastHeartbeatAt, newHeartbeat);
});

test("PostgresLeaseRepository.updateLeaseRelease marks lease as released", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const lease = createTestLease({ id: "release-test-lease" });
  await repo.insertLease(lease);

  const releasedAt = new Date().toISOString();
  await repo.updateLeaseRelease("release-test-lease", releasedAt, "completed");

  const retrieved = await repo.getLease("release-test-lease");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.status, "released");
  assert.equal(retrieved?.releasedAt, releasedAt);
  assert.equal(retrieved?.reasonCode, "completed");
});

test("PostgresLeaseRepository.insertLeaseAudit and listLeaseAudits work", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const audit: LeaseAuditRecord = {
    id: "audit-1",
    executionId: "exec-audit",
    leaseId: "lease-audit",
    workerId: "worker-audit",
    fencingToken: 1,
    eventType: "lease_created",
    reasonCode: null,
    recordedAt: new Date().toISOString(),
  };

  await repo.insertLeaseAudit(audit);

  const audits = await repo.listLeaseAudits("exec-audit");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].id, "audit-1");
  assert.equal(audits[0].eventType, "lease_created");
});

test("PostgresLeaseRepository.getLatestFencingToken returns max token", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const lease1 = createTestLease({ id: "token-lease-1", executionId: "exec-token", fencingToken: 5 });
  const lease2 = createTestLease({ id: "token-lease-2", executionId: "exec-token", fencingToken: 10 });
  await repo.insertLease(lease1);
  await repo.insertLease(lease2);

  const maxToken = await repo.getLatestFencingToken("exec-token");
  assert.equal(maxToken, 10);
});

test("PostgresLeaseRepository.getLatestFencingToken returns 0 when no leases", async () => {
  const mockDb = createMockAsyncDb() as any;
  const repo = new PostgresLeaseRepository(mockDb) as any;

  const maxToken = await repo.getLatestFencingToken("non-existent-exec");
  assert.equal(maxToken, 0);
});