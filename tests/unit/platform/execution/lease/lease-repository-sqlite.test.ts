import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository-sqlite.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../../../../src/platform/contracts/types/domain.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Mock SQLite Connection with stateful storage
// ---------------------------------------------------------------------------

interface MockDbState {
  leases: Map<string, ExecutionLeaseRecord>;
  audits: LeaseAuditRecord[];
}

function createMockSqliteConnection(state: MockDbState): any {
  return {
    prepare: (sql: string) => {
      const isInsert = sql.trim().toLowerCase().startsWith("insert");
      const isSelect = sql.trim().toLowerCase().startsWith("select");
      const isUpdate = sql.trim().toLowerCase().startsWith("update");

      if (isInsert) {
        return {
          run: (...params: any[]) => {
            if (sql.includes("execution_leases")) {
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
        const hasWhereId = /where\s+id\s*=/i.test(sql);

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
              if (hasWhereExecutionId && !hasWhereId) {
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
            if (sql.includes("last_heartbeat_at")) {
              const id = params[1];
              const lastHeartbeatAt = params[0];
              const lease = state.leases.get(id);
              if (lease) {
                state.leases.set(id, { ...lease, lastHeartbeatAt });
              }
            } else if (sql.includes("released_at")) {
              const leaseId = params[2];
              const releasedAt = params[0];
              const reasonCode = params[1];
              const lease = state.leases.get(leaseId);
              if (lease) {
                state.leases.set(leaseId, { ...lease, releasedAt, reasonCode, status: "released" as const });
              }
            } else if (sql.includes("status")) {
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

function createMockSqliteDb(state: MockDbState = { leases: new Map(), audits: [] }): AuthoritativeSqlDatabase {
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
  } as unknown as AuthoritativeSqlDatabase;
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

function createAudit(overrides: Partial<LeaseAuditRecord> = {}): LeaseAuditRecord {
  return {
    id: newId("audit"),
    executionId: "exec-1",
    leaseId: "lease-1",
    workerId: "worker-1",
    fencingToken: 1,
    eventType: "lease_granted",
    reasonCode: null,
    recordedAt: nowIso(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository Constructor
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository constructor requires db parameter", () => {
  const db = createMockSqliteDb();
  const repo = new SqliteLeaseRepository(db);
  assert.ok(repo != null);
});

test("SqliteLeaseRepository is instantiable", () => {
  const db = createMockSqliteDb();
  const repo = new SqliteLeaseRepository(db);
  assert.ok(repo instanceof SqliteLeaseRepository);
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.insertLease
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.insertLease stores lease with all fields", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const lease = createLease({
    id: "lease-insert-1",
    executionId: "exec-insert",
    workerId: "worker-insert",
    attempt: 3,
    fencingToken: 7,
    queueName: "test-queue",
    status: "active",
  });

  await repo.insertLease(lease);

  const retrieved = state.leases.get("lease-insert-1");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.id, "lease-insert-1");
  assert.equal(retrieved!.executionId, "exec-insert");
  assert.equal(retrieved!.workerId, "worker-insert");
  assert.equal(retrieved!.attempt, 3);
  assert.equal(retrieved!.fencingToken, 7);
  assert.equal(retrieved!.queueName, "test-queue");
});

test("SqliteLeaseRepository.insertLease stores released lease", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const lease = createLease({
    id: "lease-released-insert",
    status: "released",
    releasedAt: nowIso(),
    reasonCode: "work_complete",
  });

  await repo.insertLease(lease);

  const retrieved = state.leases.get("lease-released-insert");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.status, "released");
  assert.equal(retrieved!.reasonCode, "work_complete");
});

test("SqliteLeaseRepository.insertLease handles null queueName", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const lease = createLease({ id: "lease-null-queue", queueName: null });
  await repo.insertLease(lease);

  const retrieved = state.leases.get("lease-null-queue");
  assert.ok(retrieved != null);
  assert.equal(retrieved!.queueName, null);
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.getLease
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.getLease returns undefined for missing lease", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const result = await repo.getLease("nonexistent-lease");
  assert.equal(result, undefined);
});

test("SqliteLeaseRepository.getLease returns lease by id", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-get-by-id" }));
  const result = await repo.getLease("lease-get-by-id");

  assert.ok(result != null);
  assert.equal(result!.id, "lease-get-by-id");
});

test("SqliteLeaseRepository.getLease returns correct lease when multiple exist", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-first" }));
  await repo.insertLease(createLease({ id: "lease-second" }));
  await repo.insertLease(createLease({ id: "lease-third" }));

  const result = await repo.getLease("lease-second");
  assert.ok(result != null);
  assert.equal(result!.id, "lease-second");
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.getActiveLeaseForExecution
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.getActiveLeaseForExecution returns undefined when no leases", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const result = await repo.getActiveLeaseForExecution("exec-no-leases");
  assert.equal(result, undefined);
});

test("SqliteLeaseRepository.getActiveLeaseForExecution returns active lease", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "active-lease", executionId: "exec-active", status: "active" }));
  const result = await repo.getActiveLeaseForExecution("exec-active");

  assert.ok(result != null);
  assert.equal(result!.id, "active-lease");
  assert.equal(result!.status, "active");
});

