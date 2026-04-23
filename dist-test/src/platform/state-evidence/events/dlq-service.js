/**
 * @fileoverview DLQ Service - Dead Letter Queue handling for event delivery failures
 *
 * Extends the existing DLQ in src/platform/state-evidence/dlq/index.ts with:
 * - Category classification for failure types
 * - Reason tracking for operator visibility
 * - Retry count management
 * - Operator action log for audit trail
 *
 * @see src/platform/state-evidence/dlq/index.ts - Base DLQ implementation
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
/**
 * Default maximum retry attempts
 */
const DEFAULT_MAX_RETRIES = 5;
/**
 * Default retry backoff base delay in milliseconds
 */
const DEFAULT_RETRY_BACKOFF_MS = 30_000;
/**
 * DLQ Service - Handles dead letter queue operations with audit trail
 */
export class DlqService {
    records = new Map();
    /**
     * Enqueue a new dead letter entry
     */
    enqueue(input) {
        const now = nowIso();
        const record = {
            deadLetterId: newId("dlq"),
            sourceEventId: input.sourceEventId,
            consumerId: input.consumerId,
            errorCode: input.errorCode,
            errorMessage: input.errorMessage ?? null,
            payloadJson: input.payloadJson,
            status: "pending",
            retryCount: 0,
            maxRetries: DEFAULT_MAX_RETRIES,
            nextRetryAt: null,
            createdAt: now,
            updatedAt: now,
            originalTimestamp: input.originalTimestamp ?? null,
            failureCategory: input.failureCategory ?? null,
            reason: input.reason ?? null,
            retryExhaustedAt: null,
            operatorActionLog: [],
        };
        this.records.set(record.deadLetterId, record);
        return record;
    }
    /**
     * Schedule a retry for a dead letter entry
     * Uses exponential backoff
     */
    scheduleRetry(deadLetterId, delayMs) {
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        if (delayMs !== undefined && (!Number.isFinite(delayMs) || delayMs < 0)) {
            throw new ValidationError("dlq.invalid_retry_delay", "DLQ retry delay must be a non-negative finite number.");
        }
        const backoffDelay = delayMs ?? DEFAULT_RETRY_BACKOFF_MS * Math.pow(2, record.retryCount);
        const nextRetryAt = new Date(Date.parse(now) + backoffDelay).toISOString();
        const updated = {
            ...record,
            status: "retrying",
            retryCount: record.retryCount + 1,
            nextRetryAt,
            updatedAt: now,
        };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    /**
     * Mark a dead letter entry as resolved
     */
    markResolved(deadLetterId, operatorId) {
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        const actionLog = {
            actionId: newId("oplog"),
            operatorId: operatorId ?? "system",
            action: "manual_resolve",
            timestamp: now,
            details: null,
            previousStatus: record.status,
            newStatus: "resolved",
        };
        const updated = {
            ...record,
            status: "resolved",
            nextRetryAt: null,
            updatedAt: now,
            operatorActionLog: [...record.operatorActionLog, actionLog],
        };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    /**
     * Discard a dead letter entry
     */
    discard(deadLetterId, reason, operatorId) {
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        const actionLog = {
            actionId: newId("oplog"),
            operatorId: operatorId ?? "system",
            action: "manual_discard",
            timestamp: now,
            details: { discardReason: reason },
            previousStatus: record.status,
            newStatus: "discarded",
        };
        const updated = {
            ...record,
            status: "discarded",
            errorCode: reason,
            nextRetryAt: null,
            updatedAt: now,
            operatorActionLog: [...record.operatorActionLog, actionLog],
        };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    /**
     * Mark a DLQ entry as retry-exhausted
     * Called when all retry attempts have been exhausted
     */
    markRetryExhausted(deadLetterId, operatorId) {
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        const actionLog = {
            actionId: newId("oplog"),
            operatorId: operatorId ?? "system",
            action: "retry_exhausted",
            timestamp: now,
            details: { retryCount: record.retryCount, maxRetries: record.maxRetries },
            previousStatus: record.status,
            newStatus: "pending",
        };
        const updated = {
            ...record,
            status: "pending",
            retryExhaustedAt: now,
            nextRetryAt: null,
            updatedAt: now,
            operatorActionLog: [...record.operatorActionLog, actionLog],
        };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    /**
     * Set failure category on a DLQ entry
     */
    setFailureCategory(deadLetterId, category, operatorId) {
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        const actionLog = {
            actionId: newId("oplog"),
            operatorId: operatorId ?? "system",
            action: "category_changed",
            timestamp: now,
            details: { previousCategory: record.failureCategory, newCategory: category },
            previousStatus: record.status,
            newStatus: null,
        };
        const updated = {
            ...record,
            failureCategory: category,
            updatedAt: now,
            operatorActionLog: [...record.operatorActionLog, actionLog],
        };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    /**
     * Set reason on a DLQ entry
     */
    setReason(deadLetterId, reason) {
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        const updated = {
            ...record,
            reason,
            updatedAt: now,
        };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    /**
     * Log an operator action on a DLQ entry
     */
    logOperatorAction(deadLetterId, action, operatorId, details) {
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        const actionLog = {
            actionId: newId("oplog"),
            operatorId,
            action,
            timestamp: now,
            details: details ?? null,
            previousStatus: record.status,
            newStatus: null,
        };
        const updated = {
            ...record,
            updatedAt: now,
            operatorActionLog: [...record.operatorActionLog, actionLog],
        };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    /**
     * Cancel a scheduled retry
     */
    cancelRetry(deadLetterId, operatorId) {
        const record = this.getRequired(deadLetterId);
        const now = nowIso();
        const actionLog = {
            actionId: newId("oplog"),
            operatorId: operatorId ?? "system",
            action: "retry_cancelled",
            timestamp: now,
            details: { retryCount: record.retryCount },
            previousStatus: record.status,
            newStatus: "pending",
        };
        const updated = {
            ...record,
            status: "pending",
            nextRetryAt: null,
            updatedAt: now,
            operatorActionLog: [...record.operatorActionLog, actionLog],
        };
        this.records.set(deadLetterId, updated);
        return updated;
    }
    /**
     * List all dead letter records for a consumer
     */
    listByConsumer(consumerId) {
        return Array.from(this.records.values()).filter((record) => record.consumerId === consumerId);
    }
    /**
     * List all dead letter records
     */
    listAll() {
        return Array.from(this.records.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
    /**
     * List dead letter records by status
     */
    listByStatus(status) {
        return Array.from(this.records.values()).filter((record) => record.status === status);
    }
    /**
     * Get a specific dead letter record
     */
    get(deadLetterId) {
        return this.records.get(deadLetterId);
    }
    /**
     * Summarize DLQ state
     */
    summarize() {
        const records = this.listAll();
        const statusCounts = {
            pending: 0,
            retrying: 0,
            discarded: 0,
            resolved: 0,
        };
        const categoryCounts = {};
        const consumerCounts = {};
        let maxRetryCount = 0;
        let oldestPendingAt = null;
        for (const record of records) {
            statusCounts[record.status] += 1;
            if (record.failureCategory) {
                categoryCounts[record.failureCategory] = (categoryCounts[record.failureCategory] ?? 0) + 1;
            }
            consumerCounts[record.consumerId] = (consumerCounts[record.consumerId] ?? 0) + 1;
            maxRetryCount = Math.max(maxRetryCount, record.retryCount);
            if ((record.status === "pending" || record.status === "retrying") && record.createdAt) {
                if (oldestPendingAt === null || record.createdAt < oldestPendingAt) {
                    oldestPendingAt = record.createdAt;
                }
            }
        }
        return {
            totalRecords: records.length,
            statusCounts,
            categoryCounts,
            consumerCounts,
            pendingConsumers: Array.from(new Set(records
                .filter((record) => record.status === "pending" || record.status === "retrying")
                .map((record) => record.consumerId))).sort(),
            maxRetryCount,
            oldestPendingAt,
        };
    }
    /**
     * Get a required record or throw
     */
    getRequired(deadLetterId) {
        const record = this.records.get(deadLetterId);
        if (record == null) {
            throw new ValidationError(`dlq.not_found:${deadLetterId}`, `Dead-letter record ${deadLetterId} was not found.`);
        }
        return record;
    }
}
//# sourceMappingURL=dlq-service.js.map