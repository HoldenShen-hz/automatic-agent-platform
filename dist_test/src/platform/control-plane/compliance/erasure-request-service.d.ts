/**
 * @fileoverview Erasure Request Service - GDPR Right-to-Erasure (Article 17) compliance
 *
 * ## Overview
 *
 * Handles the complete lifecycle of data erasure requests under GDPR and similar
 * data protection regulations. Implements the Right-to-Erasure flow with crypto-shredding
 * for secure data removal.
 *
 * ## Erasure Flow
 *
 * 1. ErasureRequest created with status `pending`
 * 2. Request submitted - status transitions to `processing`, DEKs marked for destruction
 * 3. Data becomes cryptographically inaccessible (crypto-shredding)
 * 4. Request completed with evidence refs linking to DEK destruction events
 * 5. ErasureReport generated for compliance documentation
 *
 * ## Key Concepts
 *
 * - **Crypto-shredding**: Data encryption keys are destroyed, making encrypted data unrecoverable
 * - **trace_id**: Lineage tracking across the erasure workflow
 * - **evidence_refs**: References to destruction events for audit trail
 *
 * @see GDPR Article 17: Right to erasure ('right to be forgotten')
 * @see docs_zh/architecture/00-platform-architecture.md
 *
 * @packageDocumentation
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ComplianceStore } from "./types.js";
/**
 * Erasure request status enum
 */
export type ErasureStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
/**
 * Subject type for erasure request
 */
export type ErasureSubjectType = "user" | "workspace" | "tenant" | "execution" | "task" | "custom";
/**
 * Erasure request record stored in the database
 */
export interface ErasureRequest {
    /** Unique identifier for the erasure request */
    erasureId: string;
    /** Tenant identifier */
    tenantId: string;
    /** Type of subject being erased */
    subjectType: ErasureSubjectType;
    /** Identifier of the subject being erased */
    subjectId: string;
    /** Current status of the erasure request */
    status: ErasureStatus;
    /** Requestor identifier (user ID or system ID) */
    requestedBy: string;
    /** Reason for erasure request */
    reason: string;
    /** GDPR article basis for the request */
    legalBasis: "gdpr_article_17" | "gdpr_article_17_1" | "gdpr_article_17_3" | "other";
    /** ISO timestamp when request was created */
    createdAt: string;
    /** ISO timestamp when request was last updated */
    updatedAt: string;
    /** ISO timestamp when processing started */
    processedAt: string | null;
    /** ISO timestamp when request was completed */
    completedAt: string | null;
    /** ISO timestamp when request failed */
    failedAt: string | null;
    /** Reason for failure if status is failed */
    failureReason: string | null;
    /** Trace ID for lineage tracking across services */
    traceId: string;
    /** Evidence references linking to DEK destruction events */
    evidenceRefs: readonly string[];
    /** Requestor comments or notes */
    notes: string | null;
    /** Metadata JSON for additional context */
    metadataJson: string | null;
}
/**
 * Input for creating a new erasure request
 */
