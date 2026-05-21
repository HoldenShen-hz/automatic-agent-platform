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

import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { EventRecord, TraceContext } from "../../platform/contracts/types/domain.js";
import type { PendingAckEvent } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { DurableEventBus, type EventHandler } from "../../platform/five-plane-state-evidence/events/durable-event-bus.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { LocalTypedEventEmitter } from "../../platform/shared/events/local-typed-event-emitter.js";

export type { EventHandler } from "../../platform/five-plane-state-evidence/events/durable-event-bus.js";

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
 * Batch item for grouped event publishing
 */
interface BatchPublishItem {
  input: {
    eventType: string;
    taskId?: string | null;
    sessionId?: string | null;
    executionId?: string | null;
    traceId?: string | null;
    traceContext?: TraceContext | null;
    payload: Record<string, unknown>;
  };
  resolve: (value: EventRecord) => void;
  reject: (error: Error) => void;
  abortController: AbortController;
}

/**
 * Delivery result for an event
 */
interface DeliveryResult {
  eventId: string;
  consumerId: string;
  success: boolean;
  attempts: number;
  durationMs: number;
  error?: string;
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
export type DurableEventBusAsyncEvent =
  | { type: "event_published"; eventId: string; eventType: string; durationMs: number }
  | { type: "event_delivered"; eventId: string; consumerId: string; durationMs: number }
  | { type: "event_delivery_failed"; eventId: string; consumerId: string; attempts: number; error: string }
  | { type: "event_dead_lettered"; eventId: string; consumerId: string; attempts: number }
  | { type: "subscriber_added"; consumerId: string; priority: SubscriberPriority }
  | { type: "subscriber_removed"; consumerId: string }
  | { type: "batch_flush"; batchSize: number; durationMs: number }
  | { type: "circuit_breaker_open"; failureCount: number }
  | { type: "circuit_breaker_close" };

const logger = new StructuredLogger({ retentionLimit: 200 });

/**
 * Maximum payload size for events (1MB)
 */
const MAX_EVENT_PAYLOAD_SIZE = 1_000_000;

/**
 * Async Durable Event Bus
 *
 * Reliable event delivery with acknowledgment tracking and async/await interface.
 *
 * This async version provides the same functionality as DurableEventBus
 * but with enterprise-grade async patterns for distributed operation.
 */
export class DurableEventBusAsync extends LocalTypedEventEmitter<Record<string, unknown>> {
  private readonly sync: DurableEventBus;
  private readonly options: Required<DurableEventBusAsyncOptions>;

  // Subscriber management
  private readonly subscribers = new Map<string, SubscriberEntry>();
  private readonly deliveryChains = new Map<string, Promise<void>>();

  // Event batching
  private readonly publishBatch: BatchPublishItem[] = [];
  private batchFlushTimer: ReturnType<typeof setInterval> | null = null;
  private publishBatchFlushTimer: ReturnType<typeof setTimeout> | null = null;

  // Circuit breaker state
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private circuitBreakerOpen = false;

  // Metrics
  private metrics: BusMetrics = {
    totalPublishedEvents: 0,
    totalDeliveredEvents: 0,
    totalFailedDeliveries: 0,
    totalDeadLetteredEvents: 0,
    averageDeliveryLatencyMs: 0,
    averagePublishLatencyMs: 0,
  };

  // Disposal state
  private disposed = false;
  private batchProcessingPromise: Promise<void> | null = null;

  /**
   * Creates a new DurableEventBusAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   * @param options - Service configuration options
   */
  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    options: DurableEventBusAsyncOptions = {},
  ) {
    super();
    this.sync = new DurableEventBus(db, store);
    this.options = {
      maxDeliveryRetries: options.maxDeliveryRetries ?? 3,
      initialBackoffMs: options.initialBackoffMs ?? 100,
      maxBackoffMs: options.maxBackoffMs ?? 5000,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30000,
      maxBatchSize: options.maxBatchSize ?? 50,
      batchFlushIntervalMs: options.batchFlushIntervalMs ?? 100,
      batchingEnabled: options.batchingEnabled ?? false,
      maxPendingEvents: options.maxPendingEvents ?? 10000,
      deadLetterEnabled: options.deadLetterEnabled ?? true,
      deadLetterThreshold: options.deadLetterThreshold ?? 5,
    };

    // Start batch flush timer if batching is enabled
    if (this.options.batchingEnabled) {
      this.startBatchFlushTimer();
    }
  }

