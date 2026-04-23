/**
 * Async Durable Event Bus
 *
 * Async version of DurableEventBus that provides async/await interface
 * with retry logic, timeout handling, and enhanced delivery guarantees.
 *
 * This async implementation wraps the sync service and adds:
 * - Async/await Promise-based API for publish and delivery
 * - Retry with exponential backoff for failed deliveries
 * - Timeout/cancellation support via AbortController
 * - Enhanced subscriber management with priority support
 * - Event batching for high-throughput scenarios
 * - Dead letter handling with configurable thresholds
 * - Detailed delivery telemetry and metrics
 *
 * @see DurableEventBus for the sync implementation
 */
import { EventEmitter } from "node:events";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { EventRecord, TraceContext } from "../../platform/contracts/types/domain.js";
import type { PendingAckEvent } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import { DurableEventBus, type EventHandler } from "../../platform/state-evidence/events/durable-event-bus.js";
export type { EventHandler } from "../../platform/state-evidence/events/durable-event-bus.js";
/**
 * Options for configuring the async DurableEventBus
 */
export interface DurableEventBusAsyncOptions {
    /** Maximum number of retry attempts for failed deliveries */
    maxDeliveryRetries?: number;
    /** Initial backoff delay in milliseconds */
    initialBackoffMs?: number;
    /** Maximum backoff delay in milliseconds */
    maxBackoffMs?: number;
    /** Default timeout for operations in milliseconds */
    defaultTimeoutMs?: number;
    /** Maximum batch size for event publishing */
    maxBatchSize?: number;
    /** Batch flush interval in milliseconds */
    batchFlushIntervalMs?: number;
    /** Enable event batching for high throughput */
    batchingEnabled?: boolean;
    /** Maximum pending events per consumer */
    maxPendingEvents?: number;
    /** Enable dead letter handling */
    deadLetterEnabled?: boolean;
    /** Dead letter threshold after which events are dead-lettered */
    deadLetterThreshold?: number;
}
/**
 * Subscriber priority levels
 */
type SubscriberPriority = "high" | "normal" | "low";
/**
 * Enhanced subscriber entry with priority
 */
interface SubscriberEntry {
    handler: EventHandler;
    priority: SubscriberPriority;
    subscribedAt: number;
    eventCount: number;
    lastEventAt: number | null;
}
/**
 * Bus metrics
 */
interface BusMetrics {
    totalPublishedEvents: number;
    totalDeliveredEvents: number;
    totalFailedDeliveries: number;
    totalDeadLetteredEvents: number;
    averageDeliveryLatencyMs: number;
    averagePublishLatencyMs: number;
}
/**
 * Event types emitted by the bus
 */
export type DurableEventBusAsyncEvent = {
    type: "event_published";
    eventId: string;
    eventType: string;
    durationMs: number;
} | {
    type: "event_delivered";
    eventId: string;
    consumerId: string;
    durationMs: number;
} | {
    type: "event_delivery_failed";
    eventId: string;
    consumerId: string;
    attempts: number;
    error: string;
} | {
    type: "event_dead_lettered";
    eventId: string;
    consumerId: string;
    attempts: number;
} | {
    type: "subscriber_added";
    consumerId: string;
    priority: SubscriberPriority;
} | {
    type: "subscriber_removed";
    consumerId: string;
} | {
    type: "batch_flush";
    batchSize: number;
    durationMs: number;
} | {
    type: "circuit_breaker_open";
    failureCount: number;
} | {
    type: "circuit_breaker_close";
};
/**
 * Async Durable Event Bus
 *
 * Reliable event delivery with acknowledgment tracking and async/await interface.
 *
 * This async version provides the same functionality as DurableEventBus
 * but with enterprise-grade async patterns for distributed operation.
 */
