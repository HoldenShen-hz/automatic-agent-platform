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
import type { DurableEventBus } from "./durable-event-bus.js";
import type { SqliteConnection } from "../truth/sqlite/query-helper.js";
import { SqliteDlqRepository } from "./sqlite-dlq-repository.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

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
  eventType: string;
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
  /** First time this event entered the DLQ */
  firstFailedAt: string | null;
  /** Most recent failure timestamp observed for this DLQ item */
  lastFailedAt: string | null;
  /** Category classification for the failure */
  failureCategory: FailureCategory | null;
  /** Reason description for operator visibility */
  reason: string | null;
  /** Timestamp when all retries were exhausted */
  retryExhaustedAt: string | null;
  /** Timestamp of last retry attempt */
  lastAttemptAt: string | null;
  /** Linked incident for escalation tracking */
  linkedIncidentId: string | null;
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
 * Repository interface for DLQ persistence in dlq-service.
 * Extends the base DeadLetterRecord with operator action log support.
 */
export interface DlqRepository {
  /** Insert a new DLQ record */
  insert(record: ExtendedDeadLetterRecord): void;
  /** Find a DLQ record by ID */
  findById(deadLetterId: string): ExtendedDeadLetterRecord | null;
  /** Update an existing DLQ record */
  update(record: ExtendedDeadLetterRecord): void;
  /** List all DLQ records */
  listAll(): ExtendedDeadLetterRecord[];
  /** List DLQ records by consumer ID */
  listByConsumer(consumerId: string): ExtendedDeadLetterRecord[];
  /** List retryable DLQ records due by the specified instant */
  listRetryable(asOf: string): ExtendedDeadLetterRecord[];
}

export interface DlqServiceOptions {
  /**
   * Allow ephemeral in-memory storage.
   * This exists for tests and explicit dev-only callers; production callers
   * must inject a persistent repository or database connection.
   */
  readonly allowInMemoryFallback?: boolean;
}

/**
 * In-memory implementation of DLQ repository for backward compatibility
 * and environments without persistent storage.
 */
export class InMemoryDlqRepository implements DlqRepository {
  private readonly records = new Map<string, ExtendedDeadLetterRecord>();

  public insert(record: ExtendedDeadLetterRecord): void {
    this.records.set(record.deadLetterId, record);
  }

  public findById(deadLetterId: string): ExtendedDeadLetterRecord | null {
    return this.records.get(deadLetterId) ?? null;
  }

  public update(record: ExtendedDeadLetterRecord): void {
    if (!this.records.has(record.deadLetterId)) {
      throw new ValidationError(`dlq.not_found:${record.deadLetterId}`, `Dead-letter record ${record.deadLetterId} was not found.`);
    }
    this.records.set(record.deadLetterId, record);
  }

