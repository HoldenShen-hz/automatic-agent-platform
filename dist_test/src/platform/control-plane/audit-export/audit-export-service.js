/**
 * Audit Chain Compliance Export Service
 *
 * Provides:
 * - SOC2 / ISO 27001 evidence package generation
 * - Audit event export in compliance-ready formats (JSON, CSV)
 * - Integrity chain verification for export windows
 * - External audit system integration seam
 *
 * @see docs_zh/contracts/audit_lineage_and_retention_contract.md
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import { createAuditIntegrityRepository } from "../iam/audit-integrity-repository.js";
// ── DDL ────────────────────────────────────────────────────────────────
export const AUDIT_EXPORT_DDL = `
CREATE TABLE IF NOT EXISTS audit_exports (
  id TEXT PRIMARY KEY,
  framework TEXT NOT NULL DEFAULT 'soc2',
  format TEXT NOT NULL DEFAULT 'json',
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  event_count INTEGER NOT NULL DEFAULT 0,
  integrity_verified INTEGER NOT NULL DEFAULT 0,
  export_path TEXT NULL,
  generated_at TEXT NULL,
  requested_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL,
  metadata TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_exports_status ON audit_exports(status, created_at);
`;
// ── Service ────────────────────────────────────────────────────────────
/**
 * Service for generating compliance-ready audit exports.
 *
 * Supports multiple compliance frameworks and export formats,
 * with integrity chain verification for audit evidence.
 */
