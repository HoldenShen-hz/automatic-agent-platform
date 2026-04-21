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
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type AuditIntegrityRepository } from "../iam/audit-integrity-repository.js";
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
    topEventTypes: Array<{
        type: string;
        count: number;
    }>;
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
    window: {
        start: string;
        end: string;
    };
    summary: AuditEventSummary;
    integrityCheck: IntegrityCheckResult;
    events: Array<Record<string, unknown>>;
    controlMappings: Array<{
        controlId: string;
        evidenceType: string;
        count: number;
    }>;
}
export declare const AUDIT_EXPORT_DDL = "\nCREATE TABLE IF NOT EXISTS audit_exports (\n  id TEXT PRIMARY KEY,\n  framework TEXT NOT NULL DEFAULT 'soc2',\n  format TEXT NOT NULL DEFAULT 'json',\n  window_start TEXT NOT NULL,\n  window_end TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'pending',\n  event_count INTEGER NOT NULL DEFAULT 0,\n  integrity_verified INTEGER NOT NULL DEFAULT 0,\n  export_path TEXT NULL,\n  generated_at TEXT NULL,\n  requested_by TEXT NOT NULL DEFAULT 'system',\n  created_at TEXT NOT NULL,\n  metadata TEXT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_audit_exports_status ON audit_exports(status, created_at);\n";
/**
 * Service for generating compliance-ready audit exports.
 *
 * Supports multiple compliance frameworks and export formats,
 * with integrity chain verification for audit evidence.
 */
export declare class AuditExportService {
    private readonly db;
    private readonly integrityRepository?;
    constructor(db: AuthoritativeSqlDatabase, integrityRepository?: AuditIntegrityRepository | undefined);
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
    }): AuditExportRecord;
    /**
     * Generates an export for a pending export request.
     */
    generateExport(exportId: string): AuditExportRecord | null;
    /**
     * Generates a complete SOC2 evidence package for an export.
     */
    generateSoc2Package(exportId: string): Soc2EvidencePackage | null;
    /**
     * Generates a summary of audit events within a time window.
     */
    summarizeWindow(windowStart: string, windowEnd: string): AuditEventSummary;
    /**
     * Verifies the integrity chain of tier-1 events within a time window.
     *
     * Uses the audit_integrity_records table (hash chain) to detect any
     * tampering or gaps in the audit trail.
     */
    verifyIntegrity(windowStart: string, windowEnd: string): IntegrityCheckResult;
    /**
     * Collects all audit events within a time window.
     */
    collectEvents(windowStart: string, windowEnd: string, limit?: number): Array<Record<string, unknown>>;
    /**
     * Gets an export record by ID.
     */
    getExport(exportId: string): AuditExportRecord | null;
    /**
     * Lists exports, optionally filtered by status.
     */
    listExports(status?: ExportStatus, limit?: number): AuditExportRecord[];
    private mapExport;
}
