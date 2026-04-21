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
/**
 * Failure categories for DLQ entries
 * Helps operators understand the nature of failures for triage
 */
export type FailureCategory = "transient" | "permanent" | "configuration" | "resource" | "timeout" | "authentication" | "rate_limit" | "unknown";
/**
 * Operator action record for audit trail
 * Tracks human interventions on DLQ entries
 */
export interface OperatorActionRecord {
    actionId: string;
    operatorId: string;
    action: OperatorActionType;
    timestamp: string;
    details: Record<string, unknown> | null;
    previousStatus: string | null;
    newStatus: string | null;
}
export type OperatorActionType = "retry_scheduled" | "retry_cancelled" | "retry_exhausted" | "manual_discard" | "manual_resolve" | "category_changed" | "investigation_started" | "escalation_triggered" | "mitigation_applied";
/**
 * Extended DLQ entry with §28 requirements
 */
export interface ExtendedDeadLetterRecord {
    deadLetterId: string;
    sourceEventId: string;
    consumerId: string;
    errorCode: string;
    errorMessage: string | null;
    payloadJson: string;
    status: DeadLetterStatus;
    retryCount: number;
    maxRetries: number;
    nextRetryAt: string | null;
    createdAt: string;
    updatedAt: string;
    /** Original timestamp when the failed event occurred */
    originalTimestamp: string | null;
    /** Category classification for the failure */
    failureCategory: FailureCategory | null;
    /** Reason description for operator visibility */
    reason: string | null;
    /** Timestamp when all retries were exhausted */
    retryExhaustedAt: string | null;
    /** Operator action log for audit trail */
    operatorActionLog: OperatorActionRecord[];
}
export type DeadLetterStatus = "pending" | "retrying" | "discarded" | "resolved";
/**
 * DLQ summary statistics
 */
export interface DlqSummary {
    totalRecords: number;
    statusCounts: Record<DeadLetterStatus, number>;
    categoryCounts: Record<FailureCategory | string, number>;
    consumerCounts: Record<string, number>;
    pendingConsumers: string[];
    maxRetryCount: number;
    oldestPendingAt: string | null;
}
/**
 * DLQ Service - Handles dead letter queue operations with audit trail
 */
export declare class DlqService {
    private readonly records;
    /**
     * Enqueue a new dead letter entry
     */
    enqueue(input: {
        sourceEventId: string;
        consumerId: string;
        errorCode: string;
        errorMessage?: string | null;
        payloadJson: string;
        originalTimestamp?: string | null;
        failureCategory?: FailureCategory | null;
        reason?: string | null;
    }): ExtendedDeadLetterRecord;
    /**
     * Schedule a retry for a dead letter entry
     * Uses exponential backoff
     */
    scheduleRetry(deadLetterId: string, delayMs?: number): ExtendedDeadLetterRecord;
    /**
     * Mark a dead letter entry as resolved
     */
    markResolved(deadLetterId: string, operatorId?: string): ExtendedDeadLetterRecord;
    /**
     * Discard a dead letter entry
     */
    discard(deadLetterId: string, reason: string, operatorId?: string): ExtendedDeadLetterRecord;
    /**
     * Mark a DLQ entry as retry-exhausted
     * Called when all retry attempts have been exhausted
     */
    markRetryExhausted(deadLetterId: string, operatorId?: string): ExtendedDeadLetterRecord;
    /**
     * Set failure category on a DLQ entry
     */
    setFailureCategory(deadLetterId: string, category: FailureCategory, operatorId?: string): ExtendedDeadLetterRecord;
    /**
     * Set reason on a DLQ entry
     */
    setReason(deadLetterId: string, reason: string): ExtendedDeadLetterRecord;
    /**
     * Log an operator action on a DLQ entry
     */
    logOperatorAction(deadLetterId: string, action: OperatorActionType, operatorId: string, details?: Record<string, unknown> | null): ExtendedDeadLetterRecord;
    /**
     * Cancel a scheduled retry
     */
    cancelRetry(deadLetterId: string, operatorId?: string): ExtendedDeadLetterRecord;
    /**
     * List all dead letter records for a consumer
     */
    listByConsumer(consumerId: string): ExtendedDeadLetterRecord[];
    /**
     * List all dead letter records
     */
    listAll(): ExtendedDeadLetterRecord[];
    /**
     * List dead letter records by status
     */
    listByStatus(status: DeadLetterStatus): ExtendedDeadLetterRecord[];
    /**
     * Get a specific dead letter record
     */
    get(deadLetterId: string): ExtendedDeadLetterRecord | undefined;
    /**
     * Summarize DLQ state
     */
    summarize(): DlqSummary;
    /**
     * Get a required record or throw
     */
    private getRequired;
}
