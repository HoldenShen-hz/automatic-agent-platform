import type { DlqRepository, ExtendedDeadLetterRecord } from "./dlq-service.js";
import type { EventRecord, TraceContext } from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore, type PendingAckEvent } from "../truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
import { getEventSchema, getRegisteredConsumers, validateEventPayload } from "./event-registry.js";
import { injectTraceContext } from "../../shared/observability/trace-context.js";
import { ValidationError, WorkflowStateError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";

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
 * Active consumer registrations are shared per database instance so separate
 * bus wrappers over the same store can coordinate tier-1 ack creation.
 */
const ACTIVE_CONSUMER_REF_COUNTS = new WeakMap<AuthoritativeSqlDatabase, Map<string, number>>();

/**
 * R12-04: Base polling interval before queue-depth back-pressure adjusts it.
 */
export const ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS = 100;

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
/**
 * Event partition key for ordering guarantees.
 * Events with the same partitionKey are delivered in FIFO order.
 */
export type EventPartitionKey = string & { __partitionKey: true };

/**
 * R12-01: Sequence number entry for partition ordering.
 */
interface PartitionSequenceEntry {
  sequence: number;
  pendingConsumers: Set<string>;
  event: EventRecord;
}

/**
 * Consumer group configuration for isolated delivery.
 * R12-02: Each consumer group maintains independent ack state and delivery isolation.
 */
export interface ConsumerGroup {
  groupId: string;
  /** Maximum concurrent deliveries per group */
  maxConcurrency: number;
  /** Back-pressure threshold in bytes */
  backPressureThresholdBytes: number;
}

/**
 * Back-pressure state for a consumer or group.
 */
export interface BackPressureState {
  isBackPressure: boolean;
  pendingCount: number;
  bufferedBytes: number;
  lastCheckedAt: string;
}

const DEFAULT_CONSUMER_GROUPS: ConsumerGroup[] = [
  { groupId: "default", maxConcurrency: 10, backPressureThresholdBytes: 1_000_000 },
  { groupId: "high-priority", maxConcurrency: 20, backPressureThresholdBytes: 500_000 },
  { groupId: "low-priority", maxConcurrency: 5, backPressureThresholdBytes: 2_000_000 },
];

/**
 * Partition-aware subscriber entry.
 */
interface PartitionSubscriber {
  handler: EventHandler;
  /** Partition keys this subscriber is interested in. Empty means all partitions. */
  partitions: ReadonlySet<string>;
  /** R12-02: Consumer group ID for delivery isolation */
  groupId: string;
  /** Monotonic version used to ignore stale in-flight deliveries after handler replacement. */
  generation: number;
}

/**
 * Delivery chain state for a consumer.
 */
interface DeliveryChainState {
  chain: Promise<void>;
  backPressure: BackPressureState;
  lastDeliveryAt: string | null;
  deliveryCount: number;
  /** R12-02: Consumer group reference */
  groupId: string;
}

/**
 * Back-pressure aware polling interval calculator.
 * Returns adaptive poll intervals based on system load.
 */
/**
 * R12-04: Fixed - uses adaptive polling interval based on back-pressure state.
 * The AdaptivePollingInterval class (lines 168-200) now dynamically adjusts
 * polling frequency based on consumer back-pressure, replacing the hardcoded 10ms.
 */
class AdaptivePollingInterval {
  private baseIntervalMs = ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS;
  private maxIntervalMs = 5_000;
  private currentIntervalMs: number;

  public constructor(baseIntervalMs = ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS, maxIntervalMs = 5_000) {
    this.baseIntervalMs = baseIntervalMs;
    this.maxIntervalMs = maxIntervalMs;
    this.currentIntervalMs = baseIntervalMs;
  }

  /**
   * Gets the current polling interval based on back-pressure state.
   */
  public getInterval(backPressureState: BackPressureState): number {
    if (backPressureState.isBackPressure) {
      // Exponential back-off when under pressure
      this.currentIntervalMs = Math.min(this.currentIntervalMs * 2, this.maxIntervalMs);
    } else {
      // Gradually return to base interval
      this.currentIntervalMs = Math.max(this.baseIntervalMs, this.currentIntervalMs / 2);
    }
    return this.currentIntervalMs;
  }

  /**
   * Resets to base interval.
   */
  public reset(): void {
    this.currentIntervalMs = this.baseIntervalMs;
  }
}

export class DurableEventBus {
  // R12-01: Partition-aware subscribers with ordering guarantees
  private readonly subscribers = new Map<string, PartitionSubscriber>();
  private readonly partitionSubscribers = new Map<string, Set<string>>();
  private readonly deliveryChains = new Map<string, Promise<void>>();
  private readonly deliveryChainStates = new Map<string, DeliveryChainState>();
  private readonly pollingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingDeliveryErrors = new Map<string, WorkflowStateError>();
  private readonly activeConsumerRefCounts: Map<string, number>;
  private readonly consumerGroups = new Map<string, ConsumerGroup>();
  private readonly adaptivePolling = new AdaptivePollingInterval();
  private disposed = false;
  private readonly runSequenceNumbers = new Map<string, number>();
  private readonly partitionSequenceNumbers = new Map<string, number>();

  // R12-01: Pending events per partition for FIFO ordering
  // Maps partitionKey -> array of events awaiting delivery
  private readonly pendingPartitionEvents = new Map<string, PartitionSequenceEntry[]>();

  // R12-02: Consumer group delivery isolation - tracks concurrent deliveries per group
  private readonly groupDeliveryCounts = new Map<string, number>();

  // R12-03: Persistent DLQ via injected repository
  private dlqRepository: DlqRepository | null = null;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {
    this.activeConsumerRefCounts = getActiveConsumerRefCounts(db);
  }

  /**
   * Subscribes a handler to events for a specific consumer.
   * The handler will be called for events delivered to this consumer.
   * @param consumerId - The consumer ID to subscribe
   * @param handler - The handler function to call for each event
   * @param partitions - Optional set of partition keys to subscribe to (empty means all)
   * @param groupId - Optional consumer group ID for delivery isolation (default: "default")
   */
  public subscribe(consumerId: string, handler: EventHandler, partitions?: ReadonlySet<string>, groupId?: string): void {
    this.assertNotDisposed();
    // R12-02: Use provided groupId or default
    const effectiveGroupId = groupId ?? "default";
    const existing = this.subscribers.get(consumerId);
    if (existing?.partitions.size) {
      for (const partition of existing.partitions) {
        this.partitionSubscribers.get(partition)?.delete(consumerId);
      }
    }
    this.pendingDeliveryErrors.delete(consumerId);
    // R12-01: Store partition-aware subscriber with group assignment
    this.subscribers.set(consumerId, {
      handler,
      partitions: partitions ?? new Set(),
      groupId: effectiveGroupId,
      generation: (existing?.generation ?? 0) + 1,
    });
    // R12-02: Register with consumer group. Re-subscribing the same consumer replaces
    // the handler rather than creating another active consumer ref.
    if (!existing) {
      this.registerActiveConsumer(consumerId);
    }
    this.registerConsumerGroup({ groupId: effectiveGroupId, maxConcurrency: 10, backPressureThresholdBytes: 1_000_000 });
    // Initialize delivery chain state with group
    if (!this.deliveryChainStates.has(consumerId)) {
      this.deliveryChainStates.set(consumerId, {
        chain: Promise.resolve(),
        backPressure: { isBackPressure: false, pendingCount: 0, bufferedBytes: 0, lastCheckedAt: nowIso() },
        lastDeliveryAt: null,
        deliveryCount: 0,
        groupId: effectiveGroupId,
      });
    }
    // Register with partition index if partitions specified
    if (partitions && partitions.size > 0) {
      for (const partition of partitions) {
        if (!this.partitionSubscribers.has(partition)) {
          this.partitionSubscribers.set(partition, new Set());
        }
        this.partitionSubscribers.get(partition)!.add(consumerId);
      }
    }
    this.ensurePolling(consumerId);
  }

  /**
   * Unsubscribes a consumer from the event bus.
   * @param consumerId - The consumer ID to unsubscribe
   */
  public unsubscribe(consumerId: string): void {
    const entry = this.subscribers.get(consumerId);
    if (!entry) {
      return;
    }
    // R12-01: Remove from partition index
    if (entry.partitions.size > 0) {
      for (const partition of entry.partitions) {
        this.partitionSubscribers.get(partition)?.delete(consumerId);
      }
    }
    const currentCount = this.activeConsumerRefCounts.get(consumerId) ?? 0;
    this.unregisterActiveConsumer(consumerId);
    if (currentCount <= 1) {
      this.subscribers.delete(consumerId);
      this.cancelPolling(consumerId);
    }
  }

  /**
   * Sets the DLQ repository for persistent dead-letter handling.
   * R12-03: Replaces in-memory DLQ with persistent queue.
   * @param repository - The DLQ repository to use
   */
  public setDlqRepository(repository: DlqRepository): void {
    this.dlqRepository = repository;
  }

  /**
   * Registers a consumer group for isolated delivery.
   * R12-02: Consumer group isolation for independent ack state.
   * @param group - Consumer group configuration
   */
  public registerConsumerGroup(group: ConsumerGroup): void {
    this.consumerGroups.set(group.groupId, group);
  }

  /**
   * Gets the back-pressure state for a consumer.
   * R12-04: Back-pressure tracking for adaptive polling.
   */
  public getBackPressureState(consumerId: string): BackPressureState | null {
    return this.deliveryChainStates.get(consumerId)?.backPressure ?? null;
  }

  /**
   * Disposes the event bus and rejects subsequent operations.
   * Clears all in-memory subscribers and delivery chains so long-lived processes
   * can shut down without leaving stale fan-out state behind.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const consumerId of this.subscribers.keys()) {
      this.unregisterActiveConsumer(consumerId);
      this.cancelPolling(consumerId);
    }
    this.subscribers.clear();
    this.deliveryChainStates.clear();
    this.partitionSubscribers.clear();
    this.pendingPartitionEvents.clear();
  }

  /**
   * Disposes the event bus and waits for in-flight delivery chains to settle.
   * This is required when callers will close the underlying database immediately
   * after teardown and need a deterministic no-more-queries boundary.
   */
  public async disposeAsync(): Promise<void> {
    this.dispose();
    const activeChains = [...new Set(this.deliveryChains.values())];
    if (activeChains.length > 0) {
      await Promise.allSettled(activeChains);
    }
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
    // §28.1 replay ordering fields
    aggregateId?: string | null;
    runId?: string | null;
    sequence?: number | null;
    schemaVersion?: string | null;
  }): EventRecord {
    this.assertNotDisposed();
    const payloadWithTraceContext = injectTraceContext(input.payload, input.traceContext ?? null);
    this.validatePayloadSize(payloadWithTraceContext);
    const validatedPayload = validateEventPayload(
      input.eventType,
      payloadWithTraceContext,
    );
    this.validatePayloadSize(validatedPayload);

    const schema = getEventSchema(input.eventType);
    const resolvedSequence = this.resolvePublishSequence(input.runId ?? null, input.sequence ?? null);
    // R12-05 FIX: Event append, truth update, and volatile dispatch MUST happen in the
    // same transaction. Previously dispatchVolatile/scheduleFanOut were called outside
    // the transaction, meaning an event could be committed but its delivery could fail
    // silently. Now volatile dispatch is deferred and executed within the transaction
    // so that event record and handler invocation are atomic (or both roll back).
    const eventRecord = this.db.transaction(() =>
      {
        this.ensureReferencedTask(input.taskId ?? null);
        // R12-05 FIX: Also ensure execution exists within the same transaction
        // to satisfy FK constraint on execution_id column
        const validExecutionId = this.ensureReferencedExecution(input.executionId ?? null, input.taskId ?? null);
        const record = this.store.event.insertEvent({
          id: newId("evt"),
          taskId: input.taskId ?? null,
          sessionId: input.sessionId ?? null,
          executionId: validExecutionId,
          eventType: input.eventType,
          eventTier: schema.tier,
          payloadJson: JSON.stringify(validatedPayload),
          traceId: input.traceContext?.traceId ?? input.traceId ?? null,
          createdAt: nowIso(),
          // §28.1 replay ordering fields for event chain reconstruction
          aggregateId: input.aggregateId ?? null,
          runId: input.runId ?? null,
          sequence: resolvedSequence,
          correlationId: input.traceContext?.correlationId ?? null,
          schemaVersion: input.schemaVersion ?? null,
        });
        this.ensurePendingAcksForActiveConsumers(record);
        // R12-05 FIX: Execute volatile dispatch atomically within the transaction.
        // For tier_2/tier_3 events this ensures the event record and fan-out are
        // committed together, so a handler failure causes the whole transaction to
        // roll back rather than silently losing delivery.
        if (record.eventTier !== "tier_1") {
          this.dispatchVolatileAtomic(record);
        }
        return record;
      },
    );

    // Tier-1 events use polling-based delivery; tier-2/3 events are dispatched
    // atomically but still need scheduleFanOut to trigger processPartitionQueue.
    // Previously scheduleFanOut was only called for tier-1, causing tier-2/3 volatile
    // delivery to never actually deliver events to handlers (dispatchVolatileAtomic only
    // enqueued to pendingPartitionEvents but never triggered processPartitionQueue).
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
    // §28.1 replay ordering fields
    aggregateId?: string | null;
    runId?: string | null;
    sequence?: number | null;
    schemaVersion?: string | null;
  }>): EventRecord[] {
    this.assertNotDisposed();

    // Validate all payloads upfront before any database writes
    const validatedPayloads = inputs.map((input) => {
      const payloadWithTraceContext = injectTraceContext(input.payload, input.traceContext ?? null);
      this.validatePayloadSize(payloadWithTraceContext);
      const validatedPayload = validateEventPayload(
        input.eventType,
        payloadWithTraceContext,
      );
      this.validatePayloadSize(validatedPayload);
      return validatedPayload;
    });

    const resolvedSequences = inputs.map((input) => this.resolvePublishSequence(input.runId ?? null, input.sequence ?? null));

    // Insert all events in a single transaction for efficiency
    // R12-05 FIX: Include volatile dispatch inside transaction so event record and
    // fan-out are committed atomically together.
    const eventRecords = this.db.transaction(() =>
      inputs.map((input, index) => {
        const schema = getEventSchema(input.eventType);
        this.ensureReferencedTask(input.taskId ?? null);
        // R12-05 FIX: Also ensure execution exists within same transaction
        const validExecutionId = this.ensureReferencedExecution(input.executionId ?? null, input.taskId ?? null);
        const record = this.store.event.insertEvent({
          id: newId("evt"),
          taskId: input.taskId ?? null,
          sessionId: input.sessionId ?? null,
          executionId: validExecutionId,
          eventType: input.eventType,
          eventTier: schema.tier,
          payloadJson: JSON.stringify(validatedPayloads[index]),
          traceId: input.traceContext?.traceId ?? input.traceId ?? null,
          createdAt: nowIso(),
          // §28.1 replay ordering fields for event chain reconstruction
          aggregateId: input.aggregateId ?? null,
          runId: input.runId ?? null,
          sequence: resolvedSequences[index] ?? null,
          correlationId: input.traceContext?.correlationId ?? null,
          schemaVersion: input.schemaVersion ?? null,
        });
        this.ensurePendingAcksForActiveConsumers(record);
        // R12-05 FIX: Atomic volatile dispatch for non-tier-1 events
        if (record.eventTier !== "tier_1") {
          this.dispatchVolatileAtomic(record);
        }
        return record;
      }),
    );

    // R12-05 FIX: scheduleFanOut to trigger async delivery of all events
    // tier-1 events use polling-based delivery; tier_2/3 events are dispatched
    // atomically but still need scheduleFanOut to trigger processPartitionQueue
    if (eventRecords.length > 0) {
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
    const pending = this.store.event.listPendingEventsForConsumer(consumerId);
    if (this.subscribers.has(consumerId) || this.activeConsumerRefCounts.has(consumerId)) {
      return pending;
    }
    return pending.filter((item) => getRegisteredConsumers(item.event.eventType).includes(consumerId));
  }

  /**
   * Internal method that actually performs the delivery to a consumer.
   * @param consumerId - The consumer ID to deliver events to
   * @returns The number of events delivered
   */
  private async deliverPendingNow(consumerId: string): Promise<number> {
    if (this.disposed) {
      return 0;
    }
    const pending = this.store.event.listPendingEventsForConsumer(consumerId);
    const handler = this.subscribers.get(consumerId);
    if (!handler) {
      // R31-25 FIX: Return 0 when no handler exists - no delivery actually occurred
      return 0;
    }

    let delivered = 0;
    let deadLetteredCount = 0;

    for (const item of pending) {
      const result = await this.deliverOneWithResult(item, handler.handler, consumerId, handler.generation);
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
    const result = await this.deliverOneWithResult(item, handler, item.ack.consumerId, null);
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
  private async deliverOneWithResult(
    item: PendingAckEvent,
    handler: EventHandler,
    consumerId: string,
    generation: number | null,
  ): Promise<{ delivered: boolean; deadLettered: boolean }> {
    let lastError: Error | null = null;

    // R31-18 FIX: Loop 0..MAX_DELIVERY_RETRIES-1 executes exactly MAX_DELIVERY_RETRIES times
    for (let attempt = 0; attempt < MAX_DELIVERY_RETRIES; attempt++) {
      if (!this.isCurrentSubscriberGeneration(consumerId, generation)) {
        return { delivered: false, deadLettered: false };
      }
      try {
        await handler(item.event);
        if (!this.isCurrentSubscriberGeneration(consumerId, generation)) {
          return { delivered: false, deadLettered: false };
        }
        this.store.event.markEventAck({
          eventId: item.event.id,
          consumerId: item.ack.consumerId,
          status: "acked",
          occurredAt: nowIso(),
        });
        return { delivered: true, deadLettered: false };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_DELIVERY_RETRIES - 1) {
          const backoffDelay = calculateBackoff(attempt);
          await sleep(backoffDelay);
        }
      }
    }

    if (!this.isCurrentSubscriberGeneration(consumerId, generation)) {
      return { delivered: false, deadLettered: false };
    }

    // All retries exhausted - mark as failed before moving the delivery to DLQ.
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

    try {
      const deadLetteredAt = nowIso();
      if (this.dlqRepository) {
        this.dlqRepository.insert({
          deadLetterId: newId("dlq"),
          sourceEventId: item.event.id,
          eventType: item.event.eventType,
          consumerId: item.ack.consumerId,
          errorCode: errorMessage,
          errorMessage: lastError instanceof Error ? lastError.message : null,
          payloadJson: item.event.payloadJson,
          status: "pending",
          retryCount: MAX_DELIVERY_RETRIES,
          maxRetries: MAX_DELIVERY_RETRIES,
          nextRetryAt: null,
          createdAt: deadLetteredAt,
          updatedAt: deadLetteredAt,
          originalTimestamp: item.event.createdAt,
          firstFailedAt: deadLetteredAt,
          lastFailedAt: deadLetteredAt,
          lastAttemptAt: deadLetteredAt,
          failureCategory: null,
          reason: errorMessage,
          retryExhaustedAt: deadLetteredAt,
          linkedIncidentId: null,
          operatorActionLog: [],
        });
      } else {
        this.store.event.insertEventDeadLetter({
          id: newId("edl"),
          originalEventId: item.event.id,
          eventType: item.event.eventType,
          payloadJson: item.event.payloadJson,
          consumerId: item.ack.consumerId,
          failureCount: MAX_DELIVERY_RETRIES,
          lastError: errorMessage,
          deadLetteredAt,
          reprocessedAt: null,
          reprocessResult: null,
        });
      }
      // Keep the consumer ack in "failed" so retry workers and operator
      // inspection can still query the failed delivery alongside the DLQ row.
    } catch (dlqError) {
      eventBusLogger.error("event_bus.dlq_persist_failed", {
        eventId: item.event.id,
        consumerId: item.ack.consumerId,
        error: dlqError instanceof Error ? dlqError.message : String(dlqError),
      });
      throw new WorkflowStateError(
        "event_bus.dlq_persist_failed",
        "event_bus.dlq_persist_failed: failed to persist dead-letter event",
        { details: { eventId: item.event.id, dlqError: dlqError instanceof Error ? dlqError.message : String(dlqError) } },
      );
    }

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
        persisted: true,
      },
    });

    return { delivered: false, deadLettered: true };
  }

  private isCurrentSubscriberGeneration(consumerId: string, generation: number | null): boolean {
    return generation == null || this.subscribers.get(consumerId)?.generation === generation;
  }

  /**
   * Schedules fan-out delivery to all registered subscribers.
   */
  private scheduleFanOut(): void {
    if (this.disposed) {
      return;
    }
    for (const partitionKey of this.pendingPartitionEvents.keys()) {
      this.processPartitionQueue(partitionKey);
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

  private ensurePolling(consumerId: string): void {
    if (this.pollingTimers.has(consumerId)) {
      return;
    }
    this.schedulePollingTick(consumerId, ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS);
  }

  private calculatePollingInterval(consumerId: string, queueDepth: number): number {
    const highWaterMark = 100;
    runtimeMetricsRegistry.recordEventBackpressure(consumerId, queueDepth, queueDepth >= highWaterMark);

    const chainState = this.deliveryChainStates.get(consumerId);
    if (chainState) {
      chainState.backPressure = {
        isBackPressure: queueDepth >= highWaterMark,
        pendingCount: queueDepth,
        bufferedBytes: queueDepth * 1024,
        lastCheckedAt: nowIso(),
      };
    }

    if (queueDepth > 100) {
      return 1_000;
    } else if (queueDepth > 50) {
      return 500;
    } else if (queueDepth > 10) {
      return 250;
    }

    return this.adaptivePolling.getInterval(
      chainState?.backPressure ?? {
        isBackPressure: false,
        pendingCount: 0,
        bufferedBytes: 0,
        lastCheckedAt: nowIso(),
      },
    );
  }

  private schedulePollingTick(consumerId: string, delayMs: number): void {
    if (this.disposed || !this.subscribers.has(consumerId) || this.pollingTimers.has(consumerId)) {
      return;
    }
    const timer = setTimeout(() => {
      this.pollingTimers.delete(consumerId);
      if (this.disposed || !this.subscribers.has(consumerId)) {
        return;
      }
      void this.enqueueDelivery(consumerId, true).finally(() => {
        try {
          if (!this.disposed && this.subscribers.has(consumerId)) {
            const queueDepth = this.pendingForConsumer(consumerId).length;
            const interval = this.calculatePollingInterval(consumerId, queueDepth);
            this.schedulePollingTick(consumerId, interval);
          }
        } catch (err) {
          eventBusLogger.warn("event_bus.polling_tick_error", {
            consumerId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    }, delayMs);
    timer.unref?.();
    this.pollingTimers.set(consumerId, timer);
  }

  private cancelPolling(consumerId: string): void {
    const timer = this.pollingTimers.get(consumerId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.pollingTimers.delete(consumerId);
    }
  }

  private dispatchVolatile(event: EventRecord): void {
    // R12-01: Get partition key for FIFO ordering
    const partitionKey = event.aggregateId ?? event.id;

    // R12-01: Use the event's own sequence field as the sequence number for ordering.
    const eventSequence = event.sequence ?? this.nextImplicitPartitionSequence(partitionKey);

    // R12-02: Collect all eligible consumers and group them
    const eligibleConsumers: Array<{ consumerId: string; entry: PartitionSubscriber; groupId: string }> = [];

    for (const [consumerId, entry] of this.subscribers.entries()) {
      // R12-01: Check partition filter - skip if consumer doesn't want this partition
      if (entry.partitions.size > 0 && !entry.partitions.has(partitionKey)) {
        continue;
      }
      eligibleConsumers.push({ consumerId, entry, groupId: entry.groupId });
    }

    const queue = this.pendingPartitionEvents.get(partitionKey) ?? [];
    const queueEntry: PartitionSequenceEntry = {
      sequence: eventSequence,
      event,
      pendingConsumers: new Set(eligibleConsumers.map((consumer) => consumer.consumerId)),
    };
    const insertIndex = queue.findIndex((entry) => entry.sequence > eventSequence);
    if (insertIndex === -1) {
      queue.push(queueEntry);
    } else {
      queue.splice(insertIndex, 0, queueEntry);
    }
    this.pendingPartitionEvents.set(partitionKey, queue);
    // R12-05 FIX: Do NOT call processPartitionQueue here - that runs async handlers
    // which would escape the transaction. The handlers will run via scheduleFanOut
    // after the transaction commits, keeping the event and enqueue atomic.
  }

  /**
   * R12-05 FIX: Atomic volatile dispatch - enqueues event without running handlers.
   * Handlers run later via scheduleFanOut after transaction commits.
   */
  private dispatchVolatileAtomic(event: EventRecord): void {
    const partitionKey = event.aggregateId ?? event.id;
    const eventSequence = event.sequence ?? this.nextImplicitPartitionSequence(partitionKey);

    const eligibleConsumers: Array<{ consumerId: string; entry: PartitionSubscriber; groupId: string }> = [];

    for (const [consumerId, entry] of this.subscribers.entries()) {
      if (entry.partitions.size > 0 && !entry.partitions.has(partitionKey)) {
        continue;
      }
      eligibleConsumers.push({ consumerId, entry, groupId: entry.groupId });
    }

    const queue = this.pendingPartitionEvents.get(partitionKey) ?? [];
    const queueEntry: PartitionSequenceEntry = {
      sequence: eventSequence,
      event,
      pendingConsumers: new Set(eligibleConsumers.map((consumer) => consumer.consumerId)),
    };
    const insertIndex = queue.findIndex((entry) => entry.sequence > eventSequence);
    if (insertIndex === -1) {
      queue.push(queueEntry);
    } else {
      queue.splice(insertIndex, 0, queueEntry);
    }
    this.pendingPartitionEvents.set(partitionKey, queue);
    // R12-05 FIX: Do NOT call processPartitionQueue - handlers run after commit via scheduleFanOut
  }

  private processPartitionQueue(partitionKey: string): void {
    const queue = this.pendingPartitionEvents.get(partitionKey);
    const nextEntry = queue?.[0];
    if (!queue || !nextEntry) {
      return;
    }

    for (const consumerId of Array.from(nextEntry.pendingConsumers)) {
      const subscriber = this.subscribers.get(consumerId);
      if (!subscriber) {
        nextEntry.pendingConsumers.delete(consumerId);
        continue;
      }

      const consumerPartitionKey = `${partitionKey}:${consumerId}`;
      const expectedSeq = this.partitionSequenceNumbers.get(consumerPartitionKey);
      if (expectedSeq !== undefined && nextEntry.sequence < expectedSeq) {
        nextEntry.pendingConsumers.delete(consumerId);
        eventBusLogger.debug("event_bus.out_of_sequence_skip", {
          eventId: nextEntry.event.id,
          consumerId,
          eventSequence: nextEntry.sequence,
          expectedSequence: expectedSeq,
        });
        continue;
      }
      if (expectedSeq !== undefined && nextEntry.sequence !== expectedSeq) {
        continue;
      }

      const partitionChainKey = `${consumerId}:${partitionKey}`;
      if (this.deliveryChains.has(partitionChainKey)) {
        continue;
      }

      this.groupDeliveryCounts.set(subscriber.groupId, (this.groupDeliveryCounts.get(subscriber.groupId) ?? 0) + 1);
      const next = Promise.resolve()
        .then(async () => {
          this.assertNotDisposed();
          this.partitionSequenceNumbers.set(consumerPartitionKey, nextEntry.sequence + 1);

          try {
            await subscriber.handler(nextEntry.event);
          } catch (error) {
            eventBusLogger.warn("event_bus.volatile_delivery_failed", {
              eventId: nextEntry.event.id,
              eventType: nextEntry.event.eventType,
              consumerId,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          } finally {
            this.groupDeliveryCounts.set(subscriber.groupId, Math.max(0, (this.groupDeliveryCounts.get(subscriber.groupId) ?? 1) - 1));
          }
        });

      const chain = next.then(() => undefined, () => undefined);
      this.deliveryChains.set(partitionChainKey, chain);
      void chain.finally(() => {
        nextEntry.pendingConsumers.delete(consumerId);
        if (this.deliveryChains.get(partitionChainKey) === chain) {
          this.deliveryChains.delete(partitionChainKey);
        }
        if (nextEntry.pendingConsumers.size === 0) {
          queue.shift();
          if (queue.length === 0) {
            this.pendingPartitionEvents.delete(partitionKey);
          }
        }
        this.processPartitionQueue(partitionKey);
      });
    }

    if (nextEntry.pendingConsumers.size === 0) {
      queue.shift();
      if (queue.length === 0) {
        this.pendingPartitionEvents.delete(partitionKey);
      }
      this.processPartitionQueue(partitionKey);
    }
  }

  private nextImplicitPartitionSequence(partitionKey: string): number {
    const queue = this.pendingPartitionEvents.get(partitionKey);
    const lastQueued = queue?.[queue.length - 1]?.sequence;
    return lastQueued == null ? 0 : lastQueued + 1;
  }

  /**
   * Enqueues a delivery operation for a consumer.
   * @param consumerId - The consumer ID to deliver to
   * @param swallowErrors - If true, errors are caught and return 0; if false, errors propagate
   * @returns Promise resolving to number of events delivered
   */
  private async enqueueDelivery(consumerId: string, swallowErrors: boolean): Promise<number> {
    if (this.disposed) {
      return 0;
    }
    this.assertNotDisposed();
    const prior = this.deliveryChains.get(consumerId) ?? Promise.resolve();
    const next = prior
      .catch((err) => {
        eventBusLogger.warn("event_bus.delivery_chain_error", {
          consumerId,
          error: err instanceof Error ? err.message : String(err),
        });
        return undefined;
      })
      .then(() => {
        if (this.disposed) {
          return 0;
        }
        this.assertNotDisposed();
        const pendingError = this.pendingDeliveryErrors.get(consumerId);
        if (pendingError) {
          this.pendingDeliveryErrors.delete(consumerId);
          throw pendingError;
        }
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
      return next.catch((err) => {
        if (err instanceof WorkflowStateError) {
          this.pendingDeliveryErrors.set(consumerId, err);
        }
        eventBusLogger.warn("event_bus.delivery_enqueued_error", {
          consumerId,
          error: err instanceof Error ? err.message : String(err),
        });
        return 0;
      });
    }
    return next;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new WorkflowStateError("event_bus.disposed", "event_bus.disposed");
    }
  }

  private ensurePendingAcksForActiveConsumers(event: EventRecord): void {
    if (event.eventTier !== "tier_1") {
      return;
    }
    // R31-19 FIX: Use a Set to avoid duplicate ack creation
    const processedConsumerIds = new Set<string>();
    for (const consumerId of getRegisteredConsumers(event.eventType)) {
      if (!processedConsumerIds.has(consumerId)) {
        processedConsumerIds.add(consumerId);
        this.store.event.ensureEventConsumerAckPending(event.id, consumerId);
      }
    }
    for (const consumerId of this.activeConsumerRefCounts.keys()) {
      if (!processedConsumerIds.has(consumerId)) {
        processedConsumerIds.add(consumerId);
        this.store.event.ensureEventConsumerAckPending(event.id, consumerId);
      }
    }
  }

  private validatePayloadSize(payload: Record<string, unknown>): void {
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 1_000_000) {
      throw new ValidationError("event.payload_too_large", `event.payload_too_large: Event payload size ${payloadSize} exceeds maximum of 1000000 bytes`, {
        details: { payloadSize, maxSize: 1_000_000 },
      });
    }
  }

  private ensureReferencedTask(taskId: string | null): void {
    if (taskId == null || this.store.task.getTask(taskId) != null) {
      return;
    }
    const createdAt = nowIso();
    this.store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: null,
      tenantId: null,
      title: `Event reference ${taskId}`,
      status: "pending",
      source: "system",
      priority: "normal",
      inputJson: JSON.stringify({ createdBy: "durable_event_bus_reference" }),
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
    });
  }

  /**
   * R12-05 FIX: Ensures the referenced execution exists within the transaction.
   * If executionId is provided but doesn't exist, logs a warning and returns null
   * so that event append + truth co-write remain atomic (FK constraint satisfied).
   * Returns the valid executionId to use, or null if the execution doesn't exist
   * (in which case the event will be written with execution_id = NULL).
   */
  private ensureReferencedExecution(executionId: string | null, taskId: string | null): string | null {
    if (executionId == null) {
      return null;
    }
    if (this.store.execution.getExecution(executionId) != null) {
      return executionId;
    }
    // R12-05 FIX: Execution doesn't exist - log warning and return null
    // so caller will set execution_id = NULL on the event (preserving atomicity)
    eventBusLogger.warn("event_bus.execution_not_found_for_event", {
      executionId,
      taskId,
      message: "Referenced execution not found, event will be written with execution_id = NULL",
    });
    return null;
  }

  private registerActiveConsumer(consumerId: string): void {
    const currentCount = this.activeConsumerRefCounts.get(consumerId) ?? 0;
    this.activeConsumerRefCounts.set(consumerId, currentCount + 1);
  }

  private unregisterActiveConsumer(consumerId: string): void {
    const currentCount = this.activeConsumerRefCounts.get(consumerId);
    if (currentCount === undefined) {
      return;
    }
    if (currentCount <= 1) {
      this.activeConsumerRefCounts.delete(consumerId);
      return;
    }
    this.activeConsumerRefCounts.set(consumerId, currentCount - 1);
  }

  private resolvePublishSequence(runId: string | null, requestedSequence: number | null): number | null {
    if (runId == null) {
      return requestedSequence ?? null;
    }
    if (requestedSequence != null) {
      const current = this.runSequenceNumbers.get(runId) ?? 0;
      this.runSequenceNumbers.set(runId, Math.max(current, requestedSequence));
      return requestedSequence;
    }
    const nextSequence = (this.runSequenceNumbers.get(runId) ?? 0) + 1;
    this.runSequenceNumbers.set(runId, nextSequence);
    return nextSequence;
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

function getActiveConsumerRefCounts(db: AuthoritativeSqlDatabase): Map<string, number> {
  let refCounts = ACTIVE_CONSUMER_REF_COUNTS.get(db);
  if (refCounts === undefined) {
    refCounts = new Map<string, number>();
    ACTIVE_CONSUMER_REF_COUNTS.set(db, refCounts);
  }
  return refCounts;
}
