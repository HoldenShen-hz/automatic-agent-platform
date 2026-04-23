/**
 * OutboxPollerService - Asynchronous poller for the transactional outbox pattern.
 *
 * ## Architecture
 *
 * The OutboxPollerService runs on a periodic interval, polling the outbox table
 * for unpublished entries and publishing them to the event bus. This enables
 * reliable event delivery without requiring the caller to manage event publishing.
 *
 * ## Key Properties
 *
 * - Runs at a configurable interval (default: 100ms)
 * - Uses exponential backoff for failed entries
 * - Supports batch publishing for efficiency
 * - Graceful shutdown with in-flight completion
 *
 * @see OutboxService for the main outbox coordination logic
 * @see OutboxRepository for data access
 */
import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../observability/structured-logger.js";
const DEFAULT_POLLER_CONFIG = {
    intervalMs: 100,
    batchSize: 100,
    maxRetries: 5,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
};
const logger = new StructuredLogger({ retentionLimit: 200 });
export class OutboxPollerService {
    outboxService;
    config;
    intervalHandle = null;
    disposed = false;
    stopped = false;
    lastPollAt = null;
    lastPollDurationMs = 0;
    totalPublished = 0;
    totalFailed = 0;
    consecutiveEmptyPolls = 0;
    constructor(outboxService, config = {}) {
        this.outboxService = outboxService;
        this.config = { ...DEFAULT_POLLER_CONFIG, ...config };
    }
    /**
     * Starts the poller service. The poller will begin polling at the configured interval.
     */
    start() {
        if (this.disposed) {
            throw new Error("OutboxPollerService is disposed");
        }
        if (this.intervalHandle !== null) {
            return;
        }
        this.stopped = false;
        this.intervalHandle = setInterval(() => {
            void this.poll();
        }, this.config.intervalMs);
        // Don't prevent process exit
        this.intervalHandle.unref();
        logger.log({
            level: "info",
            message: "outbox_poller.started",
            data: { intervalMs: this.config.intervalMs, batchSize: this.config.batchSize },
        });
    }
    /**
     * Stops the poller service gracefully. Completes in-flight publishing before stopping.
     * @param timeoutMs - Maximum time to wait for in-flight operations
     */
    async stop(timeoutMs = 5000) {
        if (this.intervalHandle === null) {
            return;
        }
        this.stopped = true;
        clearInterval(this.intervalHandle);
        this.intervalHandle = null;
        // Give in-flight operations time to complete
        const startWait = Date.now();
        while (Date.now() - startWait < timeoutMs) {
            if (this.lastPollDurationMs === 0) {
                break;
            }
            await sleep(10);
        }
        logger.log({
            level: "info",
            message: "outbox_poller.stopped",
            data: {
                totalPublished: this.totalPublished,
                totalFailed: this.totalFailed,
            },
        });
    }
    /**
     * Disposes the poller service. Cannot be restarted after disposal.
     */
    dispose() {
        this.disposed = true;
        if (this.intervalHandle !== null) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }
    /**
     * Performs a single poll cycle, publishing pending outbox entries.
     */
    async poll() {
        if (this.disposed || this.stopped) {
            return { published: 0, failed: 0 };
        }
        const startTime = Date.now();
        const pendingCount = this.outboxService.getPendingCount();
        if (pendingCount === 0) {
            this.consecutiveEmptyPolls++;
            this.lastPollAt = nowIso();
            this.lastPollDurationMs = Date.now() - startTime;
            return { published: 0, failed: 0 };
        }
        this.consecutiveEmptyPolls = 0;
        const entries = this.outboxService.getPendingEntries(this.config.batchSize);
        let published = 0;
        let failed = 0;
        for (const entry of entries) {
            if (this.disposed || this.stopped) {
                break;
            }
            if (entry.retryCount >= this.config.maxRetries) {
                // Skip entries that have exhausted retries
                failed++;
                continue;
            }
            if (entry.retryCount > 0) {
                // Apply exponential backoff based on last attempt time
                const backoffDelay = this.calculateBackoff(entry.retryCount);
                const lastAttemptTime = entry.lastAttemptAt
                    ? new Date(entry.lastAttemptAt).getTime()
                    : new Date(entry.createdAt).getTime();
                const timeSinceLastAttempt = Date.now() - lastAttemptTime;
                if (timeSinceLastAttempt < backoffDelay) {
                    continue;
                }
            }
            const success = await this.outboxService.publishEntry(entry);
            if (success) {
                published++;
            }
            else {
                failed++;
            }
        }
        this.lastPollAt = nowIso();
        this.lastPollDurationMs = Date.now() - startTime;
        this.totalPublished += published;
        this.totalFailed += failed;
        if (published > 0 || failed > 0) {
            logger.log({
                level: "debug",
                message: "outbox_poller.poll_completed",
                data: {
                    published,
                    failed,
                    pendingCount: this.outboxService.getPendingCount(),
                    durationMs: this.lastPollDurationMs,
                },
            });
        }
        return { published, failed };
    }
    /**
     * Gets current poller metrics.
     */
    getMetrics() {
        return {
            isRunning: this.intervalHandle !== null && !this.stopped,
            lastPollAt: this.lastPollAt,
            lastPollDurationMs: this.lastPollDurationMs,
            totalPublished: this.totalPublished,
            totalFailed: this.totalFailed,
            pendingCount: this.outboxService.getPendingCount(),
            failedCount: this.outboxService.getFailedCount(),
            consecutiveEmptyPolls: this.consecutiveEmptyPolls,
        };
    }
    /**
     * Calculates exponential backoff delay with jitter.
     */
    calculateBackoff(retryCount) {
        const exponentialDelay = Math.min(this.config.initialBackoffMs * Math.pow(2, retryCount - 1), this.config.maxBackoffMs);
        const jitter = Math.random() * exponentialDelay * 0.1;
        return Math.round(exponentialDelay + jitter);
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=outbox-poller-service.js.map