  public listAll(): ExtendedDeadLetterRecord[] {
    return [...this.records.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public listByConsumer(consumerId: string): ExtendedDeadLetterRecord[] {
    return [...this.records.values()].filter((record) => record.consumerId === consumerId);
  }

  public listRetryable(asOf: string): ExtendedDeadLetterRecord[] {
    return [...this.records.values()]
      .filter((record) => record.status === "retrying" && record.nextRetryAt != null && record.nextRetryAt <= asOf)
      .sort((left, right) => left.nextRetryAt!.localeCompare(right.nextRetryAt!));
  }
}

/**
 * DLQ Service - Handles dead letter queue operations with audit trail.
 * Supports both in-memory and persistent repository implementations.
 *
 * R12-06 FIX: the previous constructor silently fell back to in-memory storage
 * whenever the caller forgot to inject persistence. That meant the repository
 * already supported SQLite durability, but the default production path still
 * violated §28.8 and lost DLQ data on restart. The constructor now fails closed
 * unless the caller explicitly opts into ephemeral mode.
 */
export class DlqService {
  private readonly repo: DlqRepository;

  // R12-06 FIX: Static flag to ensure warning is printed only once per process
  private static IN_MEMORY_WARNING_EMITTED = false;

  /**
   * Create a DLQ service with an optional repository or database connection.
   * @param repo - Optional repository for persistence. If not provided, the dbConnection is used
   *               to create a SqliteDlqRepository.
   * @param dbConnection - Optional SQLite database connection for persistent DLQ storage.
   *                       When provided and repo is not provided, creates a SqliteDlqRepository.
   * @param options - Optional constructor flags. In-memory fallback must be explicitly
   *                  enabled for tests or ephemeral tooling.
   */
  public constructor(repo?: DlqRepository, dbConnection?: SqliteConnection, options: DlqServiceOptions = {}) {
    if (repo != null) {
      this.repo = repo;
    } else if (dbConnection != null) {
      this.repo = new SqliteDlqRepository(dbConnection);
    } else {
      const allowInMemoryFallback =
        options.allowInMemoryFallback === true ||
        process.env["AA_RUNNING_TESTS"] === "1" ||
        process.env["NODE_ENV"] === "test";
      if (!allowInMemoryFallback) {
        throw new ValidationError(
          "dlq.persistence_required",
          "DlqService requires a persistent DlqRepository or dbConnection outside explicit test/dev fallback.",
        );
      }
      this.repo = new InMemoryDlqRepository();
      if (
        !DlqService.IN_MEMORY_WARNING_EMITTED &&
        options.allowInMemoryFallback === true &&
        process.env["AA_RUNNING_TESTS"] !== "1" &&
        process.env["NODE_ENV"] !== "test"
      ) {
        logger.warn("DlqService using in-memory DLQ repository", {
          warning: "DLQ entries will be lost on process restart. For production, provide a persistent DlqRepository or dbConnection.",
          reference: "See §28.8 for persistent DLQ requirements.",
        });
        DlqService.IN_MEMORY_WARNING_EMITTED = true;
      }
    }
  }

  /**
   * Enqueue a new dead letter entry
   */
  public enqueue(input: {
    sourceEventId: string;
    eventType: string;
    consumerId: string;
    errorCode: string;
    errorMessage?: string | null;
    payloadJson: string;
    originalTimestamp?: string | null;
    failureCategory?: FailureCategory | null;
    reason?: string | null;
  }): ExtendedDeadLetterRecord {
    const now = nowIso();
    const firstFailureAt = input.originalTimestamp ?? now;
    const record: ExtendedDeadLetterRecord = {
      deadLetterId: newId("dlq"),
      sourceEventId: input.sourceEventId,
      eventType: input.eventType,
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
      firstFailedAt: firstFailureAt,
      lastFailedAt: firstFailureAt,
      failureCategory: input.failureCategory ?? null,
      reason: input.reason ?? null,
      retryExhaustedAt: null,
      lastAttemptAt: null,
      linkedIncidentId: null,
      operatorActionLog: [],
    };
    this.repo.insert(record);
    return record;
  }

  /**
   * Schedule a retry for a dead letter entry
   * Uses exponential backoff
   */
  public scheduleRetry(deadLetterId: string, delayMs?: number): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    // Root cause §191-2233: No maxRetries validation at entry means infinite retry is possible
    // when maxRetries is undefined/null (Map.set allows overwrite, not append-only).
    // Poison-pill quarantine: when retryCount reaches maxRetries, mark entry as discarded
    // instead of allowing retry count to grow indefinitely beyond maxRetries.
    if (!Number.isFinite(record.maxRetries) || record.maxRetries < 0) {
      throw new ValidationError("dlq.invalid_max_retries", "DLQ maxRetries must be a non-negative finite number.");
    }
    if (delayMs !== undefined && (!Number.isFinite(delayMs) || delayMs < 0)) {
      throw new ValidationError("dlq.invalid_retry_delay", "DLQ retry delay must be a non-negative finite number.");
    }
    if (record.status === "discarded" || record.status === "resolved") {
      throw new ValidationError(
        "dlq.retry_terminal_status",
        `Dead-letter record ${deadLetterId} is already terminal and cannot be retried.`,
      );
    }
    if (record.retryCount >= record.maxRetries) {
      // Quarantine: mark as retry-exhausted instead of allowing infinite retry
      return this.markRetryExhausted(deadLetterId);
    }

    const backoffDelay = delayMs ?? DEFAULT_RETRY_BACKOFF_MS * Math.pow(2, record.retryCount);
    const nextRetryAt = new Date(Date.parse(now) + backoffDelay).toISOString();

    const updated: ExtendedDeadLetterRecord = {
      ...record,
      status: "retrying",
      retryCount: record.retryCount + 1,
      nextRetryAt,
      updatedAt: now,
      lastFailedAt: now,
      lastAttemptAt: now,
    };
    this.repo.update(updated);
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
    this.repo.update(updated);
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
    this.repo.update(updated);
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
      newStatus: "discarded",
    };

    const updated: ExtendedDeadLetterRecord = {
      ...record,
      status: "discarded",
      retryExhaustedAt: now,
      nextRetryAt: null,
      updatedAt: now,
      lastFailedAt: now,
      operatorActionLog: [...record.operatorActionLog, actionLog],
    };
    this.repo.update(updated);
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
    this.repo.update(updated);
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
    this.repo.update(updated);
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
    this.repo.update(updated);
    return updated;
  }

