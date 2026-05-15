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

import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError, StorageError } from "../../contracts/errors.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
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
 * Store type with compliance submodule
 */
type StoreWithCompliance = AuthoritativeTaskStore & {
  compliance: ComplianceStore;
};

/**
 * Validates an erasure report input
 */
function validateReportInput(input: GenerateErasureReportInput): void {
  if (!input.erasureId || input.erasureId.trim().length === 0) {
    throw new ValidationError("erasure.report.invalid_erasure_id", "Erasure ID is required", {
      details: { erasureId: input.erasureId },
    });
  }
  if (!input.traceId || input.traceId.trim().length === 0) {
    throw new ValidationError("erasure.report.invalid_trace_id", "Trace ID is required", {
      details: { traceId: input.traceId },
    });
  }
  if (!input.subjects || input.subjects.length === 0) {
    throw new ValidationError("erasure.report.invalid_subjects", "At least one subject is required", {
      details: { subjects: input.subjects },
    });
  }
  if (!input.evidenceRefs || input.evidenceRefs.length === 0) {
    throw new ValidationError("erasure.report.invalid_evidence_refs", "At least one evidence reference is required", {
      details: { evidenceRefs: input.evidenceRefs },
    });
  }
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
export class ErasureReportService {
  private readonly store: StoreWithCompliance;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore & { compliance: ComplianceStore },
  ) {
    this.store = store as StoreWithCompliance;
  }

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
  public generateReport(input: GenerateErasureReportInput): ErasureReport {
    validateReportInput(input);

    return this.db.transaction(() => {
      const now = nowIso();
      const reportId = newId("erasure_rpt");

      // Verify the erasure request exists
      const erasureRequest = this.store.compliance.getErasureRequest(input.erasureId);
      if (!erasureRequest) {
        throw new StorageError(
          `erasure.report.erasure_not_found:${input.erasureId}`,
          `Erasure request not found: ${input.erasureId}`,
          {
            details: { erasureId: input.erasureId },
          },
        );
      }

      const report: ErasureReport = {
        reportId,
        erasureId: input.erasureId,
        tenantId: erasureRequest.tenantId,
        subjects: input.subjects,
        evidenceRefs: input.evidenceRefs,
        traceId: input.traceId,
        verificationStatus: "pending",
        verifiedAt: null,
        generatedAt: now,
        updatedAt: now,
        notes: input.notes ?? null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      };

      this.store.compliance.insertErasureReport(report);

      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "erasure:report_generated",
        eventTier: "tier_1",
        payloadJson: JSON.stringify(report),
        traceId: input.traceId,
        createdAt: now,
      });

      return report;
    });
  }

  /**
   * Retrieves an erasure report by ID.
   *
   * @param reportId - The report identifier
   * @returns The report or null if not found
   */
  public getReport(reportId: string): ErasureReport | null {
    return this.store.compliance.getErasureReport(reportId);
  }

  /**
   * Lists all erasure reports for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @returns Array of reports sorted by generation date (newest first)
   */
  public listReportsByTenant(tenantId: string): ErasureReport[] {
    return this.store.compliance.listErasureReportsByTenant(tenantId);
  }

  /**
   * Lists all erasure reports for an erasure request.
   *
   * @param erasureId - The erasure request identifier
   * @returns Array of reports for the erasure request
   */
  public listReportsByErasureId(erasureId: string): ErasureReport[] {
    return this.store.compliance.listErasureReportsByErasureId(erasureId);
  }

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
  public verifyCryptoShredding(reportId: string): CryptoShreddingVerificationSummary {
    return this.db.transaction(() => {
      const report = this.store.compliance.getErasureReport(reportId);

      if (!report) {
        throw new StorageError(`erasure.report.not_found:${reportId}`, `Erasure report not found: ${reportId}`, {
          details: { reportId },
        });
      }

      const dekDestructionRefs = report.evidenceRefs.filter((ref: ReportEvidenceRef) => ref.evidenceType === "dek_destruction");

      let verifiedCount = 0;
      let failedCount = 0;
      const messages: string[] = [];

      for (const ref of dekDestructionRefs) {
        const dek = this.store.compliance.getDataEncryptionKey(ref.referenceId);

        if (!dek) {
          // Key not found - could have been destroyed
          verifiedCount++;
          messages.push(`DEK ${ref.referenceId}: Destroyed (not found in active keys)`);
        } else if (dek.status === "destroyed") {
          verifiedCount++;
          messages.push(`DEK ${ref.referenceId}: Destroyed at ${dek.updatedAt}`);
        } else if (dek.status === "active" || dek.status === "rotating") {
          failedCount++;
          messages.push(`DEK ${ref.referenceId}: NOT destroyed (status: ${dek.status})`);
        }
      }

      let status: CryptoShreddingVerificationSummary["status"];
      if (failedCount === 0 && verifiedCount > 0) {
        status = "verified";
      } else if (failedCount > 0) {
        status = "failed";
      } else {
        status = "partial";
        messages.push("No DEK destruction evidence found");
      }

      const verification: CryptoShreddingVerificationSummary = {
        totalDekDestroyed: dekDestructionRefs.length,
        verifiedDekDestroyed: verifiedCount,
        failedDekDestroyed: failedCount,
        status,
        messages,
      };

      const now = nowIso();
      const updatedReport: ErasureReport = {
        ...report,
        verificationStatus: status === "verified" ? "verified" : status === "failed" ? "failed" : "pending",
        verifiedAt: status !== "partial" ? now : null,
        updatedAt: now,
      };

      this.store.compliance.updateErasureReport(updatedReport);

      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "erasure:verification_completed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({
          reportId,
          verification,
          traceId: report.traceId,
        }),
        traceId: report.traceId,
        createdAt: now,
      });

      return verification;
    });
  }

  /**
   * Gets the erasure request associated with a report.
   *
   * @param reportId - The report identifier
   * @returns The erasure request or null if not found
   */
  public getErasureRequestForReport(reportId: string): ErasureRequest | null {
    const report = this.store.compliance.getErasureReport(reportId);
    if (!report) {
      return null;
    }
    return this.store.compliance.getErasureRequest(report.erasureId);
  }

  /**
   * Lists reports by verification status for a tenant.
   *
   * @param tenantId - The tenant identifier
   * @param status - The verification status to filter by
   * @returns Array of matching reports
   */
  public listReportsByVerificationStatus(
    tenantId: string,
    status: "pending" | "verified" | "failed",
  ): ErasureReport[] {
    return this.store.compliance.listErasureReportsByTenant(tenantId).filter((r: ErasureReport) => r.verificationStatus === status);
  }

  /**
   * Updates the notes on an erasure report.
   *
   * @param reportId - The report identifier
   * @param notes - New notes content
   * @returns The updated report
   * @throws StorageError if report not found
   */
  public updateReportNotes(reportId: string, notes: string): ErasureReport {
    return this.db.transaction(() => {
      const existing = this.store.compliance.getErasureReport(reportId);

      if (!existing) {
        throw new StorageError(`erasure.report.not_found:${reportId}`, `Erasure report not found: ${reportId}`, {
          details: { reportId },
        });
      }

      const now = nowIso();
      const updated: ErasureReport = {
        ...existing,
        notes,
        updatedAt: now,
      };

      this.store.compliance.updateErasureReport(updated);
      return updated;
    });
  }
}
