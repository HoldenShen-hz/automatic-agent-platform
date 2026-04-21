import { newId, nowIso } from "../../contracts/types/ids.js";
import type { EventRecord, TraceContext } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore, type PendingAckEvent } from "../truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
import { getEventSchema, validateEventPayload } from "./event-registry.js";
import { injectTraceContext } from "../../shared/observability/trace-context.js";
import { ValidationError, WorkflowStateError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

// REL-01: dedicated logger for dead-letter visibility. The ack row already
// persists the final status and error code, but there was previously no
// operator-visible signal — failures were silently buried under a generic
// workflow error. This logger emits a structured `event_bus.dead_letter`
// record that alerting pipelines can subscribe to.
const eventBusLogger = new StructuredLogger({ retentionLimit: 200 });

/**
 * Handler function type for processing events.
 * May return void or a Promise for async handlers.
 */
export type EventHandler = (event: EventRecord) => void | Promise<void>;

/**
 * Maximum number of delivery retry attempts before dead-lettering an event.
 */
const MAX_DELIVERY_RETRIES = 3;

/**
 * Initial backoff delay in milliseconds before first retry.
 */
const INITIAL_BACKOFF_MS = 100;

/**
 * Maximum backoff delay cap in milliseconds.
 */
const MAX_BACKOFF_MS = 5000;

/**
 * Calculates exponential backoff delay with jitter for retry intervals.
 * Uses exponential increase with a cap and adds random jitter to prevent thundering herd.
 * @param attemptIndex - The current retry attempt number (0-based)
 * @returns Delay in milliseconds to wait before next retry
 */
function calculateBackoff(attemptIndex: number): number {
  const exponentialDelay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attemptIndex), MAX_BACKOFF_MS);
  const jitter = Math.random() * exponentialDelay * 0.1;
  return Math.round(exponentialDelay + jitter);
}

/**
 * Durable Event Bus - Reliable event delivery with acknowledgment tracking.
 *
 * ## Architecture
 *
 * Implements the event delivery semantics defined in the
 * {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/contracts/event_registry_and_ops_threshold_contract.md | Event Registry Contract}.
 *
 * ## Event Flow
 *
 * ```
 * Producer → Insert Into events table → Register event_consumer_acks → Commit → Dispatch To Consumers → Per-Consumer Ack/Retry
 * ```
 *
 * ## Tier Semantics
 *
 * - **Tier 1**: Must write event + create ack records before returning. Consumer must ack.
 *   Consumers receive tier-1 events via `deliverPending()` polling or a separate fan-out process.
 * - **Tier 2**: Event written, ack optional. Used for dispatch, worker, recovery events.
 * - **Tier 3**: Best-effort delivery (e.g., stream chunks for SSE).
 *
 * ## Key Properties
 *
 * - Events are immutable once published
 * - Each consumer maintains its own ack status
 * - Failed deliveries can be retried via replay
 *
 * @see Event Registry Contract: docs_zh/contracts/event_registry_and_ops_threshold_contract.md
 * @see Event Bus Contract: docs_zh/contracts/event_bus_contract.md
 */
export class DurableEventBus {
  private readonly subscribers = new Map<string, EventHandler>();
  private readonly deliveryChains = new Map<string, Promise<void>>();
  private disposed = false;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {}

  /**
   * Subscribes a handler to events for a specific consumer.
   * The handler will be called for events delivered to this consumer.
   * @param consumerId - The consumer ID to subscribe
   * @param handler - The handler function to call for each event
   */
  public subscribe(consumerId: string, handler: EventHandler): void {
    this.assertNotDisposed();
    this.subscribers.set(consumerId, handler);
    this.scheduleDelivery(consumerId);
  }

  /**
   * Unsubscribes a consumer from the event bus.
   * @param consumerId - The consumer ID to unsubscribe
   */
  public unsubscribe(consumerId: string): void {
    this.subscribers.delete(consumerId);
  }

  /**
   * Disposes the event bus and rejects subsequent operations.
   * Clears all in-memory subscribers and delivery chains so long-lived processes
   * can shut down without leaving stale fan-out state behind.
   */
  public dispose(): void {
    this.disposed = true;
    this.subscribers.clear();
    this.deliveryChains.clear();
  }