  /**
   * Link a DLQ entry to an incident for operator escalation and redrive tracking.
   */
  public linkIncident(deadLetterId: string, incidentId: string, operatorId?: string): ExtendedDeadLetterRecord {
    const record = this.getRequired(deadLetterId);
    const now = nowIso();

    const actionLog: OperatorActionRecord = {
      actionId: newId("oplog"),
      operatorId: operatorId ?? "system",
      action: "escalation_triggered",
      timestamp: now,
      details: {
        previousIncidentId: record.linkedIncidentId,
        incidentId,
      },
      previousStatus: record.status,
      newStatus: null,
    };

    const updated: ExtendedDeadLetterRecord = {
      ...record,
      linkedIncidentId: incidentId,
      updatedAt: now,
      operatorActionLog: [...record.operatorActionLog, actionLog],
    };
    this.repo.update(updated);
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
    this.repo.update(updated);
    return updated;
  }

  /**
   * List all dead letter records for a consumer
   */
  public listByConsumer(consumerId: string): ExtendedDeadLetterRecord[] {
    return this.repo.listByConsumer(consumerId);
  }

  /**
   * List all dead letter records
   */
  public listAll(): ExtendedDeadLetterRecord[] {
    return this.repo.listAll();
  }

  /**
   * List dead letter records by status
   */
  public listByStatus(status: DeadLetterStatus): ExtendedDeadLetterRecord[] {
    return this.repo.listAll().filter((record) => record.status === status);
  }

  // R13-4/R13-5 FIX: Add listRetryable method to DlqService for DLQ consumer
  /**
   * List dead letter records that are ready for retry.
   * @param asOf - ISO timestamp to check against nextRetryAt
   * @returns Array of records eligible for retry
   */
  public listRetryable(asOf: string): ExtendedDeadLetterRecord[] {
    return this.repo.listRetryable(asOf);
  }

  /**
   * Get a specific dead letter record
   */
  public get(deadLetterId: string): ExtendedDeadLetterRecord | undefined {
    return this.repo.findById(deadLetterId) ?? undefined;
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
    const record = this.repo.findById(deadLetterId);
    if (record == null) {
      throw new ValidationError(
        `dlq.not_found:${deadLetterId}`,
        `Dead-letter record ${deadLetterId} was not found.`,
      );
    }
    return record;
  }
}

/**
 * DLQ Consumer - Processes messages from the dead letter queue.
 * R13-4 FIX: Implements DLQConsumer that processes messages from the DLQ.
 * R13-5 FIX: Implements retry mechanism for DLQ messages.
 * R13-6 FIX: Handles max retry exceeded properly.
 * R13-7 FIX: Creates dead letter record after max retries are exhausted.
 */
export interface DlqConsumerOptions {
  /** Maximum retry attempts before giving up */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds */
  initialBackoffMs?: number;
  /** Maximum backoff delay in milliseconds */
  maxBackoffMs?: number;
  /** Consumer ID for this DLQ consumer */
  consumerId?: string;
}

const DEFAULT_DLQ_CONSUMER_OPTIONS: Required<DlqConsumerOptions> = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  consumerId: "dlq_consumer",
};

/**
 * DLQ Consumer that processes dead letter records and attempts retries.
 */
export class DlqConsumer {
  private readonly options: Required<DlqConsumerOptions>;
  private readonly eventBus: DurableEventBus | null = null;
  private disposed = false;

  /**
   * Creates a DLQ consumer for processing dead letter records.
   * @param dlqService - The DLQ service to use
   * @param eventBus - Optional event bus for re-publishing events
   * @param options - Consumer configuration options
   */
  public constructor(
    private readonly dlqService: DlqService,
    eventBus?: DurableEventBus,
    options: DlqConsumerOptions = {},
  ) {
    this.options = { ...DEFAULT_DLQ_CONSUMER_OPTIONS, ...options };
    this.eventBus = eventBus ?? null;
  }