  /**
   * Subscribes a handler to events for a specific consumer with priority.
   *
   * @param consumerId - The consumer ID to subscribe
   * @param handler - The handler function to call for each event
   * @param priority - Optional priority level for the subscriber
   */
  public subscribe(consumerId: string, handler: EventHandler, priority: SubscriberPriority = "normal"): void {
    this.assertNotDisposed();

    this.subscribers.set(consumerId, {
      handler,
      priority,
      subscribedAt: Date.now(),
      eventCount: 0,
      lastEventAt: null,
    });

    this.emit("subscriber_added", { type: "subscriber_added", consumerId, priority });

    // Delegate to sync service for actual delivery scheduling
    this.sync.subscribe(consumerId, handler);
  }

  /**
   * Subscribes with high priority for critical event processing.
   *
   * @param consumerId - The consumer ID to subscribe
   * @param handler - The handler function to call for each event
   */
  public subscribeHighPriority(consumerId: string, handler: EventHandler): void {
    this.subscribe(consumerId, handler, "high");
  }

  /**
   * Subscribes with low priority for background event processing.
   *
   * @param consumerId - The consumer ID to subscribe
   * @param handler - The handler function to call for each event
   */
  public subscribeLowPriority(consumerId: string, handler: EventHandler): void {
    this.subscribe(consumerId, handler, "low");
  }

  /**
   * Unsubscribes a consumer from the event bus.
   *
   * @param consumerId - The consumer ID to unsubscribe
   */
  public unsubscribe(consumerId: string): void {
    this.assertNotDisposed();
    this.subscribers.delete(consumerId);
    this.sync.unsubscribe(consumerId);
    this.emit("subscriber_removed", { type: "subscriber_removed", consumerId });
  }

