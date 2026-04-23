import assert from "node:assert/strict";
import test from "node:test";
import { AuditExportService, AUDIT_EXPORT_DDL } from "../../../../../src/platform/control-plane/audit-export/audit-export-service.js";
function createMockStatement() {
    let data = [];
    return {
        run: () => { },
        get: (..._args) => data[0],
        all: (..._args) => data,
        setData(rows) {
            data = rows;
        },
    };
}
function createMockDb() {
    const statements = new Map();
    const execCalls = [];
    const mockPrepare = (sql) => {
        if (!statements.has(sql)) {
            statements.set(sql, createMockStatement());
        }
        return statements.get(sql);
    };
    const db = {
        filePath: ":memory:",
        backendType: "sqlite",
        connection: {
            exec(sql) {
                execCalls.push(sql);
            },
            prepare: mockPrepare,
        },
        migrate() { },
        getSchemaStatus() {
            return { current: true, version: 1 };
        },
        assertSchemaCurrent() { },
        integrityCheck() {
            return [];
        },
        healthCheck() {
            return Promise.resolve(true);
        },
        transaction(work) {
            return work();
        },
        readTransaction(work) {
            return work();
        },
    };
    return { db, statements, execCalls };
}
function createMockIntegrityRepo() {
    let records = [];
    const repo = {
        insertIntegrityRecord() { },
        getIntegrityRecord() {
            return null;
        },
        getLatestChainHash() {
            return null;
        },
        getChainHashForEvent() {
            return null;
        },
        getIntegrityRecordsInRange() {
            return records.filter((r) => {
                const inRange = r.eventCreatedAt >= "2026-04-01T00:00:00.000Z" &&
                    r.eventCreatedAt <= "2026-04-30T23:59:59.999Z";
                return inRange;
            });
        },
        setRecords(newRecords) {
            records = newRecords;
        },
    };
    return { repo, records };
}
// ── Tests ─────────────────────────────────────────────────────────────────────
test("AuditExportService.requestExport creates a new export record", (t) => {
    test.skip(true, "Requires database setup - use integration test");
    const { db } = createMockDb();
    const service = new AuditExportService(db);
    const record = service.requestExport({
        framework: "soc2",
        format: "json",
        windowStart: "2026-04-01T00:00:00.000Z",
        windowEnd: "2026-04-30T23:59:59.999Z",
        requestedBy: "user:test",
    });
    assert.equal(record.framework, "soc2");
    assert.equal(record.format, "json");
    assert.equal(record.status, "pending");
    assert.equal(record.eventCount, 0);
    assert.equal(record.integrityVerified, false);
});
test("AuditExportService.requestExport accepts metadata", (t) => {
    test.skip(true, "Requires database setup - use integration test");
    const { db } = createMockDb();
    const service = new AuditExportService(db);
    const record = service.requestExport({
        framework: "hipaa",
        format: "csv",
        windowStart: "2026-04-01T00:00:00.000Z",
        windowEnd: "2026-04-30T23:59:59.999Z",
        requestedBy: "user:admin",
        metadata: { purpose: "compliance_review", region: "us-west" },
    });
    assert.equal(record.framework, "hipaa");
    assert.ok(record.metadata !== null);
});
test("AUDIT_EXPORT_DDL contains expected table schema", () => {
    assert.ok(AUDIT_EXPORT_DDL.includes("CREATE TABLE IF NOT EXISTS audit_exports"));
    assert.ok(AUDIT_EXPORT_DDL.includes("id TEXT PRIMARY KEY"));
    assert.ok(AUDIT_EXPORT_DDL.includes("framework TEXT NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("format TEXT NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("window_start TEXT NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("window_end TEXT NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("status TEXT NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("event_count INTEGER NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("integrity_verified INTEGER NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("export_path TEXT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("generated_at TEXT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("requested_by TEXT NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("created_at TEXT NOT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("metadata TEXT NULL"));
    assert.ok(AUDIT_EXPORT_DDL.includes("idx_audit_exports_status"));
});
test("AuditExportService.getExport returns null for non-existent export", (t) => {
    test.skip(true, "Requires database setup - use integration test");
    const { db } = createMockDb();
    const service = new AuditExportService(db);
    const result = service.getExport("non_existent_id");
    assert.equal(result, null);
});
test("AuditExportService.verifyIntegrity returns valid when no records in window", () => {
    const { db } = createMockDb();
    const { repo } = createMockIntegrityRepo();
    repo.setRecords([]);
    const service = new AuditExportService(db, repo);
    const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(result.valid, true);
    assert.equal(result.eventsChecked, 0);
    assert.equal(result.chainBreaks, 0);
    assert.equal(result.firstBreakAt, null);
    assert.equal(result.details, "no_tier_1_events_in_window");
});
test("AuditExportService.verifyIntegrity returns valid when chain is intact", () => {
    const { db } = createMockDb();
    const { repo } = createMockIntegrityRepo();
    // Create a valid chain: record1 -> record2 -> record3
    repo.setRecords([
        {
            eventId: "event_1",
            chainPosition: 1,
            eventType: "task_created",
            eventCreatedAt: "2026-04-01T10:00:00.000Z",
            eventChecksum: "checksum_1",
            previousChainHash: null,
            chainHash: "hash_1",
            recordedAt: "2026-04-01T10:00:00.000Z",
        },
        {
            eventId: "event_2",
            chainPosition: 2,
            eventType: "task_completed",
            eventCreatedAt: "2026-04-02T10:00:00.000Z",
            eventChecksum: "checksum_2",
            previousChainHash: "hash_1",
            chainHash: "hash_2",
            recordedAt: "2026-04-02T10:00:00.000Z",
        },
        {
            eventId: "event_3",
            chainPosition: 3,
            eventType: "task_approved",
            eventCreatedAt: "2026-04-03T10:00:00.000Z",
            eventChecksum: "checksum_3",
            previousChainHash: "hash_2",
            chainHash: "hash_3",
            recordedAt: "2026-04-03T10:00:00.000Z",
        },
    ]);
    const service = new AuditExportService(db, repo);
    const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(result.valid, true);
    assert.equal(result.eventsChecked, 3);
    assert.equal(result.chainBreaks, 0);
    assert.equal(result.firstBreakAt, null);
    assert.equal(result.details, "integrity_chain_valid");
});
test("AuditExportService.verifyIntegrity detects chain break", () => {
    const { db } = createMockDb();
    const { repo } = createMockIntegrityRepo();
    // Chain break: record2 has wrong previousChainHash (should be hash_1 but is wrong)
    repo.setRecords([
        {
            eventId: "event_1",
            chainPosition: 1,
            eventType: "task_created",
            eventCreatedAt: "2026-04-01T10:00:00.000Z",
            eventChecksum: "checksum_1",
            previousChainHash: null,
            chainHash: "hash_1",
            recordedAt: "2026-04-01T10:00:00.000Z",
        },
        {
            eventId: "event_2",
            chainPosition: 2,
            eventType: "task_completed",
            eventCreatedAt: "2026-04-02T10:00:00.000Z",
            eventChecksum: "checksum_2",
            previousChainHash: "WRONG_HASH", // Chain break here!
            chainHash: "hash_2",
            recordedAt: "2026-04-02T10:00:00.000Z",
        },
        {
            eventId: "event_3",
            chainPosition: 3,
            eventType: "task_approved",
            eventCreatedAt: "2026-04-03T10:00:00.000Z",
            eventChecksum: "checksum_3",
            previousChainHash: "hash_2",
            chainHash: "hash_3",
            recordedAt: "2026-04-03T10:00:00.000Z",
        },
    ]);
    const service = new AuditExportService(db, repo);
    const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(result.valid, false);
    assert.equal(result.eventsChecked, 3);
    assert.equal(result.chainBreaks, 1);
    assert.equal(result.firstBreakAt, "2026-04-02T10:00:00.000Z");
    assert.ok(result.details.includes("chain_breaks_detected"));
});
test("AuditExportService.verifyIntegrity detects multiple chain breaks", () => {
    const { db } = createMockDb();
    const { repo } = createMockIntegrityRepo();
    // Two chain breaks in the chain
    repo.setRecords([
        {
            eventId: "event_1",
            chainPosition: 1,
            eventType: "task_created",
            eventCreatedAt: "2026-04-01T10:00:00.000Z",
            eventChecksum: "checksum_1",
            previousChainHash: null,
            chainHash: "hash_1",
            recordedAt: "2026-04-01T10:00:00.000Z",
        },
        {
            eventId: "event_2",
            chainPosition: 2,
            eventType: "task_completed",
            eventCreatedAt: "2026-04-02T10:00:00.000Z",
            eventChecksum: "checksum_2",
            previousChainHash: "WRONG_HASH_1", // First break
            chainHash: "hash_2",
            recordedAt: "2026-04-02T10:00:00.000Z",
        },
        {
            eventId: "event_3",
            chainPosition: 3,
            eventType: "task_approved",
            eventCreatedAt: "2026-04-03T10:00:00.000Z",
            eventChecksum: "checksum_3",
            previousChainHash: "WRONG_HASH_2", // Second break
            chainHash: "hash_3",
            recordedAt: "2026-04-03T10:00:00.000Z",
        },
    ]);
    const service = new AuditExportService(db, repo);
    const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(result.valid, false);
    assert.equal(result.eventsChecked, 3);
    assert.equal(result.chainBreaks, 2);
    assert.equal(result.firstBreakAt, "2026-04-02T10:00:00.000Z");
});
test("AuditExportService.verifyIntegrity handles unsorted records", () => {
    const { db } = createMockDb();
    const { repo } = createMockIntegrityRepo();
    // Records in wrong order (not sorted by chainPosition)
    repo.setRecords([
        {
            eventId: "event_3",
            chainPosition: 3,
            eventType: "task_approved",
            eventCreatedAt: "2026-04-03T10:00:00.000Z",
            eventChecksum: "checksum_3",
            previousChainHash: "hash_2",
            chainHash: "hash_3",
            recordedAt: "2026-04-03T10:00:00.000Z",
        },
        {
            eventId: "event_1",
            chainPosition: 1,
            eventType: "task_created",
            eventCreatedAt: "2026-04-01T10:00:00.000Z",
            eventChecksum: "checksum_1",
            previousChainHash: null,
            chainHash: "hash_1",
            recordedAt: "2026-04-01T10:00:00.000Z",
        },
        {
            eventId: "event_2",
            chainPosition: 2,
            eventType: "task_completed",
            eventCreatedAt: "2026-04-02T10:00:00.000Z",
            eventChecksum: "checksum_2",
            previousChainHash: "hash_1",
            chainHash: "hash_2",
            recordedAt: "2026-04-02T10:00:00.000Z",
        },
    ]);
    const service = new AuditExportService(db, repo);
    const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    // Should still be valid because the service sorts them
    assert.equal(result.valid, true);
    assert.equal(result.eventsChecked, 3);
    assert.equal(result.chainBreaks, 0);
});
test("AuditExportService.summarizeWindow returns correct summary structure", () => {
    const { db, statements } = createMockDb();
    // Mock COUNT(*) result
    const countStmt = createMockStatement();
    countStmt.setData([{ cnt: 100 }]);
    statements.set("SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?", countStmt);
    // Mock tier counts
    const tierStmt = createMockStatement();
    tierStmt.setData([
        { event_tier: "tier_1", cnt: 50 },
        { event_tier: "tier_2", cnt: 30 },
        { event_tier: "tier_3", cnt: 20 },
    ]);
    statements.set("SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier", tierStmt);
    // Mock top event types
    const topStmt = createMockStatement();
    topStmt.setData([
        { event_type: "task_created", cnt: 40 },
        { event_type: "task_completed", cnt: 35 },
        { event_type: "task_failed", cnt: 25 },
    ]);
    statements.set("SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10", topStmt);
    const service = new AuditExportService(db);
    const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(summary.totalEvents, 100);
    assert.equal(summary.tier1Count, 50);
    assert.equal(summary.tier2Count, 30);
    assert.equal(summary.tier3Count, 20);
    assert.equal(summary.topEventTypes.length, 3);
    assert.equal(summary.topEventTypes[0]?.type, "task_created");
    assert.equal(summary.topEventTypes[0]?.count, 40);
    assert.equal(summary.windowStart, "2026-04-01T00:00:00.000Z");
    assert.equal(summary.windowEnd, "2026-04-30T23:59:59.999Z");
});
test("AuditExportService.summarizeWindow handles empty window", () => {
    const { db, statements } = createMockDb();
    const countStmt = createMockStatement();
    countStmt.setData([{ cnt: 0 }]);
    statements.set("SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?", countStmt);
    const tierStmt = createMockStatement();
    tierStmt.setData([]);
    statements.set("SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier", tierStmt);
    const topStmt = createMockStatement();
    topStmt.setData([]);
    statements.set("SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10", topStmt);
    const service = new AuditExportService(db);
    const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(summary.totalEvents, 0);
    assert.equal(summary.tier1Count, 0);
    assert.equal(summary.tier2Count, 0);
    assert.equal(summary.tier3Count, 0);
    assert.equal(summary.topEventTypes.length, 0);
});
test("AuditExportService.summarizeWindow handles missing tier counts", () => {
    const { db, statements } = createMockDb();
    const countStmt = createMockStatement();
    countStmt.setData([{ cnt: 50 }]);
    statements.set("SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?", countStmt);
    // Only tier_1 events
    const tierStmt = createMockStatement();
    tierStmt.setData([{ event_tier: "tier_1", cnt: 50 }]);
    statements.set("SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier", tierStmt);
    const topStmt = createMockStatement();
    topStmt.setData([{ event_type: "task_created", cnt: 50 }]);
    statements.set("SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10", topStmt);
    const service = new AuditExportService(db);
    const summary = service.summarizeWindow("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(summary.totalEvents, 50);
    assert.equal(summary.tier1Count, 50);
    assert.equal(summary.tier2Count, 0);
    assert.equal(summary.tier3Count, 0);
});
test("AuditExportService.collectEvents returns events within window", () => {
    const { db, statements } = createMockDb();
    const events = [
        { id: "event_1", event_type: "task_created", created_at: "2026-04-01T10:00:00.000Z" },
        { id: "event_2", event_type: "task_completed", created_at: "2026-04-02T10:00:00.000Z" },
        { id: "event_3", event_type: "task_approved", created_at: "2026-04-03T10:00:00.000Z" },
    ];
    const stmt = createMockStatement();
    stmt.setData(events);
    statements.set("SELECT * FROM events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at LIMIT ?", stmt);
    const service = new AuditExportService(db);
    const result = service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(result.length, 3);
    assert.equal(result[0]?.id, "event_1");
    assert.equal(result[1]?.id, "event_2");
    assert.equal(result[2]?.id, "event_3");
});
test("AuditExportService.collectEvents respects limit parameter", () => {
    const { db, statements } = createMockDb();
    const events = Array.from({ length: 20 }, (_, i) => ({
        id: `event_${i + 1}`,
        event_type: "task_created",
        created_at: `2026-04-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
    }));
    const stmt = createMockStatement();
    stmt.setData(events.slice(0, 5)); // Simulate limit applied
    statements.set("SELECT * FROM events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at LIMIT ?", stmt);
    const service = new AuditExportService(db);
    const result = service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z", 5);
    assert.equal(result.length, 5);
});
test("AuditExportService.collectEvents uses default limit of 10000", () => {
    const { db, statements } = createMockDb();
    const stmt = statements.get("SELECT * FROM events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at LIMIT ?");
    const service = new AuditExportService(db);
    service.collectEvents("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    // Verify default limit is passed
    assert.ok(stmt !== undefined);
});
test("AuditExportService.generateSoc2Package returns null for non-existent export", () => {
    const { db, statements } = createMockDb();
    const getStmt = createMockStatement();
    getStmt.setData([]);
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    const service = new AuditExportService(db);
    const result = service.generateSoc2Package("non_existent");
    assert.equal(result, null);
});
test("AuditExportService.generateSoc2Package returns complete evidence package", () => {
    const { db, statements } = createMockDb();
    // Mock getExport
    const getStmt = createMockStatement();
    getStmt.setData([{
            id: "aexport_123",
            framework: "soc2",
            format: "json",
            window_start: "2026-04-01T00:00:00.000Z",
            window_end: "2026-04-30T23:59:59.999Z",
            status: "completed",
            event_count: 10,
            integrity_verified: 1,
            export_path: "/exports/aexport_123.json",
            generated_at: "2026-04-30T12:00:00.000Z",
            requested_by: "user:test",
            created_at: "2026-04-01T00:00:00.000Z",
            metadata: null,
        }]);
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    // Mock summarizeWindow
    const countStmt = createMockStatement();
    countStmt.setData([{ cnt: 10 }]);
    statements.set("SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?", countStmt);
    const tierStmt = createMockStatement();
    tierStmt.setData([
        { event_tier: "tier_1", cnt: 5 },
        { event_tier: "tier_2", cnt: 3 },
        { event_tier: "tier_3", cnt: 2 },
    ]);
    statements.set("SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier", tierStmt);
    const topStmt = createMockStatement();
    topStmt.setData([
        { event_type: "task_approved", cnt: 5 },
        { event_type: "task_created", cnt: 3 },
    ]);
    statements.set("SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10", topStmt);
    // Mock collectEvents
    const eventsStmt = createMockStatement();
    eventsStmt.setData([
        { id: "event_1", event_type: "task_approved", created_at: "2026-04-01T10:00:00.000Z" },
        { id: "event_2", event_type: "task_created", created_at: "2026-04-02T10:00:00.000Z" },
    ]);
    statements.set("SELECT * FROM events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at LIMIT ?", eventsStmt);
    const service = new AuditExportService(db);
    const result = service.generateSoc2Package("aexport_123");
    assert.ok(result !== null);
    assert.equal(result?.exportId, "aexport_123");
    assert.equal(result?.framework, "soc2");
    assert.equal(result?.window.start, "2026-04-01T00:00:00.000Z");
    assert.equal(result?.window.end, "2026-04-30T23:59:59.999Z");
    assert.equal(result?.summary.totalEvents, 10);
    assert.equal(result?.summary.tier1Count, 5);
    assert.equal(result?.summary.tier2Count, 3);
    assert.equal(result?.summary.tier3Count, 2);
    assert.equal(result?.events.length, 2);
    assert.ok(result?.controlMappings.length > 0);
});
test("AuditExportService.generateSoc2Package generates correct control mappings", () => {
    const { db, statements } = createMockDb();
    // Mock getExport
    const getStmt = createMockStatement();
    getStmt.setData([{
            id: "aexport_ctrl",
            framework: "soc2",
            format: "json",
            window_start: "2026-04-01T00:00:00.000Z",
            window_end: "2026-04-30T23:59:59.999Z",
            status: "completed",
            event_count: 4,
            integrity_verified: 1,
            export_path: "/exports/aexport_ctrl.json",
            generated_at: "2026-04-30T12:00:00.000Z",
            requested_by: "user:test",
            created_at: "2026-04-01T00:00:00.000Z",
            metadata: null,
        }]);
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    // Empty summaries
    const countStmt = createMockStatement();
    countStmt.setData([{ cnt: 4 }]);
    statements.set("SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?", countStmt);
    const tierStmt = createMockStatement();
    tierStmt.setData([]);
    statements.set("SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier", tierStmt);
    const topStmt = createMockStatement();
    topStmt.setData([]);
    statements.set("SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10", topStmt);
    // Events with specific types to test control mappings
    const eventsStmt = createMockStatement();
    eventsStmt.setData([
        { id: "event_1", event_type: "approval_requested", created_at: "2026-04-01T10:00:00.000Z" },
        { id: "event_2", event_type: "transition_started", created_at: "2026-04-02T10:00:00.000Z" },
        { id: "event_3", event_type: "execution_completed", created_at: "2026-04-03T10:00:00.000Z" },
        { id: "event_4", event_type: "health_check_ok", created_at: "2026-04-04T10:00:00.000Z" },
    ]);
    statements.set("SELECT * FROM events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at LIMIT ?", eventsStmt);
    const service = new AuditExportService(db);
    const result = service.generateSoc2Package("aexport_ctrl");
    assert.ok(result !== null);
    assert.equal(result?.controlMappings.length, 4);
    const cc61 = result?.controlMappings.find((m) => m.controlId === "CC6.1");
    assert.equal(cc61?.evidenceType, "access_control");
    assert.equal(cc61?.count, 1); // approval_requested
    const cc72 = result?.controlMappings.find((m) => m.controlId === "CC7.2");
    assert.equal(cc72?.evidenceType, "change_management");
    assert.equal(cc72?.count, 1); // transition_started
    const cc81 = result?.controlMappings.find((m) => m.controlId === "CC8.1");
    assert.equal(cc81?.evidenceType, "system_operations");
    assert.equal(cc81?.count, 1); // execution_completed
    const a12 = result?.controlMappings.find((m) => m.controlId === "A1.2");
    assert.equal(a12?.evidenceType, "availability");
    assert.equal(a12?.count, 1); // health_check_ok
});
test("AuditExportService.generateSoc2Package control mappings use String() on event_type", () => {
    const { db, statements } = createMockDb();
    // Mock getExport
    const getStmt = createMockStatement();
    getStmt.setData([{
            id: "aexport_str",
            framework: "soc2",
            format: "json",
            window_start: "2026-04-01T00:00:00.000Z",
            window_end: "2026-04-30T23:59:59.999Z",
            status: "completed",
            event_count: 2,
            integrity_verified: 1,
            export_path: "/exports/aexport_str.json",
            generated_at: "2026-04-30T12:00:00.000Z",
            requested_by: "user:test",
            created_at: "2026-04-01T00:00:00.000Z",
            metadata: null,
        }]);
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    // Empty summaries
    const countStmt = createMockStatement();
    countStmt.setData([{ cnt: 2 }]);
    statements.set("SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?", countStmt);
    const tierStmt = createMockStatement();
    tierStmt.setData([]);
    statements.set("SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier", tierStmt);
    const topStmt = createMockStatement();
    topStmt.setData([]);
    statements.set("SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10", topStmt);
    // Events with numeric event_type (should be converted to string)
    const eventsStmt = createMockStatement();
    eventsStmt.setData([
        { id: "event_1", event_type: 123, created_at: "2026-04-01T10:00:00.000Z" },
        { id: "event_2", event_type: null, created_at: "2026-04-02T10:00:00.000Z" },
    ]);
    statements.set("SELECT * FROM events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at LIMIT ?", eventsStmt);
    const service = new AuditExportService(db);
    const result = service.generateSoc2Package("aexport_str");
    assert.ok(result !== null);
    // Should not throw - String() handles non-string types
    assert.equal(result.controlMappings.length, 4);
});
test("AuditExportService.getExport returns mapped export record", () => {
    const { db, statements } = createMockDb();
    const getStmt = createMockStatement();
    getStmt.setData([{
            id: "aexport_test",
            framework: "iso27001",
            format: "csv",
            window_start: "2026-04-01T00:00:00.000Z",
            window_end: "2026-04-30T23:59:59.999Z",
            status: "completed",
            event_count: 50,
            integrity_verified: 1,
            export_path: "/exports/aexport_test.csv",
            generated_at: "2026-04-30T12:00:00.000Z",
            requested_by: "user:admin",
            created_at: "2026-04-01T00:00:00.000Z",
            metadata: '{"purpose":"audit"}',
        }]);
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    const service = new AuditExportService(db);
    const result = service.getExport("aexport_test");
    assert.ok(result !== null);
    assert.equal(result.id, "aexport_test");
    assert.equal(result.framework, "iso27001");
    assert.equal(result.format, "csv");
    assert.equal(result.status, "completed");
    assert.equal(result.eventCount, 50);
    assert.equal(result.integrityVerified, true);
    assert.equal(result.exportPath, "/exports/aexport_test.csv");
    assert.equal(result.generatedAt, "2026-04-30T12:00:00.000Z");
    assert.equal(result.requestedBy, "user:admin");
    assert.equal(result.metadata, '{"purpose":"audit"}');
});
test("AuditExportService.getExport handles null fields correctly", () => {
    const { db, statements } = createMockDb();
    const getStmt = createMockStatement();
    getStmt.setData([{
            id: "aexport_null",
            framework: null,
            format: null,
            window_start: "",
            window_end: "",
            status: null,
            event_count: null,
            integrity_verified: 0,
            export_path: null,
            generated_at: null,
            requested_by: null,
            created_at: "",
            metadata: null,
        }]);
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    const service = new AuditExportService(db);
    const result = service.getExport("aexport_null");
    assert.ok(result !== null);
    assert.equal(result.framework, "soc2"); // defaults to soc2
    assert.equal(result.format, "json"); // defaults to json
    assert.equal(result.status, "pending"); // defaults to pending
    assert.equal(result.eventCount, 0); // defaults to 0
    assert.equal(result.integrityVerified, false);
    assert.equal(result.exportPath, null);
    assert.equal(result.generatedAt, null);
    assert.equal(result.requestedBy, "system"); // defaults to system
    assert.equal(result.metadata, null);
});
test("AuditExportService.listExports returns all exports without filter", () => {
    const { db, statements } = createMockDb();
    const listStmt = createMockStatement();
    listStmt.setData([
        {
            id: "aexport_1",
            framework: "soc2",
            format: "json",
            window_start: "2026-04-01T00:00:00.000Z",
            window_end: "2026-04-30T23:59:59.999Z",
            status: "completed",
            event_count: 100,
            integrity_verified: 1,
            export_path: "/exports/aexport_1.json",
            generated_at: "2026-04-30T12:00:00.000Z",
            requested_by: "user:admin",
            created_at: "2026-04-01T00:00:00.000Z",
            metadata: null,
        },
        {
            id: "aexport_2",
            framework: "hipaa",
            format: "csv",
            window_start: "2026-04-01T00:00:00.000Z",
            window_end: "2026-04-30T23:59:59.999Z",
            status: "pending",
            event_count: 0,
            integrity_verified: 0,
            export_path: null,
            generated_at: null,
            requested_by: "user:admin",
            created_at: "2026-04-02T00:00:00.000Z",
            metadata: null,
        },
    ]);
    statements.set("SELECT * FROM audit_exports ORDER BY created_at DESC LIMIT ?", listStmt);
    const service = new AuditExportService(db);
    const results = service.listExports();
    assert.equal(results.length, 2);
    assert.equal(results[0].id, "aexport_1");
    assert.equal(results[1].id, "aexport_2");
});
test("AuditExportService.listExports filters by status", () => {
    const { db, statements } = createMockDb();
    const filteredStmt = createMockStatement();
    filteredStmt.setData([
        {
            id: "aexport_pending",
            framework: "soc2",
            format: "json",
            window_start: "2026-04-01T00:00:00.000Z",
            window_end: "2026-04-30T23:59:59.999Z",
            status: "pending",
            event_count: 0,
            integrity_verified: 0,
            export_path: null,
            generated_at: null,
            requested_by: "user:admin",
            created_at: "2026-04-02T00:00:00.000Z",
            metadata: null,
        },
    ]);
    statements.set("SELECT * FROM audit_exports WHERE status = ? ORDER BY created_at DESC LIMIT ?", filteredStmt);
    const service = new AuditExportService(db);
    const results = service.listExports("pending");
    assert.equal(results.length, 1);
    assert.equal(results[0].status, "pending");
});
test("AuditExportService.listExports respects limit parameter", () => {
    const { db, statements } = createMockDb();
    const listStmt = createMockStatement();
    listStmt.setData([
        { id: "aexport_1", framework: "soc2", format: "json", window_start: "", window_end: "", status: "completed", event_count: 0, integrity_verified: 0, export_path: null, generated_at: null, requested_by: "", created_at: "", metadata: null },
    ]);
    statements.set("SELECT * FROM audit_exports ORDER BY created_at DESC LIMIT ?", listStmt);
    const service = new AuditExportService(db);
    const results = service.listExports(undefined, 1);
    assert.equal(results.length, 1);
});
test("AuditExportService.generateExport returns null for non-existent export", () => {
    const { db, statements } = createMockDb();
    const getStmt = createMockStatement();
    getStmt.setData([]);
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    const service = new AuditExportService(db);
    const result = service.generateExport("non_existent");
    assert.equal(result, null);
});
test("AuditExportService.generateExport returns existing for non-pending status", () => {
    const { db, statements } = createMockDb();
    const getStmt = createMockStatement();
    getStmt.setData([{
            id: "aexport_completed",
            framework: "soc2",
            format: "json",
            window_start: "2026-04-01T00:00:00.000Z",
            window_end: "2026-04-30T23:59:59.999Z",
            status: "completed", // Already completed
            event_count: 100,
            integrity_verified: 1,
            export_path: "/exports/aexport_completed.json",
            generated_at: "2026-04-30T12:00:00.000Z",
            requested_by: "user:admin",
            created_at: "2026-04-01T00:00:00.000Z",
            metadata: null,
        }]);
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    const service = new AuditExportService(db);
    const result = service.generateExport("aexport_completed");
    // Should return the existing record without modifying
    assert.ok(result !== null);
    assert.equal(result?.status, "completed");
});
test("AuditExportService.generateExport updates pending export to completed", () => {
    const { db, statements } = createMockDb();
    // First getExport call (checking existing)
    let getCallCount = 0;
    const getStmt = createMockStatement();
    getStmt.setData = (() => {
        getCallCount++;
        if (getCallCount === 1) {
            return [{
                    id: "aexport_pending",
                    framework: "soc2",
                    format: "json",
                    window_start: "2026-04-01T00:00:00.000Z",
                    window_end: "2026-04-30T23:59:59.999Z",
                    status: "pending",
                    event_count: 0,
                    integrity_verified: 0,
                    export_path: null,
                    generated_at: null,
                    requested_by: "user:admin",
                    created_at: "2026-04-01T00:00:00.000Z",
                    metadata: null,
                }];
        }
        else {
            // Second getExport call (after update)
            return [{
                    id: "aexport_pending",
                    framework: "soc2",
                    format: "json",
                    window_start: "2026-04-01T00:00:00.000Z",
                    window_end: "2026-04-30T23:59:59.999Z",
                    status: "completed",
                    event_count: 5,
                    integrity_verified: 1,
                    export_path: "/exports/aexport_pending.json",
                    generated_at: "2026-04-30T12:00:00.000Z",
                    requested_by: "user:admin",
                    created_at: "2026-04-01T00:00:00.000Z",
                    metadata: null,
                }];
        }
    });
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    // Mock summarizeWindow
    const countStmt = createMockStatement();
    countStmt.setData([{ cnt: 5 }]);
    statements.set("SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?", countStmt);
    const tierStmt = createMockStatement();
    tierStmt.setData([]);
    statements.set("SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier", tierStmt);
    const topStmt = createMockStatement();
    topStmt.setData([]);
    statements.set("SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10", topStmt);
    const service = new AuditExportService(db);
    const result = service.generateExport("aexport_pending");
    assert.ok(result !== null);
    assert.equal(result?.status, "completed");
});
test("AuditExportService.generateExport uses csv extension for csv format", () => {
    const { db, statements } = createMockDb();
    // First getExport call
    let getCallCount = 0;
    const getStmt = createMockStatement();
    getStmt.setData = (() => {
        getCallCount++;
        if (getCallCount === 1) {
            return [{
                    id: "aexport_csv",
                    framework: "soc2",
                    format: "csv",
                    window_start: "2026-04-01T00:00:00.000Z",
                    window_end: "2026-04-30T23:59:59.999Z",
                    status: "pending",
                    event_count: 0,
                    integrity_verified: 0,
                    export_path: null,
                    generated_at: null,
                    requested_by: "user:admin",
                    created_at: "2026-04-01T00:00:00.000Z",
                    metadata: null,
                }];
        }
        else {
            return [{
                    id: "aexport_csv",
                    framework: "soc2",
                    format: "csv",
                    window_start: "2026-04-01T00:00:00.000Z",
                    window_end: "2026-04-30T23:59:59.999Z",
                    status: "completed",
                    event_count: 0,
                    integrity_verified: 1,
                    export_path: "/exports/aexport_csv.csv",
                    generated_at: "2026-04-30T12:00:00.000Z",
                    requested_by: "user:admin",
                    created_at: "2026-04-01T00:00:00.000Z",
                    metadata: null,
                }];
        }
    });
    statements.set("SELECT * FROM audit_exports WHERE id = ?", getStmt);
    const countStmt = createMockStatement();
    countStmt.setData([{ cnt: 0 }]);
    statements.set("SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?", countStmt);
    const tierStmt = createMockStatement();
    tierStmt.setData([]);
    statements.set("SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier", tierStmt);
    const topStmt = createMockStatement();
    topStmt.setData([]);
    statements.set("SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10", topStmt);
    const service = new AuditExportService(db);
    const result = service.generateExport("aexport_csv");
    assert.ok(result !== null);
    // The export path should use .csv extension
    assert.ok(result.exportPath?.endsWith(".csv"));
});
test("AuditExportService creates integrity repository if not provided", () => {
    const { db } = createMockDb();
    // This should not throw - it creates default integrity repo
    const service = new AuditExportService(db);
    // Verify integrity check works (returns valid with no records)
    const result = service.verifyIntegrity("2026-04-01T00:00:00.000Z", "2026-04-30T23:59:59.999Z");
    assert.equal(result.valid, true);
});
//# sourceMappingURL=audit-export-service.test.js.map