export class AuditExportService {
    db;
    integrityRepository;
    constructor(db, integrityRepository) {
        this.db = db;
        this.integrityRepository = integrityRepository;
        if (!this.integrityRepository) {
            this.integrityRepository = createAuditIntegrityRepository(db);
        }
    }
    // ── Export Request ─────────────────────────────────────────────────
    /**
     * Creates a new audit export request.
     */
    requestExport(input) {
        const now = nowIso();
        const record = {
            id: newId("aexport"),
            framework: input.framework,
            format: input.format,
            windowStart: input.windowStart,
            windowEnd: input.windowEnd,
            status: "pending",
            eventCount: 0,
            integrityVerified: false,
            exportPath: null,
            generatedAt: null,
            requestedBy: input.requestedBy,
            createdAt: now,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        };
        this.db.connection
            .prepare(`INSERT INTO audit_exports (id, framework, format, window_start, window_end, status, event_count, integrity_verified, export_path, generated_at, requested_by, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(record.id, record.framework, record.format, record.windowStart, record.windowEnd, record.status, record.eventCount, record.integrityVerified ? 1 : 0, record.exportPath, record.generatedAt, record.requestedBy, record.createdAt, record.metadata);
        return record;
    }
    // ── Generate Export ────────────────────────────────────────────────
    /**
     * Generates an export for a pending export request.
     */
    generateExport(exportId) {
        const existing = this.getExport(exportId);
        if (!existing || existing.status !== "pending")
            return existing;
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE audit_exports SET status = 'generating' WHERE id = ?`)
            .run(exportId);
        // Collect audit events from the window
        const summary = this.summarizeWindow(existing.windowStart, existing.windowEnd);
        const integrityCheck = this.verifyIntegrity(existing.windowStart, existing.windowEnd);
        const exportPath = `exports/${exportId}.${existing.format === "csv" ? "csv" : "json"}`;
        this.db.connection
            .prepare(`UPDATE audit_exports SET status = 'completed', event_count = ?, integrity_verified = ?, export_path = ?, generated_at = ? WHERE id = ?`)
            .run(summary.totalEvents, integrityCheck.valid ? 1 : 0, exportPath, now, exportId);
        return this.getExport(exportId);
    }
    // ── SOC2 Evidence Package ──────────────────────────────────────────
    /**
     * Generates a complete SOC2 evidence package for an export.
     */
    generateSoc2Package(exportId) {
        const exported = this.getExport(exportId);
        if (!exported)
            return null;
        const summary = this.summarizeWindow(exported.windowStart, exported.windowEnd);
        const integrityCheck = this.verifyIntegrity(exported.windowStart, exported.windowEnd);
        const events = this.collectEvents(exported.windowStart, exported.windowEnd);
        const controlMappings = [
            { controlId: "CC6.1", evidenceType: "access_control", count: events.filter((e) => String(e.event_type ?? "").includes("approval")).length },
            { controlId: "CC7.2", evidenceType: "change_management", count: events.filter((e) => String(e.event_type ?? "").includes("transition")).length },
            { controlId: "CC8.1", evidenceType: "system_operations", count: events.filter((e) => String(e.event_type ?? "").includes("execution")).length },
            { controlId: "A1.2", evidenceType: "availability", count: events.filter((e) => String(e.event_type ?? "").includes("health")).length },
        ];
        return {
            exportId,
            framework: "soc2",
            generatedAt: nowIso(),
            window: { start: exported.windowStart, end: exported.windowEnd },
            summary,
            integrityCheck,
            events,
            controlMappings,
        };
    }
    // ── Window Summary ─────────────────────────────────────────────────
    /**
     * Generates a summary of audit events within a time window.
     */
    summarizeWindow(windowStart, windowEnd) {
        const total = this.db.connection
            .prepare(`SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?`)
            .get(windowStart, windowEnd);
        const tiers = this.db.connection
            .prepare(`SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier`)
            .all(windowStart, windowEnd);
        const topTypes = this.db.connection
            .prepare(`SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10`)
            .all(windowStart, windowEnd);
        const tierCounts = {};
        for (const row of tiers)
            tierCounts[String(row.event_tier)] = Number(row.cnt);
        return {
            totalEvents: Number(total?.cnt ?? 0),
            tier1Count: tierCounts["tier_1"] ?? 0,
            tier2Count: tierCounts["tier_2"] ?? 0,
            tier3Count: tierCounts["tier_3"] ?? 0,
            topEventTypes: topTypes.map((r) => ({ type: String(r.event_type), count: Number(r.cnt) })),
            windowStart,
            windowEnd,
        };
    }
    // ── Integrity Verification ─────────────────────────────────────────
    /**
     * Verifies the integrity chain of tier-1 events within a time window.
     *
     * Uses the audit_integrity_records table (hash chain) to detect any
     * tampering or gaps in the audit trail.
     */
    verifyIntegrity(windowStart, windowEnd) {
        const integrityRecords = this.integrityRepository.getIntegrityRecordsInRange(windowStart, windowEnd);
        if (integrityRecords.length === 0) {
            return { valid: true, eventsChecked: 0, chainBreaks: 0, firstBreakAt: null, details: "no_tier_1_events_in_window" };
        }
        // Sort by chain position
        const sorted = [...integrityRecords].sort((a, b) => a.chainPosition - b.chainPosition);
        let chainBreaks = 0;
        let firstBreakAt = null;
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            if (prev.chainHash !== curr.previousChainHash) {
                chainBreaks++;
                if (!firstBreakAt) {
                    firstBreakAt = curr.eventCreatedAt;
                }
            }
        }
        return {
            valid: chainBreaks === 0,
            eventsChecked: integrityRecords.length,
            chainBreaks,
            firstBreakAt,
            details: chainBreaks === 0 ? "integrity_chain_valid" : `${chainBreaks}_chain_breaks_detected`,
        };
    }
    // ── Event Collection ───────────────────────────────────────────────
    /**
     * Collects all audit events within a time window.
     */
    collectEvents(windowStart, windowEnd, limit = 10_000) {
        return this.db.connection
            .prepare(`SELECT * FROM events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at LIMIT ?`)
            .all(windowStart, windowEnd, limit);
    }
    // ── Export Queries ─────────────────────────────────────────────────
    /**
     * Gets an export record by ID.
     */
    getExport(exportId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM audit_exports WHERE id = ?`)
            .get(exportId);
        return row ? this.mapExport(row) : null;
    }
    /**
     * Lists exports, optionally filtered by status.
     */
    listExports(status, limit = 50) {
        if (status) {
            return this.db.connection
                .prepare(`SELECT * FROM audit_exports WHERE status = ? ORDER BY created_at DESC LIMIT ?`)
                .all(status, limit).map((r) => this.mapExport(r));
        }
        return this.db.connection
            .prepare(`SELECT * FROM audit_exports ORDER BY created_at DESC LIMIT ?`)
            .all(limit).map((r) => this.mapExport(r));
    }
    // ── Mapper ─────────────────────────────────────────────────────────
    mapExport(row) {
        return {
            id: String(row.id),
            framework: String(row.framework ?? "soc2"),
            format: String(row.format ?? "json"),
            windowStart: String(row.window_start ?? ""),
            windowEnd: String(row.window_end ?? ""),
            status: String(row.status ?? "pending"),
            eventCount: Number(row.event_count ?? 0),
            integrityVerified: Boolean(row.integrity_verified),
            exportPath: row.export_path != null ? String(row.export_path) : null,
            generatedAt: row.generated_at != null ? String(row.generated_at) : null,
            requestedBy: String(row.requested_by ?? "system"),
            createdAt: String(row.created_at ?? ""),
            metadata: row.metadata != null ? String(row.metadata) : null,
        };
    }
}
//# sourceMappingURL=audit-export-service.js.map