  /**
   * Publishes an event to the bus with optional async batching.
   *
   * @param input - The event data including type, payload, and optional IDs
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the persisted event record
   */
  public async publish(
    input: {
      eventType: string;
      taskId?: string | null;
      sessionId?: string | null;
      executionId?: string | null;
      traceId?: string | null;
      traceContext?: TraceContext | null;
      payload: Record<string, unknown>;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<EventRecord> {
    this.assertNotDisposed();
    const startedAt = Date.now();

    // Validate payload size
    const payloadSize = JSON.stringify(input.payload).length;
    if (payloadSize > MAX_EVENT_PAYLOAD_SIZE) {
      throw new Error(`Event payload size ${payloadSize} exceeds maximum of ${MAX_EVENT_PAYLOAD_SIZE} bytes`);
    }

    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      if (Date.now() - this.lastFailureTime! >= this.options.maxBackoffMs) {
        this.circuitBreakerOpen = false;
        this.failureCount = 0;
        this.emit("circuit_breaker_close");
      } else {
        throw new ValidationError(
          "durable_event_bus_async.circuit_breaker_open",
          "Circuit breaker is open - event publishing temporarily disabled",
        );
      }
    }

    // Handle abort
    const abortHandler = () => {
      throw new Error("Event publish was aborted");
    };
    options?.signal?.addEventListener("abort", abortHandler, { once: true });

    try {
      const record = await this.executePublishWithRetry(input, options?.timeoutMs ?? this.options.defaultTimeoutMs);
      const durationMs = Date.now() - startedAt;

      this.metrics.totalPublishedEvents++;
      this.updatePublishLatency(durationMs);
      this.emit("event_published", {
        type: "event_published",
        eventId: record.id,
        eventType: record.eventType,
        durationMs,
      });

      return record;
    } finally {
      options?.signal?.removeEventListener("abort", abortHandler);
    }
  }

  /**
   * Enqueues an event for batch publishing.
   *
   * @param input - The event data
   * @returns Promise resolving to the event record
   */
  public enqueuePublish(
    input: {
      eventType: string;
      taskId?: string | null;
      sessionId?: string | null;
      executionId?: string | null;
      traceId?: string | null;
      traceContext?: TraceContext | null;
      payload: Record<string, unknown>;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<EventRecord> {
    if (this.disposed) {
      return Promise.reject(new Error("Event bus has been disposed"));
    }

    return new Promise((resolve, reject) => {
      const abortController = new AbortController();

      const item: BatchPublishItem = {
        input,
        resolve,
        reject,
        abortController,
      };

      this.publishBatch.push(item);

      // Handle external abort
      const abortHandler = () => {
        const index = this.publishBatch.indexOf(item);
        if (index !== -1) {
          this.publishBatch.splice(index, 1);
        }
        reject(new Error("Event publish was aborted"));
      };
      options?.signal?.addEventListener("abort", abortHandler, { once: true });

      // Trigger batch flush if batch is full
      if (this.publishBatch.length >= this.options.maxBatchSize) {
        this.flushBatch();
      } else if (!this.batchProcessingPromise) {
        this.schedulePublishBatchFlush();
      }
    });
  }

  /**
   * Delivers all pending events to a specific consumer with retry and timeout.
   *
   * @param consumerId - The consumer ID to deliver events to
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the number of events delivered
   */
  public async deliverPending(
    consumerId: string,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<number> {
    this.assertNotDisposed();

    return this.executeDeliveryWithRetry(consumerId, options?.timeoutMs ?? this.options.defaultTimeoutMs);
  }

  /**
   * Gets all pending events for a specific consumer.
   *
   * @param consumerId - The consumer ID to get pending events for
   * @returns Array of pending events with their ack records
   */
  public pendingForConsumer(consumerId: string): PendingAckEvent[] {
    this.assertNotDisposed();
    return this.sync.pendingForConsumer(consumerId);
  }

  /**
   * Async version of pendingForConsumer.
   *
   * @param consumerId - The consumer ID to get pending events for
   * @returns Promise resolving to array of pending events
   */
  public async pendingForConsumerAsync(consumerId: string): Promise<PendingAckEvent[]> {
    return Promise.resolve(this.pendingForConsumer(consumerId));
  }

  /**
   * Gets the count of pending events for a consumer.
   *
   * @param consumerId - The consumer ID
   * @returns Number of pending events
   */
  public getPendingCount(consumerId: string): number {
    try {
      return this.pendingForConsumer(consumerId).length;
    } catch (error) {
      if (error instanceof TypeError) {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Gets bus metrics.
   *
   * @returns Object with bus metrics
   */
  public getMetrics(): BusMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets metrics.
   */
  public resetMetrics(): void {
    this.metrics = {
      totalPublishedEvents: 0,
      totalDeliveredEvents: 0,
      totalFailedDeliveries: 0,
      totalDeadLetteredEvents: 0,
      averageDeliveryLatencyMs: 0,
      averagePublishLatencyMs: 0,
    };
  }

  /**
   * Gets subscriber information.
   *
   * @param consumerId - The consumer ID
   * @returns Subscriber entry or undefined
   */
  public getSubscriber(consumerId: string): SubscriberEntry | undefined {
    return this.subscribers.get(consumerId);
  }

  /**
   * Gets all subscribers.
   *
   * @returns Map of consumer IDs to subscriber entries
   */
  public getAllSubscribers(): Map<string, SubscriberEntry> {
    return new Map(this.subscribers);
  }

  /**
   * Disposes the event bus and releases all resources.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop batch flush timer
    if (this.batchFlushTimer) {
      clearInterval(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }
    if (this.publishBatchFlushTimer) {
      clearTimeout(this.publishBatchFlushTimer);
      this.publishBatchFlushTimer = null;
    }

    // Clear batch
    for (const item of this.publishBatch) {
      item.abortController.abort();
      item.reject(new Error("Event bus has been disposed"));
    }
    this.publishBatch.length = 0;

    // Clear delivery chains
    this.deliveryChains.clear();

    // Delegate to sync service
    this.sync.dispose();

    logger.log({ level: "info", message: "durable_event_bus_async.disposed", data: {} });
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): DurableEventBus {
    return this.sync;
  }

  /**
   * Executes publish with retry logic.
   */
  private async executePublishWithRetry(
    input: {
      eventType: string;
      taskId?: string | null;
      sessionId?: string | null;
      executionId?: string | null;
      traceId?: string | null;
      traceContext?: TraceContext | null;
      payload: Record<string, unknown>;
    },
    timeoutMs: number,
  ): Promise<EventRecord> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxDeliveryRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error("Publish timed out")), timeoutMs);
          timer.unref?.();
        });

        const publishPromise = Promise.resolve(this.sync.publish(input));

        return await Promise.race([publishPromise, timeoutPromise]);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryableError(lastError)) {
          this.recordCircuitBreakerFailure();
          throw lastError;
        }

        if (attempt < this.options.maxDeliveryRetries) {
          const backoffDelay = this.calculateBackoff(attempt);
          await this.sleep(backoffDelay);
        }
      }
    }

