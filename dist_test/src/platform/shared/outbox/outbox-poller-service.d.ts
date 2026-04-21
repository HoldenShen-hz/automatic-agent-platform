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
import { OutboxService } from "./outbox-service.js";
export interface OutboxPollerConfig {
    /** Polling interval in milliseconds (default: 100ms) */
    intervalMs: number;
    /** Maximum entries to process per poll cycle (default: 100) */
    batchSize: number;
    /** Maximum retry attempts before marking entry as failed (default: 5) */
    maxRetries: number;
    /** Initial backoff delay in milliseconds (default: 1000ms) */
    initialBackoffMs: number;
    /** Maximum backoff delay in milliseconds (default: 30000ms) */
    maxBackoffMs: number;
}
export interface OutboxPollerMetrics {
    isRunning: boolean;
    lastPollAt: string | null;
    lastPollDurationMs: number;
    totalPublished: number;
    totalFailed: number;
    pendingCount: number;
    failedCount: number;
    consecutiveEmptyPolls: number;
}
export declare class OutboxPollerService {
    private readonly outboxService;
    private readonly config;
    private intervalHandle;
    private disposed;
    private stopped;
    private lastPollAt;
    private lastPollDurationMs;
    private totalPublished;
    private totalFailed;
    private consecutiveEmptyPolls;
    constructor(outboxService: OutboxService, config?: Partial<OutboxPollerConfig>);
    /**
     * Starts the poller service. The poller will begin polling at the configured interval.
     */
    start(): void;
    /**
     * Stops the poller service gracefully. Completes in-flight publishing before stopping.
     * @param timeoutMs - Maximum time to wait for in-flight operations
     */
    stop(timeoutMs?: number): Promise<void>;
    /**
     * Disposes the poller service. Cannot be restarted after disposal.
     */
    dispose(): void;
    /**
     * Performs a single poll cycle, publishing pending outbox entries.
     */
    poll(): Promise<{
        published: number;
        failed: number;
    }>;
    /**
     * Gets current poller metrics.
     */
    getMetrics(): OutboxPollerMetrics;
    /**
     * Calculates exponential backoff delay with jitter.
     */
    private calculateBackoff;
}
