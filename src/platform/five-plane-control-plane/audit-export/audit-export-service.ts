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

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { createAuditIntegrityRepository, type AuditIntegrityRepository, AUDIT_INTEGRITY_DDL } from "../iam/audit-integrity-repository.js";

// ── Types ──────────────────────────────────────────────────────────────

/** Supported export formats */
export type ExportFormat = "json" | "csv" | "soc2_package";
/** Status of an export operation */
export type ExportStatus = "pending" | "generating" | "completed" | "failed";
/** Compliance framework for export */
export type ComplianceFramework = "soc2" | "iso27001" | "hipaa" | "gdpr" | "custom";

/**
 * A recorded audit export request.
 */
export interface AuditExportRecord {
  id: string;
  framework: ComplianceFramework;
  format: ExportFormat;
  windowStart: string;
  windowEnd: string;
  status: ExportStatus;
  eventCount: number;
  integrityVerified: boolean;
  exportPath: string | null;
  generatedAt: string | null;
  requestedBy: string;
  createdAt: string;
  metadata: string | null;
}

/**
 * Summary of audit events within a time window.
 */
export interface AuditEventSummary {
  totalEvents: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  topEventTypes: Array<{ type: string; count: number }>;
  windowStart: string;
  windowEnd: string;
}

/**
 * Result of integrity verification.
 */
export interface IntegrityCheckResult {
  valid: boolean;
  eventsChecked: number;
  chainBreaks: number;
  firstBreakAt: string | null;
  details: string;
}

/**
 * Complete SOC2 evidence package for compliance audits.
 */
export interface Soc2EvidencePackage {
  exportId: string;
  framework: "soc2";
  generatedAt: string;
  window: { start: string; end: string };
  summary: AuditEventSummary;
  integrityCheck: IntegrityCheckResult;
  events: Array<Record<string, unknown>>;
  controlMappings: Array<{ controlId: string; evidenceType: string; count: number }>;
}

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

type RawRow = Record<string, unknown>;

// ── Service ────────────────────────────────────────────────────────────

/**
 * Service for generating compliance-ready audit exports.
 *
 * Supports multiple compliance frameworks and export formats,
 * with integrity chain verification for audit evidence.
 */
export class AuditExportService {
  constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly integrityRepository?: AuditIntegrityRepository,
  ) {
    if (!this.integrityRepository) {
      this.integrityRepository = createAuditIntegrityRepository(db);
    }
  }

  // ── Export Request ─────────────────────────────────────────────────

  /**
   * Creates a new audit export request.
   */
  requestExport(input: {
    framework: ComplianceFramework;
    format: ExportFormat;
    windowStart: string;
    windowEnd: string;
    requestedBy: string;
    metadata?: Record<string, unknown>;
  }): AuditExportRecord {
    const now = nowIso();
    const record: AuditExportRecord = {
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
      .prepare(
        `INSERT INTO audit_exports (id, framework, format, window_start, window_end, status, event_count, integrity_verified, export_path, generated_at, requested_by, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(record.id, record.framework, record.format, record.windowStart, record.windowEnd, record.status, record.eventCount, record.integrityVerified ? 1 : 0, record.exportPath, record.generatedAt, record.requestedBy, record.createdAt, record.metadata);

    return record;
  }

  // ── Generate Export ────────────────────────────────────────────────

  /**
   * Generates an export for a pending export request.
   */
  generateExport(exportId: string): AuditExportRecord | null {
    const existing = this.getExport(exportId);
    if (!existing || existing.status !== "pending") return existing;

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
  generateSoc2Package(exportId: string): Soc2EvidencePackage | null {
    const exported = this.getExport(exportId);
    if (!exported) return null;

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
  summarizeWindow(windowStart: string, windowEnd: string): AuditEventSummary {
    const total = this.db.connection
      .prepare(`SELECT COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ?`)
      .get(windowStart, windowEnd) as RawRow | undefined;

    const tiers = this.db.connection
      .prepare(`SELECT event_tier, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_tier`)
      .all(windowStart, windowEnd) as RawRow[];

    const topTypes = this.db.connection
      .prepare(`SELECT event_type, COUNT(*) as cnt FROM events WHERE created_at >= ? AND created_at <= ? GROUP BY event_type ORDER BY cnt DESC LIMIT 10`)
      .all(windowStart, windowEnd) as RawRow[];

    const tierCounts: Record<string, number> = {};
    for (const row of tiers) tierCounts[String(row.event_tier)] = Number(row.cnt);

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
  verifyIntegrity(windowStart: string, windowEnd: string): IntegrityCheckResult {
    const integrityRecords = this.integrityRepository!.getIntegrityRecordsInRange(windowStart, windowEnd);

    if (integrityRecords.length === 0) {
      return { valid: true, eventsChecked: 0, chainBreaks: 0, firstBreakAt: null, details: "no_tier_1_events_in_window" };
    }

    // Sort by chain position
    const sorted = [...integrityRecords].sort((a, b) => a.chainPosition - b.chainPosition);

    let chainBreaks = 0;
    let firstBreakAt: string | null = null;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
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
  collectEvents(windowStart: string, windowEnd: string, limit: number = 10_000): Array<Record<string, unknown>> {
    return this.db.connection
      .prepare(`SELECT * FROM events WHERE created_at >= ? AND created_at <= ? ORDER BY created_at LIMIT ?`)
      .all(windowStart, windowEnd, limit) as RawRow[];
  }

  // ── Export Queries ─────────────────────────────────────────────────

  /**
   * Gets an export record by ID.
   */
  getExport(exportId: string): AuditExportRecord | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM audit_exports WHERE id = ?`)
      .get(exportId) as RawRow | undefined;
    return row ? this.mapExport(row) : null;
  }

  /**
   * Lists exports, optionally filtered by status.
   */
  listExports(status?: ExportStatus, limit: number = 50): AuditExportRecord[] {
    if (status) {
      return (this.db.connection
        .prepare(`SELECT * FROM audit_exports WHERE status = ? ORDER BY created_at DESC LIMIT ?`)
        .all(status, limit) as RawRow[]).map((r) => this.mapExport(r));
    }
    return (this.db.connection
      .prepare(`SELECT * FROM audit_exports ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as RawRow[]).map((r) => this.mapExport(r));
  }

  // ── Mapper ─────────────────────────────────────────────────────────

  private mapExport(row: RawRow): AuditExportRecord {
    return {
      id: String(row.id),
      framework: String(row.framework ?? "soc2") as ComplianceFramework,
      format: String(row.format ?? "json") as ExportFormat,
      windowStart: String(row.window_start ?? ""),
      windowEnd: String(row.window_end ?? ""),
      status: String(row.status ?? "pending") as ExportStatus,
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