test("SqliteLeaseRepository.getActiveLeaseForExecution returns undefined for released lease", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({
    id: "released-lease",
    executionId: "exec-released",
    status: "released",
    releasedAt: nowIso(),
  }));

  const result = await repo.getActiveLeaseForExecution("exec-released");
  assert.equal(result, undefined);
});

test("SqliteLeaseRepository.getActiveLeaseForExecution returns undefined for expired lease", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({
    id: "expired-lease",
    executionId: "exec-expired",
    status: "expired",
  }));

  const result = await repo.getActiveLeaseForExecution("exec-expired");
  assert.equal(result, undefined);
});

test("SqliteLeaseRepository.getActiveLeaseForExecution ignores other execution's leases", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-exec-a", executionId: "exec-A", status: "active" }));
  await repo.insertLease(createLease({ id: "lease-exec-b", executionId: "exec-B", status: "active" }));

  const result = await repo.getActiveLeaseForExecution("exec-A");
  assert.ok(result != null);
  assert.equal(result!.executionId, "exec-A");
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.getLatestFencingToken
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.getLatestFencingToken returns 0 for execution with no leases", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const result = await repo.getLatestFencingToken("exec-no-leases");
  assert.equal(result, 0);
});

test("SqliteLeaseRepository.getLatestFencingToken returns highest fencing token", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ executionId: "exec-tokens", fencingToken: 3 }));
  await repo.insertLease(createLease({ executionId: "exec-tokens", fencingToken: 1 }));
  await repo.insertLease(createLease({ executionId: "exec-tokens", fencingToken: 5 }));

  const result = await repo.getLatestFencingToken("exec-tokens");
  assert.equal(result, 5);
});

test("SqliteLeaseRepository.getLatestFencingToken returns 0 when all leases have token 0", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ executionId: "exec-zero-tokens", fencingToken: 0 }));

  const result = await repo.getLatestFencingToken("exec-zero-tokens");
  assert.equal(result, 0);
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.listExecutionLeases
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.listExecutionLeases returns empty for execution with no leases", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const result = await repo.listExecutionLeases("exec-empty");
  assert.deepEqual(result, []);
});

test("SqliteLeaseRepository.listExecutionLeases returns all leases sorted by fencing token", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-list-3", executionId: "exec-list", fencingToken: 3 }));
  await repo.insertLease(createLease({ id: "lease-list-1", executionId: "exec-list", fencingToken: 1 }));
  await repo.insertLease(createLease({ id: "lease-list-2", executionId: "exec-list", fencingToken: 2 }));

  const result = await repo.listExecutionLeases("exec-list");
  assert.equal(result.length, 3);
  assert.equal(result[0]!.fencingToken, 1);
  assert.equal(result[1]!.fencingToken, 2);
  assert.equal(result[2]!.fencingToken, 3);
});