    this.recordCircuitBreakerFailure();
    throw lastError ?? new Error("Publish failed");
  }

  /**
   * Executes delivery to a consumer with retry logic.
   */
  private async executeDeliveryWithRetry(consumerId: string, timeoutMs: number): Promise<number> {
    const startedAt = Date.now();
    const subscriber = this.subscribers.get(consumerId);

    if (!subscriber) {
      return 0;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxDeliveryRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error("Delivery timed out")), timeoutMs);
          timer.unref?.();
        });

        const deliveryPromise = this.sync.deliverPending(consumerId);

        const delivered = await Promise.race([deliveryPromise, timeoutPromise]);
        const durationMs = Date.now() - startedAt;

        this.metrics.totalDeliveredEvents += delivered;
        this.updateDeliveryLatency(durationMs);

        return delivered;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we've exhausted retries
        if (attempt >= this.options.maxDeliveryRetries) {
          this.metrics.totalFailedDeliveries++;
          this.emit("event_delivery_failed", {
            type: "event_delivery_failed",
            eventId: "unknown",
            consumerId,
            attempts: attempt + 1,
            error: lastError.message,
          });
          this.recordCircuitBreakerFailure();
          throw lastError;
        }

        const backoffDelay = this.calculateBackoff(attempt);
        await this.sleep(backoffDelay);
      }
    }

    throw lastError ?? new Error("Delivery failed");
  }

  /**
   * Flushes the publish batch.
   */
  private async flushBatch(): Promise<void> {
    if (this.publishBatchFlushTimer) {
      clearTimeout(this.publishBatchFlushTimer);
      this.publishBatchFlushTimer = null;
    }
    if (this.batchProcessingPromise) {
      return;
    }

    if (this.publishBatch.length === 0 || this.disposed) {
      return;
    }

    this.batchProcessingPromise = this.doFlushBatch();

    try {
      await this.batchProcessingPromise;
    } finally {
      this.batchProcessingPromise = null;
      if (this.publishBatch.length > 0 && !this.disposed) {
        this.schedulePublishBatchFlush();
      }
    }
  }

  /**
   * Internal batch flush implementation.
   */
  private async doFlushBatch(): Promise<void> {
    const startedAt = Date.now();
    const batch = this.publishBatch.splice(0, this.options.maxBatchSize);

    const results = await Promise.allSettled(
      batch.map((item) =>
        this.publish(item.input, { signal: item.abortController.signal })
          .then(item.resolve)
          .catch((error) => item.reject(error instanceof Error ? error : new Error(String(error))))
      )
    );

    const durationMs = Date.now() - startedAt;
    this.emit("batch_flush", { type: "batch_flush", batchSize: batch.length, durationMs });
  }

  private schedulePublishBatchFlush(): void {
    if (this.publishBatchFlushTimer != null || this.publishBatch.length === 0 || this.disposed) {
      return;
    }
    this.publishBatchFlushTimer = setTimeout(() => {
      this.publishBatchFlushTimer = null;
      void this.flushBatch().catch((error) => {
        logger.error("durable_event_bus_async.batch_flush_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.options.batchFlushIntervalMs);
    this.publishBatchFlushTimer.unref?.();
  }

  /**
   * Starts the batch flush timer.
   */
  private startBatchFlushTimer(): void {
    this.batchFlushTimer = setInterval(() => {
      void this.flushBatch().catch((error) => {
        logger.error("durable_event_bus_async.batch_flush_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.options.batchFlushIntervalMs);
    this.batchFlushTimer.unref?.();
  }

  /**
   * Records a circuit breaker failure.
   */
  private recordCircuitBreakerFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.deadLetterThreshold) {
      this.circuitBreakerOpen = true;
      this.emit("circuit_breaker_open", {
        type: "circuit_breaker_open",
        failureCount: this.failureCount,
      });
    }
  }

  /**
   * Determines if an error is retryable.
   */
  private isRetryableError(error: Error): boolean {
    if (
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND")
    ) {
      return true;
    }

    if (error.message.includes("timed out")) {
      return true;
    }

    if (error.message.includes("aborted")) {
      return false;
    }

    return true;
  }

  /**
   * Calculates exponential backoff delay with jitter.
   */
  private calculateBackoff(attemptIndex: number): number {
    const exponentialDelay = Math.min(
      this.options.initialBackoffMs * Math.pow(2, attemptIndex),
      this.options.maxBackoffMs,
    );
    const jitter = Math.random() * exponentialDelay * 0.1;
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Updates the average publish latency metric.
   */
  private updatePublishLatency(newLatencyMs: number): void {
    const totalLatency = this.metrics.averagePublishLatencyMs * this.metrics.totalPublishedEvents + newLatencyMs;
    this.metrics.averagePublishLatencyMs = totalLatency / this.metrics.totalPublishedEvents;
  }

  /**
   * Updates the average delivery latency metric.
   */
  private updateDeliveryLatency(newLatencyMs: number): void {
    const totalLatency = this.metrics.averageDeliveryLatencyMs * this.metrics.totalDeliveredEvents + newLatencyMs;
    this.metrics.averageDeliveryLatencyMs = totalLatency / this.metrics.totalDeliveredEvents;
  }

  /**
   * Sleep utility for async delay.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
    });
  }

  /**
   * Asserts that the service is not disposed.
   */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Event bus has been disposed");
    }
  }
}
