import assert from "node:assert/strict";
import test from "node:test";

import { createLeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository.js";
import type { LeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../../../../src/platform/contracts/types/domain.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Mock SQLite Connection with stateful storage
// ---------------------------------------------------------------------------

interface MockDbState {
  leases: Map<string, ExecutionLeaseRecord>;
  audits: LeaseAuditRecord[];
  insertResponses: Map<string, any>;
}

function createMockSqliteConnection(state: MockDbState): any {
  const columnNames = [
    "id", "execution_id", "worker_id", "attempt", "fencing_token", "queue_name", "status",
    "leased_at", "expires_at", "last_heartbeat_at", "released_at", "reason_code"
  ];
  const auditColumnNames = [
    "id", "execution_id", "lease_id", "worker_id", "fencing_token", "event_type", "reason_code", "recorded_at"
  ];

  return {
    prepare: (sql: string) => {
      const isInsert = sql.trim().toLowerCase().startsWith("insert");
      const isSelect = sql.trim().toLowerCase().startsWith("select");
      const isUpdate = sql.trim().toLowerCase().startsWith("update");

      if (isInsert) {
        return {
          run: (...params: any[]) => {
            if (sql.includes("execution_leases")) {
              // Parse INSERT INTO execution_leases (...)
              const lease: ExecutionLeaseRecord = {
                id: params[0],
                executionId: params[1],
                workerId: params[2],
                attempt: params[3],
                fencingToken: params[4],
                queueName: params[5],
                status: params[6],
                leasedAt: params[7],
                expiresAt: params[8],
                lastHeartbeatAt: params[9],
                releasedAt: params[10],
                reasonCode: params[11],
              };
              state.leases.set(lease.id, lease);
            } else if (sql.includes("lease_audits")) {
              const audit: LeaseAuditRecord = {
                id: params[0],
                executionId: params[1],
                leaseId: params[2],
                workerId: params[3],
                fencingToken: params[4],
                eventType: params[5],
                reasonCode: params[6],
                recordedAt: params[7],
              };
              state.audits.push(audit);
            }
          },
        };
      }

      if (isSelect) {
        const hasWhereExecutionId = /where\s+execution_id\s*=/i.test(sql);
        if (sql.includes("execution_leases")) {
          if (sql.includes("MAX(fencing_token)")) {
            return {
              get: (execId: string) => {
                const leases = Array.from(state.leases.values()).filter(l => l.executionId === execId);
                const maxToken = leases.reduce((max, l) => Math.max(max, l.fencingToken), 0);
                return { maxFencingToken: maxToken };
              },
            };
          }
          return {
            get: (id: string) => {
              if (hasWhereExecutionId) {
                // getActiveLeaseForExecution - uses execution_id in WHERE
                return Array.from(state.leases.values()).find(l => l.executionId === id && l.status === "active") || undefined;
              }
              // getLease - uses id in WHERE
              return state.leases.get(id) || undefined;
            },
            all: (execId: string) => {
              return Array.from(state.leases.values()).filter(l => l.executionId === execId)
                .sort((a, b) => a.fencingToken - b.fencingToken);
            },
          };
        }
        if (sql.includes("lease_audits")) {
          return {
            all: (execId: string) => {
              return state.audits.filter(a => a.executionId === execId)
                .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
            },
          };
        }
      }

      if (isUpdate) {
        return {
          run: (...params: any[]) => {
            // Check for specific column updates before general "status" check
            if (sql.includes("last_heartbeat_at")) {
              // updateLeaseHeartbeat: SET last_heartbeat_at = ? WHERE id = ?
              const id = params[1];
              const lastHeartbeatAt = params[0];
              const lease = state.leases.get(id);
              if (lease) {
                state.leases.set(id, { ...lease, lastHeartbeatAt });
              }
            } else if (sql.includes("released_at")) {
              // updateLeaseRelease: SET status = 'released', released_at = ?, reason_code = ? WHERE id = ?
              const leaseId = params[2];
              const releasedAt = params[0];
              const reasonCode = params[1];
              const lease = state.leases.get(leaseId);
              if (lease) {
                state.leases.set(leaseId, { ...lease, releasedAt, reasonCode, status: "released" as const });
              }
            } else if (sql.includes("status")) {
              // updateLeaseStatus: SET status = ? WHERE id = ?
              const id = params[1];
              const status = params[0];
              const lease = state.leases.get(id);
              if (lease) {
                state.leases.set(id, { ...lease, status });
              }
            }
          },
        };
      }

      return { run: () => {}, get: () => null, all: () => [] };
    },
  };
}

function createMockSqliteDb(state: MockDbState = { leases: new Map(), audits: [], insertResponses: new Map() }): any {
  return {
    filePath: ":memory:",
    backendType: "sqlite" as const,
    connection: createMockSqliteConnection(state),
    migrate: () => {},
    getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0 }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: () => Promise.resolve(true),
    transaction: <T>(work: () => T) => work(),
    readTransaction: <T>(work: () => T) => work(),
    _state: state,
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

// ---------------------------------------------------------------------------
// Tests: LeaseRepository Interface
// ---------------------------------------------------------------------------

test("createLeaseRepository returns a repository with all required methods", () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = {
    driver: "sqlite" as const,
    sql: db,
  };

  const repo = createLeaseRepository(backend as any);

  assert.equal(typeof repo.insertLease, "function");
  assert.equal(typeof repo.getLease, "function");
  assert.equal(typeof repo.getActiveLeaseForExecution, "function");
  assert.equal(typeof repo.getLatestFencingToken, "function");
  assert.equal(typeof repo.listExecutionLeases, "function");
  assert.equal(typeof repo.updateLeaseStatus, "function");
  assert.equal(typeof repo.updateLeaseHeartbeat, "function");
  assert.equal(typeof repo.updateLeaseRelease, "function");
  assert.equal(typeof repo.insertLeaseAudit, "function");
  assert.equal(typeof repo.listLeaseAudits, "function");
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.insertLease
// ---------------------------------------------------------------------------

test("insertLease stores a lease record", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const lease = createLease({ id: "lease-test-1" });
  await repo.insertLease(lease);

  const retrieved = await repo.getLease("lease-test-1");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.id, "lease-test-1");
  assert.equal(retrieved!.executionId, "exec-1");
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.getLease
// ---------------------------------------------------------------------------

test("getLease returns undefined for nonexistent lease", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const result = await repo.getLease("nonexistent");
  assert.equal(result, undefined);
});

test("getLease returns stored lease", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const lease = createLease({ id: "lease-get-test" });
  await repo.insertLease(lease);

  const result = await repo.getLease("lease-get-test");
  assert.ok(result != null);
  assert.equal(result!.id, "lease-get-test");
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.getActiveLeaseForExecution
// ---------------------------------------------------------------------------

test("getActiveLeaseForExecution returns undefined when no active lease", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const result = await repo.getActiveLeaseForExecution("exec-1");
  assert.equal(result, undefined);
});

test("getActiveLeaseForExecution returns active lease", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const lease = createLease({ id: "lease-active-test", executionId: "exec-1", status: "active" });
  await repo.insertLease(lease);

  const result = await repo.getActiveLeaseForExecution("exec-1");
  assert.ok(result != null);
  assert.equal(result!.id, "lease-active-test");
  assert.equal(result!.status, "active");
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.getLatestFencingToken
// ---------------------------------------------------------------------------

test("getLatestFencingToken returns 0 when no leases exist", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const result = await repo.getLatestFencingToken("exec-1");
  assert.equal(result, 0);
});

test("getLatestFencingToken returns token from existing lease", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const lease = createLease({ executionId: "exec-1", fencingToken: 5 });
  await repo.insertLease(lease);

  const result = await repo.getLatestFencingToken("exec-1");
  assert.equal(result, 5);
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.updateLeaseStatus
// ---------------------------------------------------------------------------

test("updateLeaseStatus changes lease status", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const lease = createLease({ id: "lease-status-test", status: "active" });
  await repo.insertLease(lease);

  await repo.updateLeaseStatus("lease-status-test", "released");

  const updated = await repo.getLease("lease-status-test");
  assert.ok(updated != null);
  assert.equal(updated!.status, "released");
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.updateLeaseHeartbeat
// ---------------------------------------------------------------------------

test("updateLeaseHeartbeat updates lastHeartbeatAt", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const lease = createLease({ id: "lease-hb-test" });
  await repo.insertLease(lease);

  const newHeartbeat = new Date().toISOString();
  await repo.updateLeaseHeartbeat("lease-hb-test", newHeartbeat);

  const updated = await repo.getLease("lease-hb-test");
  assert.ok(updated != null);
  assert.equal(updated!.lastHeartbeatAt, newHeartbeat);
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.updateLeaseRelease
// ---------------------------------------------------------------------------

test("updateLeaseRelease sets releasedAt and reasonCode", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const lease = createLease({ id: "lease-release-test" });
  await repo.insertLease(lease);

  const releasedAt = nowIso();
  await repo.updateLeaseRelease("lease-release-test", releasedAt, "work_complete");

  const updated = await repo.getLease("lease-release-test");
  assert.ok(updated != null);
  assert.equal(updated!.releasedAt, releasedAt);
  assert.equal(updated!.reasonCode, "work_complete");
  assert.equal(updated!.status, "released");
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.insertLeaseAudit
// ---------------------------------------------------------------------------

test("insertLeaseAudit stores an audit record", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const audit: LeaseAuditRecord = {
    id: newId("audit"),
    executionId: "exec-1",
    leaseId: "lease-1",
    workerId: "worker-1",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: nowIso(),
  };

  await repo.insertLeaseAudit(audit);

  const audits = await repo.listLeaseAudits("exec-1");
  assert.equal(audits.length, 1);
  assert.equal(audits[0]!.id, audit.id);
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.listLeaseAudits
// ---------------------------------------------------------------------------

test("listLeaseAudits returns audits for execution", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const audit1: LeaseAuditRecord = {
    id: newId("audit1"),
    executionId: "exec-1",
    leaseId: "lease-1",
    workerId: "worker-1",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: nowIso(),
  };

  const audit2: LeaseAuditRecord = {
    id: newId("audit2"),
    executionId: "exec-1",
    leaseId: "lease-1",
    workerId: "worker-1",
    fencingToken: 1,
    eventType: "lease_renewed",
    reasonCode: null,
    recordedAt: nowIso(),
  };

  await repo.insertLeaseAudit(audit1);
  await repo.insertLeaseAudit(audit2);

  const audits = await repo.listLeaseAudits("exec-1");
  assert.equal(audits.length, 2);
});

test("listLeaseAudits returns empty array for execution with no audits", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const audits = await repo.listLeaseAudits("nonexistent-exec");
  assert.equal(audits.length, 0);
});

// ---------------------------------------------------------------------------
// Tests: LeaseRepository.listExecutionLeases
// ---------------------------------------------------------------------------

test("listExecutionLeases returns all leases for execution", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const lease1 = createLease({ id: "lease-list-1", executionId: "exec-1", fencingToken: 1 });
  const lease2 = createLease({ id: "lease-list-2", executionId: "exec-1", fencingToken: 2 });

  await repo.insertLease(lease1);
  await repo.insertLease(lease2);

  const leases = await repo.listExecutionLeases("exec-1");
  assert.equal(leases.length, 2);
});

// ---------------------------------------------------------------------------
// Integration-style Tests: Multi-operation workflows
// ---------------------------------------------------------------------------

test("lease lifecycle: insert, update heartbeat, release", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  // 1. Insert lease
  const lease = createLease({ id: "lease-lifecycle-test", executionId: "exec-1" });
  await repo.insertLease(lease);

  // 2. Verify insert
  let retrieved = await repo.getLease("lease-lifecycle-test");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.status, "active");

  // 3. Update heartbeat
  const newHeartbeat = nowIso();
  await repo.updateLeaseHeartbeat("lease-lifecycle-test", newHeartbeat);

  // 4. Verify heartbeat update
  retrieved = await repo.getLease("lease-lifecycle-test");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.lastHeartbeatAt, newHeartbeat);

  // 5. Release lease
  await repo.updateLeaseRelease("lease-lifecycle-test", nowIso(), "work_complete");

  // 6. Verify release
  retrieved = await repo.getLease("lease-lifecycle-test");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.status, "released");
  assert.equal(retrieved!.reasonCode, "work_complete");
});

test("audit trail: insert multiple audit records and retrieve in order", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  const auditTypes = ["lease_granted", "lease_renewed", "lease_renewed", "lease_released"] as const;
  for (let i = 0; i < auditTypes.length; i++) {
    const audit: LeaseAuditRecord = {
      id: newId(`audit-${i}`),
      executionId: "exec-audit-test",
      leaseId: "lease-1",
      workerId: "worker-1",
      fencingToken: 1,
      eventType: auditTypes[i] as any,
      reasonCode: null,
      recordedAt: nowIso(),
    };
    await repo.insertLeaseAudit(audit);
  }

  const audits = await repo.listLeaseAudits("exec-audit-test");
  assert.equal(audits.length, 4);
});

test("getLatestFencingToken increments with each new lease", async () => {
  const state = { leases: new Map(), audits: [], insertResponses: new Map() };
  const db = createMockSqliteDb(state);
  const backend = { driver: "sqlite" as const, sql: db };
  const repo = createLeaseRepository(backend as any);

  // First lease
  await repo.insertLease(createLease({ executionId: "exec-token-test", fencingToken: 1 }));
  let token = await repo.getLatestFencingToken("exec-token-test");
  assert.equal(token, 1);

  // Second lease (simulating fencing token increment)
  await repo.insertLease(createLease({ executionId: "exec-token-test", fencingToken: 2 }));
  token = await repo.getLatestFencingToken("exec-token-test");
  assert.equal(token, 2);
});