test("SqliteLeaseRepository.listExecutionLeases only returns leases for specified execution", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ executionId: "exec-A" }));
  await repo.insertLease(createLease({ executionId: "exec-A" }));
  await repo.insertLease(createLease({ executionId: "exec-B" }));

  const result = await repo.listExecutionLeases("exec-A");
  assert.equal(result.length, 2);
  result.forEach(lease => assert.equal(lease.executionId, "exec-A"));
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.updateLeaseStatus
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.updateLeaseStatus updates status", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-status-update" }));
  await repo.updateLeaseStatus("lease-status-update", "released");

  const updated = state.leases.get("lease-status-update");
  assert.ok(updated != null);
  assert.equal(updated!.status, "released");
});

test("SqliteLeaseRepository.updateLeaseStatus handles expired status", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-expired-status" }));
  await repo.updateLeaseStatus("lease-expired-status", "expired");

  const updated = state.leases.get("lease-expired-status");
  assert.ok(updated != null);
  assert.equal(updated!.status, "expired");
});

test("SqliteLeaseRepository.updateLeaseStatus handles reclaimed status", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-reclaimed-status" }));
  await repo.updateLeaseStatus("lease-reclaimed-status", "reclaimed");

  const updated = state.leases.get("lease-reclaimed-status");
  assert.ok(updated != null);
  assert.equal(updated!.status, "reclaimed");
});

test("SqliteLeaseRepository.updateLeaseStatus handles nonexistent lease gracefully", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  // Should not throw
  await repo.updateLeaseStatus("nonexistent-lease", "released");
  assert.equal(state.leases.size, 0);
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.updateLeaseHeartbeat
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.updateLeaseHeartbeat updates timestamp", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-hb" }));
  const newHeartbeat = "2026-01-15T12:00:00.000Z";
  await repo.updateLeaseHeartbeat("lease-hb", newHeartbeat);

  const updated = state.leases.get("lease-hb");
  assert.ok(updated != null);
  assert.equal(updated!.lastHeartbeatAt, newHeartbeat);
});

test("SqliteLeaseRepository.updateLeaseHeartbeat handles nonexistent lease gracefully", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.updateLeaseHeartbeat("nonexistent-hb", nowIso());
  assert.equal(state.leases.size, 0);
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.updateLeaseRelease
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.updateLeaseRelease sets released fields", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-release" }));
  const releasedAt = "2026-01-15T12:00:00.000Z";
  await repo.updateLeaseRelease("lease-release", releasedAt, "work_complete");

  const updated = state.leases.get("lease-release");
  assert.ok(updated != null);
  assert.equal(updated!.status, "released");
  assert.equal(updated!.releasedAt, releasedAt);
  assert.equal(updated!.reasonCode, "work_complete");
});

test("SqliteLeaseRepository.updateLeaseRelease handles null reasonCode", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-release-null" }));
  await repo.updateLeaseRelease("lease-release-null", nowIso(), null);

  const updated = state.leases.get("lease-release-null");
  assert.ok(updated != null);
  assert.equal(updated!.reasonCode, null);
});

test("SqliteLeaseRepository.updateLeaseRelease handles nonexistent lease gracefully", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.updateLeaseRelease("nonexistent-release", nowIso(), "test");
  assert.equal(state.leases.size, 0);
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.insertLeaseAudit
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.insertLeaseAudit stores audit record", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const audit = createAudit({ id: "audit-new" });
  await repo.insertLeaseAudit(audit);

  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0]!.id, "audit-new");
});

test("SqliteLeaseRepository.insertLeaseAudit stores all event types", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const eventTypes = ["lease_granted", "lease_renewed", "lease_expired", "lease_reclaimed", "lease_released", "lease_handover", "stale_write_rejected"] as const;

  for (const eventType of eventTypes) {
    await repo.insertLeaseAudit(createAudit({
      id: `audit-${eventType}`,
      eventType,
    }));
  }

  assert.equal(state.audits.length, eventTypes.length);
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository.listLeaseAudits
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository.listLeaseAudits returns empty for execution with no audits", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const result = await repo.listLeaseAudits("exec-no-audits");
  assert.deepEqual(result, []);
});

