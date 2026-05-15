/**
 * Unit tests for AuditExportService
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AuditExportService, AUDIT_EXPORT_DDL } from "../../../../../src/platform/five-plane-control-plane/audit-export/audit-export-service.js";
import { createAuditIntegrityRepository, AUDIT_INTEGRITY_DDL } from "../../../../../src/platform/five-plane-control-plane/iam/audit-integrity-repository.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { Tier1AuditIntegrityRecord } from "../../../../../src/platform/five-plane-control-plane/iam/audit-event-integrity.js";
import type { AuditExportRecord, AuditEventSummary, IntegrityCheckResult, Soc2EvidencePackage } from "../../../../../src/platform/five-plane-control-plane/audit-export/index.js";

function createMockDatabase(): AuthoritativeSqlDatabase {
  const auditExports: Map<string, Record<string, unknown>> = new Map();
  const events: Map<string, Record<string, unknown>> = new Map();
  const integrityRecords: Map<string, Tier1AuditIntegrityRecord> = new Map();

  return {
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        return {
          run: (...args: unknown[]) => {
            if (sql.includes("INSERT INTO audit_exports")) {
              const record: Record<string, unknown> = {
                id: args[0],
                framework: args[1],
                format: args[2],
                window_start: args[3],
                window_end: args[4],
                status: args[5],
                event_count: args[6],
                integrity_verified: args[7],
                export_path: args[8],
                generated_at: args[9],
                requested_by: args[10],
                created_at: args[11],
                metadata: args[12],
              };
              auditExports.set(args[0] as string, record);
            } else if (sql.includes("UPDATE audit_exports SET status = 'generating'")) {
              const id = args[0] as string;
              const existing = auditExports.get(id);
              if (existing) {
                auditExports.set(id, { ...existing, status: "generating" });
              }
            } else if (sql.includes("UPDATE audit_exports SET status = 'completed'")) {
              const id = args[4] as string;
              const existing = auditExports.get(id);
              if (existing) {
                auditExports.set(id, {
                  ...existing,
                  status: "completed",
                  event_count: args[0],
                  integrity_verified: args[1],
                  export_path: args[2],
                  generated_at: args[3],
                });
              }
            } else if (sql.includes("INSERT INTO audit_integrity_records")) {
              const record: Tier1AuditIntegrityRecord = {
                eventId: args[1] as string,
                chainPosition: args[2] as number,
                eventType: args[3] as string,
                eventCreatedAt: args[4] as string,
                eventChecksum: args[5] as string,
                previousChainHash: args[6] as string | null,
                chainHash: args[7] as string,
                recordedAt: args[8] as string,
                algorithm: "SHA-256",
              };
              integrityRecords.set(record.eventId, record);
            } else if (sql.includes("INSERT INTO events")) {
              const record: Record<string, unknown> = {
                id: args[0],
                event_type: args[1],
                event_tier: args[2],
                created_at: args[3],
              };
              events.set(args[0] as string, record);
            }
          },
          get: (...args: unknown[]) => {
            if (sql.includes("FROM audit_exports WHERE id = ?")) {
              return auditExports.get(args[0] as string);
            } else if (sql.includes("COUNT") && sql.includes("FROM events")) {
              const rows = Array.from(events.values()).filter((e) => {
                const createdAt = e.created_at as string;
                return createdAt >= (args[0] as string) && createdAt <= (args[1] as string);
              });
              return { cnt: rows.length };
            } else if (sql.includes("GROUP BY event_tier")) {
              const rows = Array.from(events.values()).filter((e) => {
                const createdAt = e.created_at as string;
                return createdAt >= (args[0] as string) && createdAt <= (args[1] as string);
              });
              const tierCounts: Record<string, number> = {};
              for (const row of rows) {
                const tier = String(row.event_tier ?? "");
                tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
              }
              return Object.entries(tierCounts).map(([event_tier, cnt]) => ({ event_tier, cnt }));
            } else if (sql.includes("GROUP BY event_type")) {
              const rows = Array.from(events.values()).filter((e) => {
                const createdAt = e.created_at as string;
                return createdAt >= (args[0] as string) && createdAt <= (args[1] as string);
              });
              const typeCounts: Record<string, number> = {};
              for (const row of rows) {
                const type = String(row.event_type ?? "");
                typeCounts[type] = (typeCounts[type] ?? 0) + 1;
              }
              return Object.entries(typeCounts)
                .map(([event_type, cnt]) => ({ event_type, cnt }))
                .sort((a, b) => b.cnt - a.cnt)
                .slice(0, 10);
            } else if (sql.includes("ORDER BY chain_position DESC")) {
              const values = Array.from(integrityRecords.values());
              return values.length > 0 ? values[values.length - 1] : undefined;
            }
            return undefined;
          },
          all: (...args: unknown[]) => {
            if (sql.includes("FROM audit_exports WHERE status = ?")) {
              return Array.from(auditExports.values()).filter((r) => r.status === args[0]);
            } else if (sql.includes("FROM audit_exports ORDER BY")) {
              const limit = (args[0] as number) ?? 50;
              return Array.from(auditExports.values()).slice(0, limit);
            } else if (sql.includes("SELECT air.* FROM audit_integrity_records")) {
              const windowStart = args[0] as string;
              const windowEnd = args[1] as string;
              return Array.from(integrityRecords.values())
                .filter((r) => {
                  return r.eventCreatedAt >= windowStart && r.eventCreatedAt <= windowEnd;
                })
                .sort((a, b) => a.chainPosition - b.chainPosition)
                .map((r) => ({
                  id: r.recordedAt, // placeholder
                  event_id: r.eventId,
                  chain_position: r.chainPosition,
                  event_type: r.eventType,
                  event_created_at: r.eventCreatedAt,
                  event_checksum: r.eventChecksum,
                  previous_chain_hash: r.previousChainHash,
                  chain_hash: r.chainHash,
                  recorded_at: r.recordedAt,
                }));
            } else if (sql.includes("GROUP BY event_tier")) {
              const windowStart = args[0] as string;
              const windowEnd = args[1] as string;
              const rows = Array.from(events.values()).filter((e) => {
                const createdAt = e.created_at as string;
                return createdAt >= windowStart && createdAt <= windowEnd;
              });
              const tierCounts: Record<string, number> = {};
              for (const row of rows) {
                const tier = String(row.event_tier ?? "");
                tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
              }
              return Object.entries(tierCounts).map(([event_tier, cnt]) => ({ event_tier, cnt }));
            } else if (sql.includes("GROUP BY event_type")) {
              const windowStart = args[0] as string;
              const windowEnd = args[1] as string;
              const rows = Array.from(events.values()).filter((e) => {
                const createdAt = e.created_at as string;
                return createdAt >= windowStart && createdAt <= windowEnd;
              });
              const typeCounts: Record<string, number> = {};
              for (const row of rows) {
                const type = String(row.event_type ?? "");
                typeCounts[type] = (typeCounts[type] ?? 0) + 1;
              }
              return Object.entries(typeCounts)
                .map(([event_type, cnt]) => ({ event_type, cnt }))
                .sort((a, b) => b.cnt - a.cnt)
                .slice(0, 10);
            } else if (sql.includes("FROM events") && sql.includes("WHERE created_at >=")) {
              const windowStart = args[0] as string;
              const windowEnd = args[1] as string;
              const limit = (args[2] as number) ?? 10_000;
              return Array.from(events.values())
                .filter((e) => {
                  const createdAt = e.created_at as string;
                  return createdAt >= windowStart && createdAt <= windowEnd;
                })
                .slice(0, limit);
            }
            return [];
          },
        };
      },
    },
    runMigrations: () => {},
    healthCheck: async () => true,
  } as unknown as AuthoritativeSqlDatabase;
}

function seedEvents(db: AuthoritativeSqlDatabase, events: Array<{ id: string; event_type: string; event_tier: string; created_at: string }>): void {
  for (const evt of events) {
    db.connection
      .prepare("INSERT INTO events (id, event_type, event_tier, created_at) VALUES (?, ?, ?, ?)")
      .run(evt.id, evt.event_type, evt.event_tier, evt.created_at);
  }
}

test("AUDIT_EXPORT_DDL contains required schema", () => {
  assert.ok(AUDIT_EXPORT_DDL.includes("audit_exports"));
  assert.ok(AUDIT_EXPORT_DDL.includes("framework"));
  assert.ok(AUDIT_EXPORT_DDL.includes("format"));
  assert.ok(AUDIT_EXPORT_DDL.includes("window_start"));
  assert.ok(AUDIT_EXPORT_DDL.includes("window_end"));
  assert.ok(AUDIT_EXPORT_DDL.includes("status"));
  assert.ok(AUDIT_EXPORT_DDL.includes("event_count"));
  assert.ok(AUDIT_EXPORT_DDL.includes("integrity_verified"));
  assert.ok(AUDIT_EXPORT_DDL.includes("export_path"));
  assert.ok(AUDIT_EXPORT_DDL.includes("idx_audit_exports_status"));
});

test("AuditExportService constructor creates instance without integrityRepository", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  assert.ok(service !== null);
});

test("AuditExportService constructor creates instance with custom integrityRepository", () => {
  const db = createMockDatabase();
  const integrityRepo = createAuditIntegrityRepository(db);
  const service = new AuditExportService(db, integrityRepo);

  assert.ok(service !== null);
});

test("requestExport creates a new audit export record", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const record = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
    metadata: { purpose: "quarterly_review" },
  });

  assert.ok(record.id.startsWith("aexport_"));
  assert.equal(record.framework, "soc2");
  assert.equal(record.format, "json");
  assert.equal(record.windowStart, "2026-04-01T00:00:00.000Z");
  assert.equal(record.windowEnd, "2026-04-30T23:59:59.999Z");
  assert.equal(record.status, "pending");
  assert.equal(record.eventCount, 0);
  assert.equal(record.integrityVerified, false);
  assert.equal(record.exportPath, null);
  assert.equal(record.generatedAt, null);
  assert.equal(record.requestedBy, "user:admin");
  assert.ok(record.createdAt.length > 0);
  assert.equal(record.metadata, '{"purpose":"quarterly_review"}');
});

test("requestExport without metadata sets metadata to null", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const record = service.requestExport({
    framework: "iso27001",
    format: "csv",
    windowStart: "2026-01-01T00:00:00.000Z",
    windowEnd: "2026-03-31T23:59:59.999Z",
    requestedBy: "system",
  });

  assert.equal(record.metadata, null);
});

test("getExport returns null for non-existent export", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const result = service.getExport("non_existent_id");

  assert.equal(result, null);
});

test("getExport returns export record by id", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "hipaa",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const result = service.getExport(created.id);

  assert.ok(result !== null);
  assert.equal(result!.id, created.id);
  assert.equal(result!.framework, "hipaa");
});

test("listExports returns all exports when no status filter", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  service.requestExport({
    framework: "iso27001",
    format: "csv",
    windowStart: "2026-05-01T00:00:00.000Z",
    windowEnd: "2026-05-31T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const results = service.listExports();

  assert.equal(results.length, 2);
});

test("listExports filters by status", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  service.requestExport({
    framework: "iso27001",
    format: "csv",
    windowStart: "2026-05-01T00:00:00.000Z",
    windowEnd: "2026-05-31T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const results = service.listExports("pending");

  assert.equal(results.length, 2);
  for (const record of results) {
    assert.equal(record.status, "pending");
  }
});

test("listExports respects limit parameter", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  for (let i = 0; i < 5; i++) {
    service.requestExport({
      framework: "soc2",
      format: "json",
      windowStart: "2026-04-01T00:00:00.000Z",
      windowEnd: "2026-04-30T23:59:59.999Z",
      requestedBy: "user:admin",
    });
  }

  const results = service.listExports(undefined, 3);

  assert.equal(results.length, 3);
});

test("generateExport returns null for non-existent export", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const result = service.generateExport("non_existent_id");

  assert.equal(result, null);
});

test("generateExport returns existing non-pending export unchanged", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  // Manually set status to completed
  db.connection.prepare("UPDATE audit_exports SET status = 'completed' WHERE id = ?").run(created.id);

  const result = service.generateExport(created.id);

  assert.ok(result !== null);
  assert.equal(result!.status, "completed");
});

test("generateExport updates pending export to completed", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const result = service.generateExport(created.id);

  assert.ok(result !== null);
  assert.equal(result!.status, "completed");
  assert.ok(result!.exportPath !== null);
  assert.ok(result!.generatedAt !== null);
});

test("generateExport sets correct export path for json format", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const result = service.generateExport(created.id);

  assert.ok(result !== null);
  assert.ok(result!.exportPath!.endsWith(".json"));
});

test("generateExport sets correct export path for csv format", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "soc2",
    format: "csv",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const result = service.generateExport(created.id);

  assert.ok(result !== null);
  assert.ok(result!.exportPath!.endsWith(".csv"));
});

test("summarizeWindow returns zero counts for empty window", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(summary.totalEvents, 0);
  assert.equal(summary.tier1Count, 0);
  assert.equal(summary.tier2Count, 0);
  assert.equal(summary.tier3Count, 0);
  assert.deepEqual(summary.topEventTypes, []);
  assert.equal(summary.windowStart, "2026-04-01T00:00:00.000Z");
  assert.equal(summary.windowEnd, "2026-04-30T23:59:59.999Z");
});

test("summarizeWindow correctly counts events by tier", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
    { id: "evt-3", event_type: "task:completed", event_tier: "tier_2", created_at: "2026-04-20T00:00:00.000Z" },
    { id: "evt-4", event_type: "task:failed", event_tier: "tier_3", created_at: "2026-04-25T00:00:00.000Z" },
  ]);

  const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(summary.totalEvents, 4);
  assert.equal(summary.tier1Count, 2);
  assert.equal(summary.tier2Count, 1);
  assert.equal(summary.tier3Count, 1);
});

test("summarizeWindow returns top event types", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-11T00:00:00.000Z" },
    { id: "evt-3", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-12T00:00:00.000Z" },
    { id: "evt-4", event_type: "task:completed", event_tier: "tier_2", created_at: "2026-04-13T00:00:00.000Z" },
    { id: "evt-5", event_type: "task:completed", event_tier: "tier_2", created_at: "2026-04-14T00:00:00.000Z" },
    { id: "evt-6", event_type: "task:failed", event_tier: "tier_3", created_at: "2026-04-15T00:00:00.000Z" },
  ]);

  const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.ok(summary.topEventTypes.length > 0);
  assert.equal(summary.topEventTypes[0]?.type, "task:created");
  assert.equal(summary.topEventTypes[0]?.count, 3);
});

test("verifyIntegrity returns valid with no integrity records", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(result.valid, true);
  assert.equal(result.eventsChecked, 0);
  assert.equal(result.chainBreaks, 0);
  assert.equal(result.firstBreakAt, null);
  assert.equal(result.details, "no_tier_1_events_in_window");
});

test("verifyIntegrity returns valid with continuous chain", () => {
  const db = createMockDatabase();
  const integrityRepo = createAuditIntegrityRepository(db);
  const service = new AuditExportService(db, integrityRepo);

  // Insert events first
  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
  ]);

  // Insert integrity records with proper chain
  integrityRepo.insertIntegrityRecord(
    "evt-1",
    1,
    "task:created",
    "2026-04-10T00:00:00.000Z",
    "checksum-1",
    null,
    "hash-1",
  );

  integrityRepo.insertIntegrityRecord(
    "evt-2",
    2,
    "task:started",
    "2026-04-15T00:00:00.000Z",
    "checksum-2",
    "hash-1",
    "hash-2",
  );

  const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(result.valid, true);
  assert.equal(result.eventsChecked, 2);
  assert.equal(result.chainBreaks, 0);
  assert.equal(result.details, "integrity_chain_valid");
});

test("verifyIntegrity detects chain breaks", () => {
  const db = createMockDatabase();
  const integrityRepo = createAuditIntegrityRepository(db);
  const service = new AuditExportService(db, integrityRepo);

  // Insert events first
  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
  ]);

  // Insert integrity records with broken chain (prev hash mismatch)
  integrityRepo.insertIntegrityRecord(
    "evt-1",
    1,
    "task:created",
    "2026-04-10T00:00:00.000Z",
    "checksum-1",
    null,
    "hash-1",
  );

  integrityRepo.insertIntegrityRecord(
    "evt-2",
    2,
    "task:started",
    "2026-04-15T00:00:00.000Z",
    "checksum-2",
    "wrong-previous-hash", // This breaks the chain
    "hash-2",
  );

  const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(result.valid, false);
  assert.equal(result.chainBreaks, 1);
  assert.ok(result.firstBreakAt !== null);
  assert.ok(result.details.includes("chain_breaks_detected"));
});

test("collectEvents returns empty array for empty window", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const events = service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.deepEqual(events, []);
});

test("collectEvents returns events within window", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
    { id: "evt-3", event_type: "task:completed", event_tier: "tier_2", created_at: "2026-04-20T00:00:00.000Z" },
  ]);

  const events = service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(events.length, 3);
});

test("collectEvents respects limit parameter", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  for (let i = 0; i < 15; i++) {
    seedEvents(db, [
      { id: `evt-${i}`, event_type: "task:created", event_tier: "tier_1", created_at: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` },
    ]);
  }

  const events = service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z", 5);

  assert.equal(events.length, 5);
});

test("generateSoc2Package returns null for non-existent export", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const result = service.generateSoc2Package("non_existent_id");

  assert.equal(result, null);
});

test("generateSoc2Package returns valid evidence package", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  seedEvents(db, [
    { id: "evt-1", event_type: "task:approval", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:transition", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
    { id: "evt-3", event_type: "task:execution", event_tier: "tier_1", created_at: "2026-04-20T00:00:00.000Z" },
    { id: "evt-4", event_type: "task:health", event_tier: "tier_1", created_at: "2026-04-25T00:00:00.000Z" },
  ]);

  const result = service.generateSoc2Package(created.id);

  assert.ok(result !== null);
  assert.equal(result!.exportId, created.id);
  assert.equal(result!.framework, "soc2");
  assert.ok(result!.generatedAt.length > 0);
  assert.deepEqual(result!.window, { start: "2026-04-01T00:00:00.000Z", end: "2026-04-30T23:59:59.999Z" });
  assert.ok(result!.summary !== null);
  assert.ok(result!.integrityCheck !== null);
  assert.ok(result!.events !== null);
  assert.ok(result!.controlMappings !== null);
});

test("generateSoc2Package includes correct control mappings", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  seedEvents(db, [
    { id: "evt-1", event_type: "task:approval", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:approval", event_tier: "tier_1", created_at: "2026-04-11T00:00:00.000Z" },
    { id: "evt-3", event_type: "task:transition", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
    { id: "evt-4", event_type: "task:execution", event_tier: "tier_1", created_at: "2026-04-20T00:00:00.000Z" },
    { id: "evt-5", event_type: "task:health", event_tier: "tier_1", created_at: "2026-04-25T00:00:00.000Z" },
  ]);

  const result = service.generateSoc2Package(created.id);

  assert.ok(result !== null);
  const cc6_1 = result!.controlMappings.find((m) => m.controlId === "CC6.1");
  assert.ok(cc6_1 !== undefined);
  assert.equal(cc6_1!.count, 2); // 2 approval events

  const cc7_2 = result!.controlMappings.find((m) => m.controlId === "CC7.2");
  assert.ok(cc7_2 !== undefined);
  assert.equal(cc7_2!.count, 1); // 1 transition event

  const cc8_1 = result!.controlMappings.find((m) => m.controlId === "CC8.1");
  assert.ok(cc8_1 !== undefined);
  assert.equal(cc8_1!.count, 1); // 1 execution event

  const a1_2 = result!.controlMappings.find((m) => m.controlId === "A1.2");
  assert.ok(a1_2 !== undefined);
  assert.equal(a1_2!.count, 1); // 1 health event
});
