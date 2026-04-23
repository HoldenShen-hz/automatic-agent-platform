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
import { OutboxRepository } from "./outbox-repository.js";
import { StructuredLogger } from "../observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 200 });
const DEFAULT_CONFIG = {
    maxBatchSize: 100,
    publishTimeoutMs: 5000,
};
export class OutboxService {
    eventBus;
    repo;
    config;
    localEntries = new Map();
    constructor(db, eventBus, config = {}) {
        this.eventBus = eventBus;
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
    writeOutboxEntry(aggregateType, aggregateId, eventType, payload, traceId) {
        const entry = this.repo.insertOutboxEntry(aggregateType, aggregateId, eventType, JSON.stringify(payload), traceId ?? null, nowIso());
        this.localEntries.set(entry.id, entry);
        return entry;
    }
    /**
     * Writes multiple outbox entries atomically.
     * All entries are inserted in a single batch for efficiency.
     *
     * @param entries - Array of outbox entry payloads
     */
    writeOutboxEntries(entries) {
        const records = this.repo.insertOutboxEntries(entries);
        for (const record of records) {
            this.localEntries.set(record.id, record);
        }
        return records;
    }
    /**
     * Gets the current pending (unpublished) outbox entries.
     * Used by the poller service to fetch entries for publishing.
     *
     * @param limit - Maximum number of entries to return
     */
    getPendingEntries(limit) {
        const effectiveLimit = limit ?? this.config.maxBatchSize;
        const repoEntries = this.repo.listPendingEntries(effectiveLimit);
        const merged = this.mergeEntries(repoEntries);
        return merged
            .filter((entry) => entry.publishedAt == null)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
            .slice(0, effectiveLimit);
    }
    /**
     * Gets count of pending outbox entries.
     */
    getPendingCount() {
        const repoPending = this.repo.listPendingEntries(Number.MAX_SAFE_INTEGER);
        return this.mergeEntries(repoPending).filter((entry) => entry.publishedAt == null).length;
    }
    /**
     * Gets count of failed outbox entries.
     */
    getFailedCount() {
        const repoFailed = this.repo.listFailedEntries(Number.MAX_SAFE_INTEGER);
        return this.mergeEntries(repoFailed)
            .filter((entry) => entry.publishedAt == null && entry.retryCount > 0)
            .length;
    }
    /**
     * Manually marks an outbox entry as published.
     * Typically used after successful publishing.
     *
     * @param id - Outbox entry ID
     */
    markPublished(id) {
        const publishedAt = nowIso();
        this.repo.markPublished(id, publishedAt);
        const localEntry = this.localEntries.get(id);
        if (localEntry != null) {
            this.localEntries.delete(id);
        }
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
    markFailed(id, error, retryCount, lastAttemptAt) {
        this.repo.markFailed(id, error, retryCount, lastAttemptAt);
        const localEntry = this.localEntries.get(id);
        if (localEntry != null) {
            localEntry.lastError = error;
            localEntry.retryCount = retryCount;
            localEntry.lastAttemptAt = lastAttemptAt;
            this.localEntries.set(id, localEntry);
        }
    }
    /**
     * Publishes a single outbox entry to the event bus.
     * Updates the outbox record based on success or failure.
     *
     * @param entry - The outbox entry to publish
     * @returns true if published successfully
     */
    async publishEntry(entry) {
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
            this.localEntries.delete(entry.id);
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const newRetryCount = entry.retryCount + 1;
            this.repo.markFailed(entry.id, errorMessage, newRetryCount, nowIso());
            this.updateLocalFailure(entry.id, errorMessage, newRetryCount);
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
     * Publishes multiple outbox entries to the event bus in a single batch operation.
     * This is more efficient than publishing entries one-by-one, especially during backpressure.
     * All entries are published in a single eventBus.publishBatch() call.
     *
     * @param entries - The outbox entries to publish
     * @returns Object with counts of published and failed entries
     */
    async publishEntriesBatch(entries) {
        if (entries.length === 0) {
            return { published: 0, failed: 0 };
        }
        const now = nowIso();
        const publishInputs = entries.map((entry) => {
            const payload = JSON.parse(entry.payloadJson);
            return {
                eventType: entry.eventType,
                taskId: entry.aggregateType === "task" ? entry.aggregateId : null,
                executionId: entry.aggregateType === "execution" ? entry.aggregateId : null,
                traceId: entry.traceId,
                payload,
            };
        });
        try {
            // Publish all entries in a single batch operation
            this.eventBus.publishBatch(publishInputs);
            // Mark all entries as published in a single batch
            const successfulIds = entries.map((entry) => entry.id);
            this.repo.markPublishedBatch(successfulIds, now);
            for (const id of successfulIds) {
                this.localEntries.delete(id);
            }
            logger.log({
                level: "debug",
                message: "outbox.published_batch",
                data: {
                    count: successfulIds.length,
                    ids: successfulIds,
                },
            });
            return { published: successfulIds.length, failed: 0 };
        }
        catch (error) {
            // If the batch fails, fall back to marking all as failed
            const errorMessage = error instanceof Error ? error.message : String(error);
            const failedEntries = [];
            for (const entry of entries) {
                const newRetryCount = entry.retryCount + 1;
                this.repo.markFailed(entry.id, errorMessage, newRetryCount, now);
                this.updateLocalFailure(entry.id, errorMessage, newRetryCount, now);
                failedEntries.push(entry.id);
                logger.log({
                    level: "warn",
                    message: "outbox.publish_batch_failed",
                    data: {
                        id: entry.id,
                        eventType: entry.eventType,
                        errorMessage,
                        retryCount: newRetryCount,
                    },
                });
            }
            return { published: 0, failed: failedEntries.length };
        }
    }
    /**
     * Publishes all pending outbox entries to the event bus.
     * Used by the OutboxPollerService during polling cycles.
     *
     * @returns Object with counts of published and failed entries
     */
    async publishPending() {
        const entries = this.getPendingEntries();
        if (entries.length === 0) {
            return { published: 0, failed: 0 };
        }
        const now = nowIso();
        const successfulIds = [];
        const failedEntries = [];
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
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const newRetryCount = entry.retryCount + 1;
                this.repo.markFailed(entry.id, errorMessage, newRetryCount, now);
                this.updateLocalFailure(entry.id, errorMessage, newRetryCount, now);
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
            for (const id of successfulIds) {
                this.localEntries.delete(id);
            }
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
    mergeEntries(repoEntries) {
        const merged = new Map();
        for (const entry of repoEntries) {
            merged.set(entry.id, entry);
        }
        for (const entry of this.localEntries.values()) {
            if (!merged.has(entry.id)) {
                merged.set(entry.id, entry);
            }
        }
        return [...merged.values()];
    }
    updateLocalFailure(id, error, retryCount, lastAttemptAt = nowIso()) {
        const localEntry = this.localEntries.get(id);
        if (localEntry != null) {
            localEntry.lastError = error;
            localEntry.retryCount = retryCount;
            localEntry.lastAttemptAt = lastAttemptAt;
            this.localEntries.set(id, localEntry);
        }
    }
}
//# sourceMappingURL=outbox-service.js.map