export declare class DurableEventBusAsync extends EventEmitter {
    private readonly sync;
    private readonly options;
    private readonly subscribers;
    private readonly deliveryChains;
    private readonly publishBatch;
    private batchFlushTimer;
    private failureCount;
    private lastFailureTime;
    private circuitBreakerOpen;
    private metrics;
    private disposed;
    private batchProcessingPromise;
    /**
     * Creates a new DurableEventBusAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param options - Service configuration options
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: DurableEventBusAsyncOptions);
    /**
     * Subscribes a handler to events for a specific consumer with priority.
     *
     * @param consumerId - The consumer ID to subscribe
     * @param handler - The handler function to call for each event
     * @param priority - Optional priority level for the subscriber
     */
    subscribe(consumerId: string, handler: EventHandler, priority?: SubscriberPriority): void;
    /**
     * Subscribes with high priority for critical event processing.
     *
     * @param consumerId - The consumer ID to subscribe
     * @param handler - The handler function to call for each event
     */
    subscribeHighPriority(consumerId: string, handler: EventHandler): void;
    /**
     * Subscribes with low priority for background event processing.
     *
     * @param consumerId - The consumer ID to subscribe
     * @param handler - The handler function to call for each event
     */
    subscribeLowPriority(consumerId: string, handler: EventHandler): void;
    /**
     * Unsubscribes a consumer from the event bus.
     *
     * @param consumerId - The consumer ID to unsubscribe
     */
    unsubscribe(consumerId: string): void;
    /**
     * Publishes an event to the bus with optional async batching.
     *
     * @param input - The event data including type, payload, and optional IDs
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the persisted event record
     */
    publish(input: {
        eventType: string;
        taskId?: string | null;
        sessionId?: string | null;
        executionId?: string | null;
        traceId?: string | null;
        traceContext?: TraceContext | null;
        payload: Record<string, unknown>;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<EventRecord>;
    /**
     * Enqueues an event for batch publishing.
     *
     * @param input - The event data
     * @returns Promise resolving to the event record
     */
    enqueuePublish(input: {
        eventType: string;
        taskId?: string | null;
        sessionId?: string | null;
        executionId?: string | null;
        traceId?: string | null;
        traceContext?: TraceContext | null;
        payload: Record<string, unknown>;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<EventRecord>;
    /**
     * Delivers all pending events to a specific consumer with retry and timeout.
     *
     * @param consumerId - The consumer ID to deliver events to
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the number of events delivered
     */
    deliverPending(consumerId: string, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<number>;
    /**
     * Gets all pending events for a specific consumer.
     *
     * @param consumerId - The consumer ID to get pending events for
     * @returns Array of pending events with their ack records
     */
    pendingForConsumer(consumerId: string): PendingAckEvent[];
    /**
     * Async version of pendingForConsumer.
     *
     * @param consumerId - The consumer ID to get pending events for
     * @returns Promise resolving to array of pending events
     */
    pendingForConsumerAsync(consumerId: string): Promise<PendingAckEvent[]>;
    /**
     * Gets the count of pending events for a consumer.
     *
     * @param consumerId - The consumer ID
     * @returns Number of pending events
     */
    getPendingCount(consumerId: string): number;
    /**
     * Gets bus metrics.
     *
     * @returns Object with bus metrics
     */
    getMetrics(): BusMetrics;
    /**
     * Resets metrics.
     */
    resetMetrics(): void;
    /**
     * Gets subscriber information.
     *
     * @param consumerId - The consumer ID
     * @returns Subscriber entry or undefined
     */
    getSubscriber(consumerId: string): SubscriberEntry | undefined;
    /**
     * Gets all subscribers.
     *
     * @returns Map of consumer IDs to subscriber entries
     */
    getAllSubscribers(): Map<string, SubscriberEntry>;
    /**
     * Disposes the event bus and releases all resources.
     */
    dispose(): void;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): DurableEventBus;
    /**
     * Executes publish with retry logic.
     */
    private executePublishWithRetry;
    /**
     * Executes delivery to a consumer with retry logic.
     */
    private executeDeliveryWithRetry;
    /**
     * Flushes the publish batch.
     */
    private flushBatch;
    /**
     * Internal batch flush implementation.
     */
    private doFlushBatch;
    /**
     * Starts the batch flush timer.
     */
    private startBatchFlushTimer;
    /**
     * Records a circuit breaker failure.
     */
    private recordCircuitBreakerFailure;
    /**
     * Determines if an error is retryable.
     */
    private isRetryableError;
    /**
     * Calculates exponential backoff delay with jitter.
     */
    private calculateBackoff;
    /**
     * Updates the average publish latency metric.
     */
    private updatePublishLatency;
    /**
     * Updates the average delivery latency metric.
     */
    private updateDeliveryLatency;
    /**
     * Sleep utility for async delay.
     */
    private sleep;
    /**
     * Asserts that the service is not disposed.
     */
    private assertNotDisposed;
}