  /**
   * Publishes an event to the bus, storing it durably and creating ack records for required consumers.
   *
   * @param input - The event data including type, payload, and optional IDs
   * @returns The persisted event record
   */
  public publish(input: {
    eventType: string;
    taskId?: string | null;
    sessionId?: string | null;
    executionId?: string | null;
    traceId?: string | null;
    traceContext?: TraceContext | null;
    payload: Record<string, unknown>;
  }): EventRecord {
    this.assertNotDisposed();
    const validatedPayload = validateEventPayload(
      input.eventType,
      injectTraceContext(input.payload, input.traceContext ?? null),
    );
    // V-03: Validate payload size before storing
    const payloadSize = JSON.stringify(validatedPayload).length;
    if (payloadSize > 1_000_000) {
      throw new ValidationError("event.payload_too_large", `Event payload size ${payloadSize} exceeds maximum of 1000000 bytes`, {
        details: { payloadSize, maxSize: 1_000_000 },
      });
    }

    const schema = getEventSchema(input.eventType);
    const eventRecord = this.db.transaction(() =>
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: input.taskId ?? null,
        sessionId: input.sessionId ?? null,
        executionId: input.executionId ?? null,
        eventType: input.eventType,
        eventTier: schema.tier,
        payloadJson: JSON.stringify(validatedPayload),
        traceId: input.traceContext?.traceId ?? input.traceId ?? null,
        createdAt: nowIso(),
      }),
    );

    if (eventRecord.eventTier !== "tier_1") {
      this.dispatchVolatile(eventRecord);
    }
    this.scheduleFanOut();

    return eventRecord;
  }

  /**
   * Publishes multiple events to the bus in a single batch operation.
   * All events are validated, inserted in a single transaction, and dispatched together.
   * This is more efficient than publishing events one-by-one during backpressure.
   *
   * @param inputs - Array of event data to publish
   * @returns Array of persisted event records
   */
  public publishBatch(inputs: Array<{
    eventType: string;
    taskId?: string | null;
    sessionId?: string | null;
    executionId?: string | null;
    traceId?: string | null;
    traceContext?: TraceContext | null;
    payload: Record<string, unknown>;
  }>): EventRecord[] {
    this.assertNotDisposed();

    // Validate all payloads upfront before any database writes
    const validatedPayloads = inputs.map((input) => {
      const validatedPayload = validateEventPayload(
        input.eventType,
        injectTraceContext(input.payload, input.traceContext ?? null),
      );
      // V-03: Validate payload size before storing
      const payloadSize = JSON.stringify(validatedPayload).length;
      if (payloadSize > 1_000_000) {
        throw new ValidationError("event.payload_too_large", `Event payload size ${payloadSize} exceeds maximum of 1000000 bytes`, {
          details: { payloadSize, maxSize: 1_000_000 },
        });
      }
      return validatedPayload;
    });

    // Insert all events in a single transaction for efficiency
    const eventRecords = this.db.transaction(() =>
      inputs.map((input, index) => {
        const schema = getEventSchema(input.eventType);
        return this.store.event.insertEvent({
          id: newId("evt"),
          taskId: input.taskId ?? null,
          sessionId: input.sessionId ?? null,
          executionId: input.executionId ?? null,
          eventType: input.eventType,
          eventTier: schema.tier,
          payloadJson: JSON.stringify(validatedPayloads[index]),
          traceId: input.traceContext?.traceId ?? input.traceId ?? null,
          createdAt: nowIso(),
        });
      }),
    );

    // Dispatch volatile events and schedule fan-out once for the batch
    const nonTier1Records = eventRecords.filter((record) => record.eventTier !== "tier_1");
    for (const eventRecord of nonTier1Records) {
      this.dispatchVolatile(eventRecord);
    }
    if (nonTier1Records.length > 0) {
      this.scheduleFanOut();
    }

    return eventRecords;
  }

  /**
   * Delivers all pending events to a specific consumer.
   * Continues processing even if individual deliveries fail, but throws if any event
   * ends up dead-lettered after exhausting retries.
   * @param consumerId - The consumer ID to deliver events to
   * @returns The number of events delivered
   * @throws Error if any event is dead-lettered
   */
  public async deliverPending(consumerId: string): Promise<number> {
    this.assertNotDisposed();
    return this.enqueueDelivery(consumerId, false);
  }

  /**
   * Gets all pending events for a specific consumer.
   * @param consumerId - The consumer ID to get pending events for
   * @returns Array of pending events with their ack records
   */
  public pendingForConsumer(consumerId: string): PendingAckEvent[] {
    this.assertNotDisposed();
    return this.store.event.listPendingEventsForConsumer(consumerId);
  }

  /**
   * Internal method that actually performs the delivery to a consumer.
   * @param consumerId - The consumer ID to deliver events to
   * @returns The number of events delivered
   */
  private async deliverPendingNow(consumerId: string): Promise<number> {
    const pending = this.store.event.listPendingEventsForConsumer(consumerId);
    const handler = this.subscribers.get(consumerId);
    if (!handler) {
      return pending.length;
    }

    let delivered = 0;
    let deadLetteredCount = 0;

    for (const item of pending) {
      const result = await this.deliverOneWithResult(item, handler);
      if (result.delivered) {
        delivered++;
      } else if (result.deadLettered) {
        deadLetteredCount++;
      }
    }

    if (deadLetteredCount > 0) {
      throw new WorkflowStateError(
        "event_delivery.dead_lettered",
        `event_delivery.dead_lettered: ${deadLetteredCount} event(s) failed to deliver after ${MAX_DELIVERY_RETRIES} retries and were dead-lettered`,
        { details: { deadLetteredCount, maxRetries: MAX_DELIVERY_RETRIES } },
      );
    }

    return delivered;
  }

  /**
   * Delivers a single event to a handler with retry and exponential backoff.
   * After max retries, marks as dead-lettered.
   * @param item - The pending event with its ack record
   * @param handler - The handler to deliver the event to
   */
  private async deliverOne(item: PendingAckEvent, handler: EventHandler): Promise<void> {
    const result = await this.deliverOneWithResult(item, handler);
    if (result.deadLettered) {
      throw new WorkflowStateError(
        `event_delivery.failed: event ${item.event.id} dead-lettered after ${MAX_DELIVERY_RETRIES} retries`,
        `Event ${item.event.id} failed to deliver after ${MAX_DELIVERY_RETRIES} retries`,
        { details: { eventId: item.event.id, maxRetries: MAX_DELIVERY_RETRIES } },
      );
    }
  }

  /**
   * Delivers a single event to a handler with retry and exponential backoff.
   * Returns a result indicating whether delivery succeeded or dead-lettered.
   * @param item - The pending event with its ack record
   * @param handler - The handler to deliver the event to
   * @returns Result indicating delivered or deadLettered status
   */
  private async deliverOneWithResult(item: PendingAckEvent, handler: EventHandler): Promise<{ delivered: boolean; deadLettered: boolean }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_DELIVERY_RETRIES; attempt++) {
      try {
        await handler(item.event);
        this.store.event.markEventAck({
          eventId: item.event.id,
          consumerId: item.ack.consumerId,
          status: "acked",
          occurredAt: nowIso(),
        });
        return { delivered: true, deadLettered: false };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_DELIVERY_RETRIES) {
          const backoffDelay = calculateBackoff(attempt);
          await sleep(backoffDelay);
        }
      }
    }

    // All retries exhausted - mark as failed (will be retried on next replay)
    const errorMessage = lastError
      ? `failed_after_${MAX_DELIVERY_RETRIES}_retries: ${lastError.message}`
      : `failed_after_${MAX_DELIVERY_RETRIES}_retries: unknown_error`;

    this.store.event.markEventAck({
      eventId: item.event.id,
      consumerId: item.ack.consumerId,
      status: "failed",
      occurredAt: nowIso(),
      errorCode: errorMessage,
    });

    // REL-01: structured alert log on dead-letter. Persistence is handled
    // by the event_consumer_acks row above (status=failed, error_code set);
    // this log surfaces the failure to operators/alerting so a silent drop
    // cannot happen. retentionLimit=200 keeps a rolling audit buffer.
    eventBusLogger.log({
      level: "error",
      message: "event_bus.dead_letter",
      data: {
        eventId: item.event.id,
        eventType: item.event.eventType,
        taskId: item.event.taskId,
        executionId: item.event.executionId,
        consumerId: item.ack.consumerId,
        attempts: MAX_DELIVERY_RETRIES,
        errorCode: errorMessage,
        lastError: lastError instanceof Error ? lastError.message : null,
      },
    });

    return { delivered: false, deadLettered: true };
  }

  /**
   * Schedules fan-out delivery to all registered subscribers.
   */
  private scheduleFanOut(): void {
    if (this.disposed) {
      return;
    }
    for (const consumerId of this.subscribers.keys()) {
      this.scheduleDelivery(consumerId);
    }
  }

  /**
   * Schedules delivery to a specific consumer.
   * @param consumerId - The consumer ID to schedule delivery for
   */
  private scheduleDelivery(consumerId: string): void {
    if (this.disposed) {
      return;
    }
    void this.enqueueDelivery(consumerId, true);
  }

  private dispatchVolatile(event: EventRecord): void {
    for (const [consumerId, handler] of this.subscribers.entries()) {
      const prior = this.deliveryChains.get(consumerId) ?? Promise.resolve();
      const next = prior
        .catch(() => undefined)
        .then(async () => {
          this.assertNotDisposed();
          try {
            await handler(event);
          } catch (error) {
            eventBusLogger.warn("event_bus.volatile_delivery_failed", {
              eventId: event.id,
              eventType: event.eventType,
              consumerId,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          }
        });
      const chain = next.then(() => undefined, () => undefined);
      this.deliveryChains.set(consumerId, chain);
      void chain.finally(() => {
        if (this.deliveryChains.get(consumerId) === chain) {
          this.deliveryChains.delete(consumerId);
        }
      });
    }
  }

  /**
   * Enqueues a delivery operation for a consumer.
   * @param consumerId - The consumer ID to deliver to
   * @param swallowErrors - If true, errors are caught and return 0; if false, errors propagate
   * @returns Promise resolving to number of events delivered
   */
  private async enqueueDelivery(consumerId: string, swallowErrors: boolean): Promise<number> {
    this.assertNotDisposed();
    const prior = this.deliveryChains.get(consumerId) ?? Promise.resolve();
    const next = prior
      .catch(() => undefined)
      .then(() => {
        this.assertNotDisposed();
        return this.deliverPendingNow(consumerId);
      });
    const chain = next.then(() => undefined, () => undefined);

    this.deliveryChains.set(consumerId, chain);
    void chain.finally(() => {
      if (this.deliveryChains.get(consumerId) === chain) {
        this.deliveryChains.delete(consumerId);
      }
    });

    if (swallowErrors) {
      return next.catch(() => 0);
    }
    return next;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new WorkflowStateError("event_bus.disposed", "event_bus.disposed");
    }
  }
}

/**
 * Sleep utility for async delay.
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
