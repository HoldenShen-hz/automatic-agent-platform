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
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError, StorageError } from "../../contracts/errors.js";
/**
 * Validates an erasure request status transition
 *
 * @param fromStatus - Current status
 * @param toStatus - Target status
 * @throws Error if transition is invalid
 */
function validateStatusTransition(fromStatus, toStatus) {
    const validTransitions = {
        pending: ["processing", "cancelled"],
        processing: ["completed", "failed", "cancelled"],
        completed: [],
        failed: [],
        cancelled: [],
    };
    if (!validTransitions[fromStatus].includes(toStatus)) {
        throw new ValidationError(`erasure.invalid_status_transition:${fromStatus}:${toStatus}`, `Invalid status transition from ${fromStatus} to ${toStatus}`, {
            details: { fromStatus, toStatus },
        });
    }
}
/**
 * Validates an erasure request input
 *
 * @param input - The input to validate
 * @throws ValidationError if input is invalid
 */
function validateErasureRequestInput(input) {
    if (!input.tenantId || input.tenantId.trim().length === 0) {
        throw new ValidationError("erasure.invalid_tenant_id", "Tenant ID is required", {
            details: { tenantId: input.tenantId },
        });
    }
    if (!input.subjectId || input.subjectId.trim().length === 0) {
        throw new ValidationError("erasure.invalid_subject_id", "Subject ID is required", {
            details: { subjectId: input.subjectId },
        });
    }
    if (!input.requestedBy || input.requestedBy.trim().length === 0) {
        throw new ValidationError("erasure.invalid_requested_by", "Requestor is required", {
            details: { requestedBy: input.requestedBy },
        });
    }
    if (!input.reason || input.reason.trim().length === 0) {
        throw new ValidationError("erasure.invalid_reason", "Reason is required", {
            details: { reason: input.reason },
        });
    }
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
export class ErasureRequestService {
    db;
    store;
    constructor(db, store) {
        this.db = db;
        this.store = store;
    }
    /**
     * Creates a new erasure request with status `pending`.
     *
     * The request is persisted to the database and an event is emitted
     * for audit trail and external notification systems.
     *
     * @param input - Request details excluding auto-generated fields
     * @returns The created erasure request with generated ID and timestamp
     */
    createRequest(input) {
        validateErasureRequestInput(input);
        return this.db.transaction(() => {
            const now = nowIso();
            const erasureId = newId("erasure");
            const traceId = input.traceId ?? newId("trace");
            const request = {
                erasureId,
                tenantId: input.tenantId,
                subjectType: input.subjectType,
                subjectId: input.subjectId,
                status: "pending",
                requestedBy: input.requestedBy,
                reason: input.reason,
                legalBasis: input.legalBasis ?? "gdpr_article_17",
                createdAt: now,
                updatedAt: now,
                processedAt: null,
                completedAt: null,
                failedAt: null,
                failureReason: null,
                traceId,
                evidenceRefs: [],
                notes: input.notes ?? null,
                metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
            };
            this.store.compliance.insertErasureRequest(request);
            this.store.event.insertEvent({
                id: newId("evt"),
                taskId: null,
                executionId: null,
                eventType: "erasure:requested",
                eventTier: "tier_1",
                payloadJson: JSON.stringify(request),
                traceId,
                createdAt: now,
            });
            return request;
        });
    }
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
    submitRequest(erasureId) {
        return this.db.transaction(() => {
            const existing = this.store.compliance.getErasureRequest(erasureId);
            if (!existing) {
                throw new StorageError(`erasure.not_found:${erasureId}`, `Erasure request not found: ${erasureId}`, {
                    details: { erasureId },
                });
            }
            // Only process if pending - already processing/completed/failed are ignored
            if (existing.status !== "pending") {
                return existing;
            }
            validateStatusTransition(existing.status, "processing");
            const now = nowIso();
            const updated = {
                ...existing,
                status: "processing",
                processedAt: now,
                updatedAt: now,
            };
            this.store.compliance.updateErasureRequest(updated);
            this.store.event.insertEvent({
                id: newId("evt"),
                taskId: null,
                executionId: null,
                eventType: "erasure:processing",
                eventTier: "tier_1",
                payloadJson: JSON.stringify(updated),
                traceId: existing.traceId,
                createdAt: now,
            });
            return updated;
        });
    }
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
    completeRequest(erasureId, evidenceRefs) {
        return this.db.transaction(() => {
            const existing = this.store.compliance.getErasureRequest(erasureId);
            if (!existing) {
                throw new StorageError(`erasure.not_found:${erasureId}`, `Erasure request not found: ${erasureId}`, {
                    details: { erasureId },
                });
            }
            // Only complete if processing
            if (existing.status !== "processing") {
                return existing;
            }
            validateStatusTransition(existing.status, "completed");
            const now = nowIso();
            const serializedEvidenceRefs = evidenceRefs.map((ref) => JSON.stringify(ref));
            const updated = {
                ...existing,
                status: "completed",
                completedAt: now,
                updatedAt: now,
                evidenceRefs: serializedEvidenceRefs,
            };
            this.store.compliance.updateErasureRequest(updated);
            this.store.event.insertEvent({
                id: newId("evt"),
                taskId: null,
                executionId: null,
                eventType: "erasure:completed",
                eventTier: "tier_1",
                payloadJson: JSON.stringify({
                    ...updated,
                    evidenceRefs: evidenceRefs,
                }),
                traceId: existing.traceId,
                createdAt: now,
            });
            return updated;
        });
    }
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
    failRequest(erasureId, reason) {
        return this.db.transaction(() => {
            const existing = this.store.compliance.getErasureRequest(erasureId);
            if (!existing) {
                throw new StorageError(`erasure.not_found:${erasureId}`, `Erasure request not found: ${erasureId}`, {
                    details: { erasureId },
                });
            }
            // Only fail if processing
            if (existing.status !== "processing") {
                return existing;
            }
            validateStatusTransition(existing.status, "failed");
            const now = nowIso();
            const updated = {
                ...existing,
                status: "failed",
                failedAt: now,
                updatedAt: now,
                failureReason: reason,
            };
            this.store.compliance.updateErasureRequest(updated);
            this.store.event.insertEvent({
                id: newId("evt"),
                taskId: null,
                executionId: null,
                eventType: "erasure:failed",
                eventTier: "tier_1",
                payloadJson: JSON.stringify({ erasureId, reason, traceId: existing.traceId }),
                traceId: existing.traceId,
                createdAt: now,
            });
            return updated;
        });
    }
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
    cancelRequest(erasureId) {
        return this.db.transaction(() => {
            const existing = this.store.compliance.getErasureRequest(erasureId);
            if (!existing) {
                throw new StorageError(`erasure.not_found:${erasureId}`, `Erasure request not found: ${erasureId}`, {
                    details: { erasureId },
                });
            }
            // Only cancel if pending or processing
            if (existing.status !== "pending" && existing.status !== "processing") {
                return existing;
            }
            validateStatusTransition(existing.status, "cancelled");
            const now = nowIso();
            const updated = {
                ...existing,
                status: "cancelled",
                updatedAt: now,
            };
            this.store.compliance.updateErasureRequest(updated);
            this.store.event.insertEvent({
                id: newId("evt"),
                taskId: null,
                executionId: null,
                eventType: "erasure:cancelled",
                eventTier: "tier_1",
                payloadJson: JSON.stringify({ erasureId, traceId: existing.traceId }),
                traceId: existing.traceId,
                createdAt: now,
            });
            return updated;
        });
    }
    /**
     * Retrieves an erasure request by ID.
     *
     * @param erasureId - The erasure request ID
     * @returns The erasure request or null if not found
     */
    getRequest(erasureId) {
        return this.store.compliance.getErasureRequest(erasureId);
    }
    /**
     * Lists all erasure requests for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @returns Array of erasure requests sorted by creation date (newest first)
     */
    listRequestsByTenant(tenantId) {
        return this.store.compliance.listErasureRequestsByTenant(tenantId);
    }
    /**
     * Lists erasure requests by status for a tenant.
     *
     * @param tenantId - The tenant identifier
     * @param status - The status to filter by
     * @returns Array of matching erasure requests
     */
    listRequestsByStatus(tenantId, status) {
        return this.store.compliance.listErasureRequestsByTenant(tenantId).filter((r) => r.status === status);
    }
    /**
     * Lists all erasure requests with a specific trace ID for lineage tracking.
     *
     * @param traceId - The trace identifier
     * @returns Array of erasure requests with the given trace ID
     */
    listRequestsByTraceId(traceId) {
        return this.store.compliance.listErasureRequestsByTraceId(traceId);
    }
}
//# sourceMappingURL=erasure-request-service.js.map