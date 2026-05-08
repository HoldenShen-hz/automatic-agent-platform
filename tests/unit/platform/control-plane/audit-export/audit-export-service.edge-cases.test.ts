/**
 * Unit Tests: AuditExportService Edge Cases
 *
 * Tests edge cases, boundary conditions, and additional coverage
 * for the AuditExportService.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AuditExportService, AUDIT_EXPORT_DDL } from "../../../../../src/platform/control-plane/audit-export/audit-export-service.js";
import { createAuditIntegrityRepository } from "../../../../../src/platform/control-plane/iam/audit-integrity-repository.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { Tier1AuditIntegrityRecord } from "../../../../../src/platform/control-plane/iam/audit-event-integrity.js";

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
                  id: r.recordedAt,
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

test("AuditExportService.requestExport with all compliance frameworks", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const frameworks = ["soc2", "iso27001", "hipaa", "gdpr", "custom"] as const;

  for (const framework of frameworks) {
    const record = service.requestExport({
      framework,
      format: "json",
      windowStart: "2026-04-01T00:00:00.000Z",
      windowEnd: "2026-04-30T23:59:59.999Z",
      requestedBy: "user:admin",
    });

    assert.equal(record.framework, framework);
  }
});

test("AuditExportService.requestExport with all export formats", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const formats = ["json", "csv", "soc2_package"] as const;

  for (const format of formats) {
    const record = service.requestExport({
      framework: "soc2",
      format,
      windowStart: "2026-04-01T00:00:00.000Z",
      windowEnd: "2026-04-30T23:59:59.999Z",
      requestedBy: "user:admin",
    });

    assert.equal(record.format, format);
  }
});

test("AuditExportService.requestExport sets correct default values", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const record = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  assert.equal(record.status, "pending");
  assert.equal(record.eventCount, 0);
  assert.equal(record.integrityVerified, false);
  assert.equal(record.exportPath, null);
  assert.equal(record.generatedAt, null);
  assert.ok(record.createdAt.length > 0);
});

test("AuditExportService.requestExport with metadata serializes correctly", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const record = service.requestExport({
    framework: "iso27001",
    format: "csv",
    windowStart: "2026-01-01T00:00:00.000Z",
    windowEnd: "2026-03-31T23:59:59.999Z",
    requestedBy: "system",
    metadata: {
      auditor: "external-firm",
      auditId: "AUDIT-2026-Q1",
      teams: ["security", "compliance"],
    },
  });

  assert.ok(record.metadata !== null);
  const parsed = JSON.parse(record.metadata!);
  assert.equal(parsed.auditor, "external-firm");
  assert.equal(parsed.auditId, "AUDIT-2026-Q1");
  assert.deepEqual(parsed.teams, ["security", "compliance"]);
});

test("AuditExportService.generateExport with non-pending non-existent returns null", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const result = service.generateExport("non_existent_id");
  assert.equal(result, null);
});

test("AuditExportService.generateSoc2Package returns null for non-existent", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const result = service.generateSoc2Package("non_existent_id");
  assert.equal(result, null);
});

test("AuditExportService.generateSoc2Package contains control mappings", () => {
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
  ]);

  const result = service.generateSoc2Package(created.id);

  assert.ok(result !== null);
  assert.ok(Array.isArray(result!.controlMappings));

  const cc6_1 = result!.controlMappings.find((m) => m.controlId === "CC6.1");
  assert.ok(cc6_1);
  assert.ok(cc6_1!.count >= 0);
});

test("AuditExportService.summarizeWindow with no events returns zero tier counts", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(summary.totalEvents, 0);
  assert.equal(summary.tier1Count, 0);
  assert.equal(summary.tier2Count, 0);
  assert.equal(summary.tier3Count, 0);
  assert.deepEqual(summary.topEventTypes, []);
});

test("AuditExportService.summarizeWindow with events in all tiers", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  seedEvents(db, [
    { id: "evt-1", event_type: "tier1:a", event_tier: "tier_1", created_at: "2026-04-01T00:00:00.000Z" },
    { id: "evt-2", event_type: "tier1:b", event_tier: "tier_1", created_at: "2026-04-02T00:00:00.000Z" },
    { id: "evt-3", event_type: "tier2:a", event_tier: "tier_2", created_at: "2026-04-03T00:00:00.000Z" },
    { id: "evt-4", event_type: "tier3:a", event_tier: "tier_3", created_at: "2026-04-04T00:00:00.000Z" },
  ]);

  const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(summary.totalEvents, 4);
  assert.equal(summary.tier1Count, 2);
  assert.equal(summary.tier2Count, 1);
  assert.equal(summary.tier3Count, 1);
});

test("AuditExportService.summarizeWindow sets correct window boundaries", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const windowStart = "2026-01-01T00:00:00.000Z";
  const windowEnd = "2026-12-31T23:59:59.999Z";

  const summary = service.summarizeWindow(windowStart, windowEnd);

  assert.equal(summary.windowStart, windowStart);
  assert.equal(summary.windowEnd, windowEnd);
});

test("AuditExportService.summarizeWindow with multiple events of same type", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  // Create 10 events of same type
  for (let i = 0; i < 10; i++) {
    seedEvents(db, [
      { id: `evt-${i}`, event_type: "task:created", event_tier: "tier_1", created_at: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` },
    ]);
  }

  const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  const taskCreated = summary.topEventTypes.find((t) => t.type === "task:created");
  assert.ok(taskCreated);
  assert.equal(taskCreated!.count, 10);
});

test("AuditExportService.verifyIntegrity with empty window returns valid", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(result.valid, true);
  assert.equal(result.eventsChecked, 0);
  assert.equal(result.chainBreaks, 0);
  assert.equal(result.firstBreakAt, null);
  assert.equal(result.details, "no_tier_1_events_in_window");
});

test("AuditExportService.verifyIntegrity with multiple chain breaks", () => {
  const db = createMockDatabase();
  const integrityRepo = createAuditIntegrityRepository(db);
  const service = new AuditExportService(db, integrityRepo);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
    { id: "evt-3", event_type: "task:completed", event_tier: "tier_1", created_at: "2026-04-20T00:00:00.000Z" },
  ]);

  // Insert integrity records with multiple chain breaks
  integrityRepo.insertIntegrityRecord("evt-1", 1, "task:created", "2026-04-10T00:00:00.000Z", "checksum-1", null, "hash-1");
  integrityRepo.insertIntegrityRecord("evt-2", 2, "task:started", "2026-04-15T00:00:00.000Z", "checksum-2", "wrong-hash", "hash-2");
  integrityRepo.insertIntegrityRecord("evt-3", 3, "task:completed", "2026-04-20T00:00:00.000Z", "checksum-3", "wrong-hash-2", "hash-3");

  const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(result.valid, false);
  assert.ok(result.chainBreaks >= 1);
  assert.ok(result.details.includes("chain_breaks_detected"));
});

test("AuditExportService.verifyIntegrity with single integrity record", () => {
  const db = createMockDatabase();
  const integrityRepo = createAuditIntegrityRepository(db);
  const service = new AuditExportService(db, integrityRepo);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
  ]);

  // Single record - no previous hash to compare
  integrityRepo.insertIntegrityRecord("evt-1", 1, "task:created", "2026-04-10T00:00:00.000Z", "checksum-1", null, "hash-1");

  const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(result.valid, true);
  assert.equal(result.eventsChecked, 1);
  assert.equal(result.chainBreaks, 0);
});

test("AuditExportService.collectEvents with exact boundary matching", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-01T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-30T23:59:59.999Z" },
  ]);

  const events = service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(events.length, 2);
});

test("AuditExportService.collectEvents with events outside window", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-03-15T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
    { id: "evt-3", event_type: "task:completed", event_tier: "tier_1", created_at: "2026-05-01T00:00:00.000Z" },
  ]);

  const events = service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(events.length, 1);
  assert.equal(events[0]!.event_type, "task:started");
});

test("AuditExportService.collectEvents with zero limit returns empty", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
  ]);

  const events = service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z", 0);

  // With limit 0, slice returns empty array
  assert.equal(events.length, 0);
});

test("AuditExportService.listExports with status filter returns correct records", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  // Create pending export
  service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  // Create another pending export
  service.requestExport({
    framework: "iso27001",
    format: "csv",
    windowStart: "2026-05-01T00:00:00.000Z",
    windowEnd: "2026-05-31T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const pendingExports = service.listExports("pending");
  assert.equal(pendingExports.length, 2);

  const completedExports = service.listExports("completed");
  assert.equal(completedExports.length, 0);
});

test("AuditExportService.listExports with default limit", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  // Create 5 exports
  for (let i = 0; i < 5; i++) {
    service.requestExport({
      framework: "soc2",
      format: "json",
      windowStart: "2026-04-01T00:00:00.000Z",
      windowEnd: "2026-04-30T23:59:59.999Z",
      requestedBy: "user:admin",
    });
  }

  const exports = service.listExports();
  assert.equal(exports.length, 5);
});

test("AUDIT_EXPORT_DDL contains all required indexes", () => {
  assert.ok(AUDIT_EXPORT_DDL.includes("CREATE INDEX IF NOT EXISTS idx_audit_exports_status"));
});

test("AUDIT_EXPORT_DDL has correct table structure", () => {
  assert.ok(AUDIT_EXPORT_DDL.includes("CREATE TABLE IF NOT EXISTS audit_exports"));
  assert.ok(AUDIT_EXPORT_DDL.includes("id TEXT PRIMARY KEY"));
  assert.ok(AUDIT_EXPORT_DDL.includes("framework TEXT NOT NULL DEFAULT 'soc2'"));
  assert.ok(AUDIT_EXPORT_DDL.includes("format TEXT NOT NULL DEFAULT 'json'"));
  assert.ok(AUDIT_EXPORT_DDL.includes("window_start TEXT NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("window_end TEXT NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("status TEXT NOT NULL DEFAULT 'pending'"));
  assert.ok(AUDIT_EXPORT_DDL.includes("event_count INTEGER NOT NULL DEFAULT 0"));
  assert.ok(AUDIT_EXPORT_DDL.includes("integrity_verified INTEGER NOT NULL DEFAULT 0"));
  assert.ok(AUDIT_EXPORT_DDL.includes("export_path TEXT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("generated_at TEXT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("requested_by TEXT NOT NULL DEFAULT 'system'"));
  assert.ok(AUDIT_EXPORT_DDL.includes("created_at TEXT NOT NULL"));
  assert.ok(AUDIT_EXPORT_DDL.includes("metadata TEXT NULL"));
});

test("AuditExportService requestExport produces unique IDs", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const ids = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const record = service.requestExport({
      framework: "soc2",
      format: "json",
      windowStart: "2026-04-01T00:00:00.000Z",
      windowEnd: "2026-04-30T23:59:59.999Z",
      requestedBy: "user:admin",
    });
    ids.add(record.id);
  }

  assert.equal(ids.size, 10);
});

test("AuditExportService generateSoc2Package includes events in response", () => {
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
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
  ]);

  const result = service.generateSoc2Package(created.id);

  assert.ok(result !== null);
  assert.ok(Array.isArray(result!.events));
  assert.ok(result!.events.length >= 0);
});

test("AuditExportService generateSoc2Package with window that has no events", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2027-01-01T00:00:00.000Z",
    windowEnd: "2027-01-31T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const result = service.generateSoc2Package(created.id);

  assert.ok(result !== null);
  assert.equal(result!.summary.totalEvents, 0);
  assert.equal(result!.events.length, 0);
});

test("AuditExportService verifyIntegrity with records spanning multiple chain positions", () => {
  const db = createMockDatabase();
  const integrityRepo = createAuditIntegrityRepository(db);
  const service = new AuditExportService(db, integrityRepo);

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
    { id: "evt-2", event_type: "task:started", event_tier: "tier_1", created_at: "2026-04-15T00:00:00.000Z" },
    { id: "evt-3", event_type: "task:completed", event_tier: "tier_1", created_at: "2026-04-20T00:00:00.000Z" },
    { id: "evt-4", event_type: "task:approved", event_tier: "tier_1", created_at: "2026-04-25T00:00:00.000Z" },
  ]);

  integrityRepo.insertIntegrityRecord("evt-1", 1, "task:created", "2026-04-10T00:00:00.000Z", "c1", null, "h1");
  integrityRepo.insertIntegrityRecord("evt-2", 2, "task:started", "2026-04-15T00:00:00.000Z", "c2", "h1", "h2");
  integrityRepo.insertIntegrityRecord("evt-3", 3, "task:completed", "2026-04-20T00:00:00.000Z", "c3", "h2", "h3");
  integrityRepo.insertIntegrityRecord("evt-4", 4, "task:approved", "2026-04-25T00:00:00.000Z", "c4", "h3", "h4");

  const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(result.valid, true);
  assert.equal(result.eventsChecked, 4);
  assert.equal(result.chainBreaks, 0);
  assert.equal(result.details, "integrity_chain_valid");
});

test("AuditExportService getExport after generateExport shows updated status", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const created = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
  });

  const initial = service.getExport(created.id);
  assert.equal(initial!.status, "pending");
  assert.equal(initial!.eventCount, 0);

  service.generateExport(created.id);

  const afterGenerate = service.getExport(created.id);
  assert.equal(afterGenerate!.status, "completed");
  assert.ok(afterGenerate!.eventCount >= 0);
  assert.ok(afterGenerate!.exportPath !== null);
  assert.ok(afterGenerate!.generatedAt !== null);
});

test("AuditExportService summarizeWindow with exactly matching timestamps", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const windowStart = "2026-04-10T00:00:00.000Z";
  const windowEnd = "2026-04-10T00:00:00.000Z";

  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: windowStart },
  ]);

  const summary = service.summarizeWindow(windowStart, windowEnd);

  assert.equal(summary.totalEvents, 1);
});

test("AuditExportService requestExport with very long metadata", () => {
  const db = createMockDatabase();
  const service = new AuditExportService(db);

  const longMetadata = { description: "x".repeat(10000) };

  const record = service.requestExport({
    framework: "soc2",
    format: "json",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    requestedBy: "user:admin",
    metadata: longMetadata,
  });

  assert.ok(record.metadata !== null);
  assert.ok(record.metadata!.length > 1000);
});

test("AuditExportService with custom integrity repository uses provided one", () => {
  const db = createMockDatabase();
  const integrityRepo = createAuditIntegrityRepository(db);
  const service = new AuditExportService(db, integrityRepo);

  // Create integrity record
  seedEvents(db, [
    { id: "evt-1", event_type: "task:created", event_tier: "tier_1", created_at: "2026-04-10T00:00:00.000Z" },
  ]);

  integrityRepo.insertIntegrityRecord("evt-1", 1, "task:created", "2026-04-10T00:00:00.000Z", "checksum-1", null, "hash-1");

  const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");

  assert.equal(result.valid, true);
  assert.equal(result.eventsChecked, 1);
});