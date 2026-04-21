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
import type { OutboxInsertPayload, OutboxRecord } from "./outbox-types.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
export interface TransactionContext {
    execute(sql: string, ...params: unknown[]): void;
}
export interface OutboxServiceConfig {
    maxBatchSize: number;
    publishTimeoutMs: number;
}
export declare class OutboxService {
    private readonly eventBus;
    private readonly repo;
    private readonly config;
    constructor(db: AuthoritativeSqlDatabase, eventBus: DurableEventBus, config?: Partial<OutboxServiceConfig>);
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
    writeOutboxEntry(aggregateType: string, aggregateId: string, eventType: string, payload: Record<string, unknown>, traceId?: string | null): OutboxRecord;
    /**
     * Writes multiple outbox entries atomically.
     * All entries are inserted in a single batch for efficiency.
     *
     * @param entries - Array of outbox entry payloads
     */
    writeOutboxEntries(entries: OutboxInsertPayload[]): OutboxRecord[];
    /**
     * Gets the current pending (unpublished) outbox entries.
     * Used by the poller service to fetch entries for publishing.
     *
     * @param limit - Maximum number of entries to return
     */
    getPendingEntries(limit?: number): OutboxRecord[];
    /**
     * Gets count of pending outbox entries.
     */
    getPendingCount(): number;
    /**
     * Gets count of failed outbox entries.
     */
    getFailedCount(): number;
    /**
     * Manually marks an outbox entry as published.
     * Typically used after successful publishing.
     *
     * @param id - Outbox entry ID
     */
    markPublished(id: string): void;
    /**
     * Manually marks an outbox entry as failed.
     * Typically used after exhausting retries.
     *
     * @param id - Outbox entry ID
     * @param error - Error message
     * @param retryCount - Current retry count
     * @param lastAttemptAt - Timestamp of the last attempt
     */
    markFailed(id: string, error: string, retryCount: number, lastAttemptAt: string): void;
    /**
     * Publishes a single outbox entry to the event bus.
     * Updates the outbox record based on success or failure.
     *
     * @param entry - The outbox entry to publish
     * @returns true if published successfully
     */
    publishEntry(entry: OutboxRecord): Promise<boolean>;
    /**
     * Publishes all pending outbox entries to the event bus.
     * Used by the OutboxPollerService during polling cycles.
     *
     * @returns Object with counts of published and failed entries
     */
    publishPending(): Promise<{
        published: number;
        failed: number;
    }>;
}