export interface ErasureRequestInput {
    tenantId: string;
    subjectType: ErasureSubjectType;
    subjectId: string;
    requestedBy: string;
    reason: string;
    legalBasis?: "gdpr_article_17" | "gdpr_article_17_1" | "gdpr_article_17_3" | "other";
    traceId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Evidence reference for erasure completion
 */
export interface EvidenceRef {
    /** Type of evidence (e.g., "dek_destruction", "data_purge") */
    evidenceType: string;
    /** Reference identifier (e.g., key_id, purge_job_id) */
    referenceId: string;
    /** Timestamp when evidence was generated */
    timestamp: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Service for managing data erasure requests (Right-to-Erasure / GDPR Article 17).
 *
 * Handles the complete lifecycle of erasure requests from creation through
 * completion with crypto-shredding verification.
 *
 * ## Usage
 *
 * ```typescript
 * const erasureService = new ErasureRequestService(db, store);
 *
 * // Create erasure request
 * const request = erasureService.createRequest({
 *   tenantId: "tenant-123",
 *   subjectType: "user",
 *   subjectId: "user-456",
 *   requestedBy: "admin-789",
 *   reason: "User requested account deletion",
 *   legalBasis: "gdpr_article_17_1",
 * });
 *
 * // Submit for processing (triggers DEK destruction)
 * erasureService.submitRequest(request.erasureId);
 *
 * // Complete after crypto-shredding
 * erasureService.completeRequest(request.erasureId, [
 *   { evidenceType: "dek_destruction", referenceId: "key-001", timestamp: nowIso() },
 * ]);
 * ```
 */
export declare class ErasureRequestService {
    private readonly db;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore & {
        compliance: ComplianceStore;
    });
    /**
     * Creates a new erasure request with status `pending`.
     *
     * The request is persisted to the database and an event is emitted
     * for audit trail and external notification systems.
     *
     * @param input - Request details excluding auto-generated fields
     * @returns The created erasure request with generated ID and timestamp
     */
    createRequest(input: ErasureRequestInput): ErasureRequest;
    /**
     * Submits an erasure request for processing.
     *
     * Transitions the request from `pending` to `processing` status.
     * This triggers the crypto-shredding workflow (DEK destruction).
     *
     * Idempotent: if the request is not in `pending` status, this is a no-op.
     *
     * @param erasureId - The erasure request ID
     * @returns The updated erasure request
     * @throws StorageError if request not found
     */
    submitRequest(erasureId: string): ErasureRequest;
    /**
     * Completes an erasure request with evidence references.
     *
     * Transitions the request from `processing` to `completed` status
     * and records the evidence refs pointing to DEK destruction events.
     *
     * Idempotent: if the request is not in `processing` status, this is a no-op.
     *
     * @param erasureId - The erasure request ID
     * @param evidenceRefs - References to destruction evidence
     * @returns The updated erasure request
     * @throws StorageError if request not found
     */
    completeRequest(erasureId: string, evidenceRefs: readonly EvidenceRef[]): ErasureRequest;
    /**
     * Marks an erasure request as failed with a reason.
     *
     * Transitions the request from `processing` to `failed` status.
     *
     * Idempotent: if the request is not in `processing` status, this is a no-op.
     *
     * @param erasureId - The erasure request ID
     * @param reason - Reason for failure
     * @returns The updated erasure request
     * @throws StorageError if request not found
     */
    failRequest(erasureId: string, reason: string): ErasureRequest;
    /**
     * Cancels an erasure request.
     *
     * Transitions the request from `pending` or `processing` to `cancelled` status.
     * A request that has already been completed or failed cannot be cancelled.
     *
     * Idempotent: if the request is not in a cancellable status, this is a no-op.
     *
     * @param erasureId - The erasure request ID
     * @returns The updated erasure request
     * @throws StorageError if request not found
     */
    cancelRequest(erasureId: string): ErasureRequest;
    /**
     * Retrieves an erasure request by ID.
     *
     * @param erasureId - The erasure request ID
     * @returns The erasure request or null if not found
     */
    getRequest(erasureId: string): ErasureRequest | null;
    /**
     * Lists all erasure requests for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns Array of erasure requests sorted by creation date (newest first)
     */
    listRequestsByTenant(tenantId: string): ErasureRequest[];
    /**
     * Lists erasure requests by status for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @param status - The status to filter by
     * @returns Array of matching erasure requests
     */
    listRequestsByStatus(tenantId: string, status: ErasureStatus): ErasureRequest[];
    /**
     * Lists all erasure requests with a specific trace ID for lineage tracking.
     *
     * @param traceId - The trace identifier
     * @returns Array of erasure requests with the given trace ID
     */
    listRequestsByTraceId(traceId: string): ErasureRequest[];
}