  /**
   * Processes all pending retryable DLQ entries.
   * R13-4 FIX: Main entry point for processing DLQ messages.
   * @returns Number of entries processed
   */
  public async processPending(): Promise<number> {
    if (this.disposed) {
      return 0;
    }

    const now = nowIso();
    // R13-4 FIX: Use listRetryable to get entries ready for retry
    const retryable = this.dlqService.listRetryable(now);

    let processed = 0;
    for (const record of retryable) {
      if (this.disposed) {
        break;
      }

      try {
        const result = await this.processOne(record);
        if (result.retryAgain) {
          // Schedule next retry with backoff
          this.dlqService.scheduleRetry(record.deadLetterId);
        }
        processed++;
      } catch (error) {
        // Log error but continue processing other entries
        logger.error("DLQ consumer error processing record", {
          deadLetterId: record.deadLetterId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return processed;
  }

  /**
   * Processes a single dead letter record.
   * R13-5 FIX: Implements retry mechanism for DLQ messages.
   * R13-6 FIX: Handles max retry exceeded properly.
   * R13-7 FIX: Creates dead letter record after max retries are exhausted.
   */
  private async processOne(record: ExtendedDeadLetterRecord): Promise<{ retryAgain: boolean }> {
    // R13-6 FIX: Check if max retries exceeded
    if (record.retryCount >= record.maxRetries) {
      // R13-7 FIX: Mark as retry exhausted - this creates the dead letter record
      this.dlqService.markRetryExhausted(record.deadLetterId);
      return { retryAgain: false };
    }

    // R13-5 FIX: Attempt retry with backoff
    const backoffDelay = this.calculateBackoff(record.retryCount);

    // Check if enough time has passed since last attempt
    if (record.lastAttemptAt) {
      const timeSinceLastAttempt = Date.now() - new Date(record.lastAttemptAt).getTime();
      if (timeSinceLastAttempt < backoffDelay) {
        return { retryAgain: true };
      }
    }

    // If we have an event bus, try to re-publish the event
    if (this.eventBus && record.status !== "discarded") {
      try {
        const payload = JSON.parse(record.payloadJson);
        // Re-publish to event bus for another attempt
        this.eventBus.publish({
          eventType: this.inferEventType(record) || "dlq:republished",
          payload,
          aggregateId: this.extractAggregateId(payload),
        });

        // Mark as resolved since re-publishing succeeded
        this.dlqService.markResolved(record.deadLetterId);
        return { retryAgain: false };
      } catch (error) {
        // Re-publishing failed, schedule retry
        this.dlqService.scheduleRetry(record.deadLetterId);
        return { retryAgain: true };
      }
    }

    // No event bus available, just mark as needing retry
    this.dlqService.scheduleRetry(record.deadLetterId);
    return { retryAgain: true };
  }

  /**
   * Calculates exponential backoff delay with jitter.
   * R13-5 FIX: Uses exponential backoff for retry delays.
   */
  private calculateBackoff(retryCount: number): number {
    const exponentialDelay = Math.min(
      this.options.initialBackoffMs * Math.pow(2, retryCount),
      this.options.maxBackoffMs,
    );
    const jitter = Math.random() * exponentialDelay * 0.1;
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Infers event type from dead letter record for re-publishing.
   */
  private inferEventType(record: ExtendedDeadLetterRecord): string | null {
    // Try to extract event type from payload
    try {
      const payload = JSON.parse(record.payloadJson);
      return payload?.eventType ?? record.eventType ?? null;
    } catch {
      return record.eventType ?? null;
    }
  }

  /**
   * Extracts aggregate ID from payload if available.
   */
  private extractAggregateId(payload: Record<string, unknown>): string | null {
    return payload?.aggregateId as string | null
        ?? payload?.runId as string | null
        ?? null;
  }

  /**
   * Disposes the consumer and releases resources.
   */
  public dispose(): void {
    this.disposed = true;
  }

  /**
   * Gets metrics about the DLQ consumer state.
   */
  public getMetrics(): { pendingCount: number; retryingCount: number; discardedCount: number } {
    const all = this.dlqService.listAll();
    return {
      pendingCount: all.filter((r) => r.status === "pending").length,
      retryingCount: all.filter((r) => r.status === "retrying").length,
      discardedCount: all.filter((r) => r.status === "discarded").length,
    };
  }
}