test("SqliteLeaseRepository.listLeaseAudits returns audits sorted by recordedAt", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLeaseAudit(createAudit({ id: "audit-time-2", recordedAt: "2026-01-01T12:00:00.000Z" }));
  await repo.insertLeaseAudit(createAudit({ id: "audit-time-1", recordedAt: "2026-01-01T11:00:00.000Z" }));
  await repo.insertLeaseAudit(createAudit({ id: "audit-time-3", recordedAt: "2026-01-01T13:00:00.000Z" }));

  const result = await repo.listLeaseAudits("exec-1");
  assert.equal(result.length, 3);
  assert.equal(result[0]!.id, "audit-time-1");
  assert.equal(result[1]!.id, "audit-time-2");
  assert.equal(result[2]!.id, "audit-time-3");
});

test("SqliteLeaseRepository.listLeaseAudits only returns audits for specified execution", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLeaseAudit(createAudit({ executionId: "exec-A" }));
  await repo.insertLeaseAudit(createAudit({ executionId: "exec-A" }));
  await repo.insertLeaseAudit(createAudit({ executionId: "exec-B" }));

  const result = await repo.listLeaseAudits("exec-A");
  assert.equal(result.length, 2);
  result.forEach(audit => assert.equal(audit.executionId, "exec-A"));
});

// ---------------------------------------------------------------------------
// Tests: Edge Cases and Error Handling
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository handles multiple leases with same execution and different statuses", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-active", executionId: "exec-multi", status: "active" }));
  await repo.insertLease(createLease({ id: "lease-released", executionId: "exec-multi", status: "released" }));
  await repo.insertLease(createLease({ id: "lease-expired", executionId: "exec-multi", status: "expired" }));

  const activeLease = await repo.getActiveLeaseForExecution("exec-multi");
  assert.ok(activeLease != null);
  assert.equal(activeLease!.id, "lease-active");

  const allLeases = await repo.listExecutionLeases("exec-multi");
  assert.equal(allLeases.length, 3);
});

test("SqliteLeaseRepository handles concurrent heartbeat updates", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-concurrent-hb" }));

  const heartbeat1 = "2026-01-01T12:00:00.000Z";
  const heartbeat2 = "2026-01-01T12:00:01.000Z";

  await repo.updateLeaseHeartbeat("lease-concurrent-hb", heartbeat1);
  await repo.updateLeaseHeartbeat("lease-concurrent-hb", heartbeat2);

  const updated = state.leases.get("lease-concurrent-hb");
  assert.ok(updated != null);
  // Last write wins in this mock implementation
  assert.equal(updated!.lastHeartbeatAt, heartbeat2);
});

test("SqliteLeaseRepository lease lifecycle: grant -> renew -> release", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  // 1. Insert active lease
  await repo.insertLease(createLease({ id: "lease-lifecycle", executionId: "exec-lifecycle" }));
  let lease = await repo.getLease("lease-lifecycle");
  assert.ok(lease != null);
  assert.equal(lease!.status, "active");

  // 2. Update heartbeat
  const newHeartbeat = "2026-01-15T12:30:00.000Z";
  await repo.updateLeaseHeartbeat("lease-lifecycle", newHeartbeat);
  lease = await repo.getLease("lease-lifecycle");
  assert.ok(lease != null);
  assert.equal(lease!.lastHeartbeatAt, newHeartbeat);

  // 3. Release lease
  const releasedAt = "2026-01-15T13:00:00.000Z";
  await repo.updateLeaseRelease("lease-lifecycle", releasedAt, "work_complete");
  lease = await repo.getLease("lease-lifecycle");
  assert.ok(lease != null);
  assert.equal(lease!.status, "released");
  assert.equal(lease!.releasedAt, releasedAt);
  assert.equal(lease!.reasonCode, "work_complete");

  // 4. Verify no active lease for execution
  const activeLease = await repo.getActiveLeaseForExecution("exec-lifecycle");
  assert.equal(activeLease, undefined);
});

test("SqliteLeaseRepository audit trail records all lifecycle events", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLeaseAudit(createAudit({ id: "audit-1", eventType: "lease_granted" }));
  await repo.insertLeaseAudit(createAudit({ id: "audit-2", eventType: "lease_renewed" }));
  await repo.insertLeaseAudit(createAudit({ id: "audit-3", eventType: "lease_released" }));

  const audits = await repo.listLeaseAudits("exec-1");
  assert.equal(audits.length, 3);
  assert.equal(audits[0]!.eventType, "lease_granted");
  assert.equal(audits[1]!.eventType, "lease_renewed");
  assert.equal(audits[2]!.eventType, "lease_released");
});

