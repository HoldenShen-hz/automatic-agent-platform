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
 * Failure categories for DLQ entries
 * Helps operators understand the nature of failures for triage
 */
export type FailureCategory =
  | "transient"       // Temporary failures (network timeout, resource busy)
  | "permanent"       // Permanent failures (invalid payload, schema mismatch)
  | "configuration"    // Configuration errors (missing credentials, wrong endpoint)
  | "resource"         // Resource errors (out of memory, disk full)
  | "timeout"          // Timeout errors (operation took too long)
  | "authentication"  // Auth errors (invalid token, expired credentials)
  | "rate_limit"      // Rate limiting errors (too many requests)
  | "unknown";        // Uncategorized failures

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

export type OperatorActionType =
  | "retry_scheduled"
  | "retry_cancelled"
  | "retry_exhausted"
  | "manual_discard"
  | "manual_resolve"
  | "category_changed"
  | "investigation_started"
  | "escalation_triggered"
  | "mitigation_applied";

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
  private readonly records = new Map<string, ExtendedDeadLetterRecord>();

  /**
   * Enqueue a new dead letter entry
   */
  public enqueue(input: {
    sourceEventId: string;
    consumerId: string;
    errorCode: string;
    errorMessage?: string | null;
    payloadJson: string;
    originalTimestamp?: string | null;
    failureCategory?: FailureCategory | null;
    reason?: string | null;
  }): ExtendedDeadLetterRecord {
    const now = nowIso();
    const record: ExtendedDeadLetterRecord = {
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
  public scheduleRetry(deadLetterId: string, delayMs?: number): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    if (delayMs !== undefined && (!Number.isFinite(delayMs) || delayMs < 0)) {
      throw new ValidationError("dlq.invalid_retry_delay", "DLQ retry delay must be a non-negative finite number.");
    }

    const backoffDelay = delayMs ?? DEFAULT_RETRY_BACKOFF_MS * Math.pow(2, record.retryCount);
    const nextRetryAt = new Date(Date.parse(now) + backoffDelay).toISOString();

    const updated: ExtendedDeadLetterRecord = {
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
  public markResolved(deadLetterId: string, operatorId?: string): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    const actionLog: OperatorActionRecord = {
      actionId: newId("oplog"),
      operatorId: operatorId ?? "system",
      action: "manual_resolve",
      timestamp: now,
      details: null,
      previousStatus: record.status,
      newStatus: "resolved",
    };

    const updated: ExtendedDeadLetterRecord = {
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
  public discard(deadLetterId: string, reason: string, operatorId?: string): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    const actionLog: OperatorActionRecord = {
      actionId: newId("oplog"),
      operatorId: operatorId ?? "system",
      action: "manual_discard",
      timestamp: now,
      details: { discardReason: reason },
      previousStatus: record.status,
      newStatus: "discarded",
    };

    const updated: ExtendedDeadLetterRecord = {
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
  public markRetryExhausted(deadLetterId: string, operatorId?: string): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    const actionLog: OperatorActionRecord = {
      actionId: newId("oplog"),
      operatorId: operatorId ?? "system",
      action: "retry_exhausted",
      timestamp: now,
      details: { retryCount: record.retryCount, maxRetries: record.maxRetries },
      previousStatus: record.status,
      newStatus: "pending",
    };

    const updated: ExtendedDeadLetterRecord = {
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
  public setFailureCategory(
    deadLetterId: string,
    category: FailureCategory,
    operatorId?: string,
  ): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    const actionLog: OperatorActionRecord = {
      actionId: newId("oplog"),
      operatorId: operatorId ?? "system",
      action: "category_changed",
      timestamp: now,
      details: { previousCategory: record.failureCategory, newCategory: category },
      previousStatus: record.status,
      newStatus: null,
    };

    const updated: ExtendedDeadLetterRecord = {
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
  public setReason(deadLetterId: string, reason: string): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    const updated: ExtendedDeadLetterRecord = {
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
  public logOperatorAction(
    deadLetterId: string,
    action: OperatorActionType,
    operatorId: string,
    details?: Record<string, unknown> | null,
  ): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    const actionLog: OperatorActionRecord = {
      actionId: newId("oplog"),
      operatorId,
      action,
      timestamp: now,
      details: details ?? null,
      previousStatus: record.status,
      newStatus: null,
    };

    const updated: ExtendedDeadLetterRecord = {
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
  public cancelRetry(deadLetterId: string, operatorId?: string): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    const actionLog: OperatorActionRecord = {
      actionId: newId("oplog"),
      operatorId: operatorId ?? "system",
      action: "retry_cancelled",
      timestamp: now,
      details: { retryCount: record.retryCount },
      previousStatus: record.status,
      newStatus: "pending",
    };

    const updated: ExtendedDeadLetterRecord = {
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
  public listByConsumer(consumerId: string): ExtendedDeadLetterRecord[] {
    return Array.from(this.records.values()).filter((record) => record.consumerId === consumerId);
  }

  /**
   * List all dead letter records
   */
  public listAll(): ExtendedDeadLetterRecord[] {
    return Array.from(this.records.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  /**
   * List dead letter records by status
   */
  public listByStatus(status: DeadLetterStatus): ExtendedDeadLetterRecord[] {
    return Array.from(this.records.values()).filter((record) => record.status === status);
  }

  /**
   * Get a specific dead letter record
   */
  public get(deadLetterId: string): ExtendedDeadLetterRecord | undefined {
    return this.records.get(deadLetterId);
  }

  /**
   * Summarize DLQ state
   */
  public summarize(): DlqSummary {
    const records = this.listAll();
    const statusCounts: Record<DeadLetterStatus, number> = {
      pending: 0,
      retrying: 0,
      discarded: 0,
      resolved: 0,
    };
    const categoryCounts: Record<string, number> = {};
    const consumerCounts: Record<string, number> = {};
    let maxRetryCount = 0;
    let oldestPendingAt: string | null = null;

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
      pendingConsumers: Array.from(
        new Set(
          records
            .filter((record) => record.status === "pending" || record.status === "retrying")
            .map((record) => record.consumerId),
        ),
      ).sort(),
      maxRetryCount,
      oldestPendingAt,
    };
  }

  /**
   * Get a required record or throw
   */
  private getRequired(deadLetterId: string): ExtendedDeadLetterRecord {
    const record = this.records.get(deadLetterId);
    if (record == null) {
      throw new ValidationError(
        `dlq.not_found:${deadLetterId}`,
        `Dead-letter record ${deadLetterId} was not found.`,
      );
    }
    return record;
  }
}
