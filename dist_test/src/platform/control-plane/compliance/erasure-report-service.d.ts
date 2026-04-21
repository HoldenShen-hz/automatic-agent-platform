/**
 * @fileoverview Erasure Report Service - GDPR Right-to-Erasure compliance reporting
 *
 * ## Overview
 *
 * Generates compliance reports after data erasure requests are completed.
 * Reports include crypto-shredding verification, data lineage tracking,
 * and evidence references for audit purposes.
 *
 * ## Report Structure
 *
 * Each ErasureReport contains:
 * - Request reference and tenant information
 * - List of subjects erased
 * - Evidence references to DEK destruction events
 * - trace_id for lineage tracking
 * - Verification status of crypto-shredding
 *
 * ## Key Concepts
 *
 * - **Crypto-shredding verification**: Confirmation that DEKs were destroyed
 * - **Evidence chain**: Linked references to all destruction events
 * - **Compliance timeline**: Complete audit trail from request to completion
 *
 * @see GDPR Article 17: Right to erasure ('right to be forgotten')
 * @see docs_zh/architecture/00-platform-architecture.md
 *
 * @packageDocumentation
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ComplianceStore } from "./types.js";
import type { ErasureRequest } from "./erasure-request-service.js";
/**
 * Type of data subject in an erasure report
 */
export type ReportSubjectType = "user" | "workspace" | "tenant" | "execution" | "task" | "custom";
/**
 * Individual subject record within an erasure report
 */
export interface ErasureSubject {
    /** Subject type */
    subjectType: ReportSubjectType;
    /** Subject identifier */
    subjectId: string;
    /** Categories of data erased */
    dataCategories: readonly string[];
    /** Whether the subject was successfully erased */
    erased: boolean;
    /** Error message if erasure failed */
    errorMessage?: string;
}
/**
 * Evidence reference for erasure verification
 */
export interface ReportEvidenceRef {
    /** Type of evidence (e.g., "dek_destruction", "data_purge", "key_rotation") */
    evidenceType: string;
    /** Reference identifier */
    referenceId: string;
    /** Description of the evidence */
    description: string;
    /** Timestamp when evidence was recorded */
    timestamp: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Erasure report record stored in the database
 */
export interface ErasureReport {
    /** Unique identifier for the report */
    reportId: string;
    /** Reference to the erasure request */
    erasureId: string;
    /** Tenant identifier */
    tenantId: string;
    /** List of subjects covered by this report */
    subjects: readonly ErasureSubject[];
    /** Evidence references for verification */
    evidenceRefs: readonly ReportEvidenceRef[];
    /** Trace ID for lineage tracking across services */
    traceId: string;
    /** Verification status of crypto-shredding */
    verificationStatus: "pending" | "verified" | "failed";
    /** Timestamp when verification was performed */
    verifiedAt: string | null;
    /** ISO timestamp when report was generated */
    generatedAt: string;
    /** ISO timestamp when report was last updated */
    updatedAt: string;
    /** Notes or comments on the report */
    notes: string | null;
    /** Metadata JSON for additional context */
    metadataJson: string | null;
}
/**
 * Input for generating an erasure report
 */
export interface GenerateErasureReportInput {
    /** Reference to the erasure request */
    erasureId: string;
    /** List of subjects erased */
    subjects: readonly ErasureSubject[];
    /** Evidence references for verification */
    evidenceRefs: readonly ReportEvidenceRef[];
    /** Trace ID for lineage tracking */
    traceId: string;
    /** Notes or comments */
    notes?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Summary of crypto-shredding verification results
 */
export interface CryptoShreddingVerificationSummary {
    /** Total DEKs destroyed */
    totalDekDestroyed: number;
    /** DEKs successfully verified as destroyed */
    verifiedDekDestroyed: number;
    /** DEKs that failed verification */
    failedDekDestroyed: number;
    /** Overall verification status */
    status: "verified" | "partial" | "failed";
    /** Detailed verification messages */
    messages: readonly string[];
}
/**
 * Service for generating and managing GDPR Right-to-Erasure compliance reports.
 *
 * Handles report generation after erasure completion, crypto-shredding
 * verification, and audit trail documentation.
 *
 * ## Usage
 *
 * ```typescript
 * const reportService = new ErasureReportService(db, store);
 *
 * // Generate report after erasure completion
 * const report = reportService.generateReport({
 *   erasureId: "erasure_abc123",
 *   subjects: [
 *     { subjectType: "user", subjectId: "user-456", dataCategories: ["profile", "activities"], erased: true },
 *   ],
 *   evidenceRefs: [
 *     { evidenceType: "dek_destruction", referenceId: "key-001", description: "User DEK destroyed", timestamp: nowIso() },
 *   ],
 *   traceId: "trace_xyz789",
 * });
 *
 * // Verify crypto-shredding
 * const verification = reportService.verifyCryptoShredding(report.reportId);
 *
 * // Get report
 * const existing = reportService.getReport(report.reportId);
 * ```
 */
export declare class ErasureReportService {
    private readonly db;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore & {
        compliance: ComplianceStore;
    });
    /**
     * Generates an erasure compliance report.
     *
     * Creates a report linking the erasure request to its evidence and
     * verification status for compliance documentation.
     *
     * @param input - Report generation details
     * @returns The generated erasure report
     * @throws StorageError if erasure request not found
     */
    generateReport(input: GenerateErasureReportInput): ErasureReport;
    /**
     * Retrieves an erasure report by ID.
     *
     * @param reportId - The report identifier
     * @returns The report or null if not found
     */
    getReport(reportId: string): ErasureReport | null;
    /**
     * Lists all erasure reports for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns Array of reports sorted by generation date (newest first)
     */
    listReportsByTenant(tenantId: string): ErasureReport[];
    /**
     * Lists all erasure reports for an erasure request.
     *
     * @param erasureId - The erasure request identifier
     * @returns Array of reports for the erasure request
     */
    listReportsByErasureId(erasureId: string): ErasureReport[];
    /**
     * Verifies crypto-shredding for an erasure report.
     *
     * Checks that all DEKs referenced in evidence refs were properly destroyed
     * and updates the verification status of the report.
     *
     * @param reportId - The report identifier
     * @returns Verification summary
     * @throws StorageError if report not found
     */
    verifyCryptoShredding(reportId: string): CryptoShreddingVerificationSummary;
    /**
     * Gets the erasure request associated with a report.
     *
     * @param reportId - The report identifier
     * @returns The erasure request or null if not found
     */
    getErasureRequestForReport(reportId: string): ErasureRequest | null;
    /**
     * Lists reports by verification status for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @param status - The verification status to filter by
     * @returns Array of matching reports
     */
    listReportsByVerificationStatus(tenantId: string, status: "pending" | "verified" | "failed"): ErasureReport[];
    /**
     * Updates the notes on an erasure report.
     *
     * @param reportId - The report identifier
     * @param notes - New notes content
     * @returns The updated report
     * @throws StorageError if report not found
     */
    updateReportNotes(reportId: string, notes: string): ErasureReport;
}