test("SqliteLeaseRepository getLatestFencingToken with mixed token values", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ executionId: "exec-mixed", fencingToken: 10 }));
  await repo.insertLease(createLease({ executionId: "exec-mixed", fencingToken: 5 }));
  await repo.insertLease(createLease({ executionId: "exec-mixed", fencingToken: 20 }));
  await repo.insertLease(createLease({ executionId: "exec-mixed", fencingToken: 1 }));

  const result = await repo.getLatestFencingToken("exec-mixed");
  assert.equal(result, 20);
});

test("SqliteLeaseRepository handles updateLeaseStatus to all possible statuses", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  // R26-08 fix: Test valid state transitions from active state
  const statuses: ExecutionLeaseRecord["status"][] = ["expired", "reclaimed", "handed_over"];

  for (const status of statuses) {
    await repo.insertLease(createLease({ id: `lease-status-${status}`, status: "active" }));
    await repo.updateLeaseStatus(`lease-status-${status}`, status);
    const updated = await repo.getLease(`lease-status-${status}`);
    assert.ok(updated != null);
    assert.equal(updated!.status, status, `Failed for status: ${status}`);
  }
});

// R26-08 fix: Test that invalid state transitions are rejected
test("R26-08: updateLeaseStatus rejects invalid transition from released to active", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-released", status: "released" }));

  // Attempting to go from released -> active should throw
  await assert.rejects(
    async () => await repo.updateLeaseStatus("lease-released", "active"),
    /Invalid lease status transition/,
  );
});

// R26-08 fix: Test that expired lease cannot go back to expired
test("R26-08: updateLeaseStatus rejects invalid transition from expired to expired", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-expired", status: "expired" }));

  // Attempting to go from expired -> expired should throw (no self-transition)
  await assert.rejects(
    async () => await repo.updateLeaseStatus("lease-expired", "expired"),
    /Invalid lease status transition/,
  );
});

// R26-09 fix: Test that release is only allowed from active/expired/handed_over states
test("R26-09: updateLeaseRelease rejects release from already released lease", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-already-released", status: "released" }));

  await assert.rejects(
    async () => await repo.updateLeaseRelease("lease-already-released", nowIso(), "test"),
    /Cannot release lease in released state/,
  );
});

// R26-10 fix: Test that heartbeat extends expires_at
test("R26-10: updateLeaseHeartbeat extends expires_at by original lease duration", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  const leasedAt = "2026-01-01T10:00:00.000Z";
  const expiresAt = "2026-01-01T10:01:00.000Z"; // 1 minute lease
  await repo.insertLease(createLease({
    id: "lease-hb-extend",
    leasedAt,
    expiresAt,
    status: "active",
  }));

  const newHeartbeat = "2026-01-01T10:00:30.000Z"; // 30 seconds after leasedAt
  await repo.updateLeaseHeartbeat("lease-hb-extend", newHeartbeat);

  const updated = state.leases.get("lease-hb-extend");
  assert.ok(updated != null);
  // Original lease was 60 seconds, so new expiry should be 30 + 60 = 90 seconds after leasedAt = T10:01:30
  assert.equal(updated!.lastHeartbeatAt, newHeartbeat);
  assert.equal(updated!.expiresAt, "2026-01-01T10:01:30.000Z");
});

// R26-10 fix: Test that heartbeat only works on active leases
test("R26-10: updateLeaseHeartbeat rejects heartbeat on released lease", async () => {
  const state = { leases: new Map(), audits: [] };
  const db = createMockSqliteDb(state);
  const repo = new SqliteLeaseRepository(db);

  await repo.insertLease(createLease({ id: "lease-hb-released", status: "released" }));

  await assert.rejects(
    async () => await repo.updateLeaseHeartbeat("lease-hb-released", nowIso()),
    /Cannot heartbeat lease in released state/,
  );
});
