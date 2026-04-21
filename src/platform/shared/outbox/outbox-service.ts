/**
 * OutboxService - Coordinates transactional outbox pattern for reliable event delivery.
 *
 * ## Architecture
 *
 * The OutboxService enables the transactional outbox pattern:
 * 1. Business logic writes to the database and outbox in the same transaction
 * 2. The OutboxPollerService asynchronously reads pending entries and publishes to the event bus
 * 3. Published entries are marked as published, ensuring at-least-once delivery
 *
 * ## Usage
 *
 * ```typescript
 * // Within a transaction-aware context:
 * await outboxService.writeWithOutbox(
 *   "task",
 *   taskId,
 *   "task:status_changed",
 *   { status: "running", taskId },
 *   (tx) => tx.update("tasks", { status: "running" }, { id: taskId })
 * );
 * ```
 */

import { nowIso } from "../../contracts/types/ids.js";
import type { OutboxInsertPayload, OutboxRecord } from "./outbox-types.js";
import { OutboxRepository } from "./outbox-repository.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
import { StructuredLogger } from "../observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

export interface TransactionContext {
  execute(sql: string, ...params: unknown[]): void;
}

export interface OutboxServiceConfig {
  maxBatchSize: number;
  publishTimeoutMs: number;
}

const DEFAULT_CONFIG: OutboxServiceConfig = {
  maxBatchSize: 100,
  publishTimeoutMs: 5000,
};

export class OutboxService {
  private readonly repo: OutboxRepository;
  private readonly config: OutboxServiceConfig;

  public constructor(
    db: AuthoritativeSqlDatabase,
    private readonly eventBus: DurableEventBus,
    config: Partial<OutboxServiceConfig> = {},
  ) {
    this.repo = new OutboxRepository(db.connection);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Writes an outbox entry within a transaction-aware context.
   * The entry is persisted immediately and will be published asynchronously
   * by the OutboxPollerService.
   *
   * @param aggregateType - Type of aggregate (e.g., "task", "execution")
   * @param aggregateId - ID of the aggregate instance
   * @param eventType - Event type (e.g., "task:status_changed")
   * @param payload - Event payload
   * @param traceId - Optional trace ID for distributed tracing
   */
  public writeOutboxEntry(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
    traceId?: string | null,
  ): OutboxRecord {
    return this.repo.insertOutboxEntry(
      aggregateType,
      aggregateId,
      eventType,
      JSON.stringify(payload),
      traceId ?? null,
      nowIso(),
    );
  }

  /**
   * Writes multiple outbox entries atomically.
   * All entries are inserted in a single batch for efficiency.
   *
   * @param entries - Array of outbox entry payloads
   */
  public writeOutboxEntries(entries: OutboxInsertPayload[]): OutboxRecord[] {
    return this.repo.insertOutboxEntries(entries);
  }

  /**
   * Gets the current pending (unpublished) outbox entries.
   * Used by the poller service to fetch entries for publishing.
   *
   * @param limit - Maximum number of entries to return
   */
  public getPendingEntries(limit?: number): OutboxRecord[] {
    return this.repo.listPendingEntries(limit ?? this.config.maxBatchSize);
  }

  /**
   * Gets count of pending outbox entries.
   */
  public getPendingCount(): number {
    return this.repo.countPending();
  }

  /**
   * Gets count of failed outbox entries.
   */
  public getFailedCount(): number {
    return this.repo.countFailed();
  }

  /**
   * Manually marks an outbox entry as published.
   * Typically used after successful publishing.
   *
   * @param id - Outbox entry ID
   */
  public markPublished(id: string): void {
    this.repo.markPublished(id, nowIso());
  }

  /**
   * Manually marks an outbox entry as failed.
   * Typically used after exhausting retries.
   *
   * @param id - Outbox entry ID
   * @param error - Error message
   * @param retryCount - Current retry count
   * @param lastAttemptAt - Timestamp of the last attempt
   */
  public markFailed(id: string, error: string, retryCount: number, lastAttemptAt: string): void {
    this.repo.markFailed(id, error, retryCount, lastAttemptAt);
  }

  /**
   * Publishes a single outbox entry to the event bus.
   * Updates the outbox record based on success or failure.
   *
   * @param entry - The outbox entry to publish
   * @returns true if published successfully
   */
  public async publishEntry(entry: OutboxRecord): Promise<boolean> {
    try {
      const payload = JSON.parse(entry.payloadJson);
      this.eventBus.publish({
        eventType: entry.eventType,
        taskId: entry.aggregateType === "task" ? entry.aggregateId : null,
        executionId: entry.aggregateType === "execution" ? entry.aggregateId : null,
        traceId: entry.traceId,
        payload,
      });

      this.repo.markPublished(entry.id, nowIso());
      logger.log({
        level: "debug",
        message: "outbox.published",
        data: {
          id: entry.id,
          eventType: entry.eventType,
          aggregateType: entry.aggregateType,
          aggregateId: entry.aggregateId,
        },
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const newRetryCount = entry.retryCount + 1;
      this.repo.markFailed(entry.id, errorMessage, newRetryCount, nowIso());

      logger.log({
        level: "warn",
        message: "outbox.publish_failed",
        data: {
          id: entry.id,
          eventType: entry.eventType,
          errorMessage,
          retryCount: newRetryCount,
        },
      });

      return false;
    }
  }

  /**
   * Publishes all pending outbox entries to the event bus.
   * Used by the OutboxPollerService during polling cycles.
   *
   * @returns Object with counts of published and failed entries
   */
  public async publishPending(): Promise<{ published: number; failed: number }> {
    const entries = this.getPendingEntries();
    if (entries.length === 0) {
      return { published: 0, failed: 0 };
    }

    const now = nowIso();
    const successfulIds: string[] = [];
    const failedEntries: string[] = [];

    // Batch publish entries
    for (const entry of entries) {
      try {
        const payload = JSON.parse(entry.payloadJson);
        this.eventBus.publish({
          eventType: entry.eventType,
          taskId: entry.aggregateType === "task" ? entry.aggregateId : null,
          executionId: entry.aggregateType === "execution" ? entry.aggregateId : null,
          traceId: entry.traceId,
          payload,
        });
        successfulIds.push(entry.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newRetryCount = entry.retryCount + 1;
        this.repo.markFailed(entry.id, errorMessage, newRetryCount, now);
        failedEntries.push(entry.id);

        logger.log({
          level: "warn",
          message: "outbox.publish_failed",
          data: {
            id: entry.id,
            eventType: entry.eventType,
            errorMessage,
            retryCount: newRetryCount,
          },
        });
      }
    }

    // Batch update successful entries
    if (successfulIds.length > 0) {
      this.repo.markPublishedBatch(successfulIds, now);

      logger.log({
        level: "debug",
        message: "outbox.published_batch",
        data: {
          count: successfulIds.length,
          ids: successfulIds,
        },
      });
    }

    return { published: successfulIds.length, failed: failedEntries.length };
  }
}
