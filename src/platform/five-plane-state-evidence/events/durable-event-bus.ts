import type { DlqRepository, ExtendedDeadLetterRecord } from "./dlq-service.js";
import type { EventRecord, TraceContext } from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore, type PendingAckEvent } from "../truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
import { getEventSchema, getRegisteredConsumers, validateEventPayload } from "./event-registry.js";
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
 * Active consumer registrations are shared per database instance so separate
 * bus wrappers over the same store can coordinate tier-1 ack creation.
 */
const ACTIVE_CONSUMER_REF_COUNTS = new WeakMap<AuthoritativeSqlDatabase, Map<string, number>>();

/**
 * Active subscriptions poll for newly persisted tier-1 events so cross-instance
 * publishers do not rely on subscription-time races.
 */
const ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS = 10;

/**
 * R12-01: Sequence number tracker per partition for ordering guarantees.
 * Events with the same partition key are delivered in FIFO order.
 */
const partitionSequenceNumbers = new Map<string, number>();

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
class AdaptivePollingInterval {
  private baseIntervalMs = 10;
  private maxIntervalMs = 5_000;
  private currentIntervalMs: number;

  public constructor(baseIntervalMs = 10, maxIntervalMs = 5_000) {
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
  private readonly activeConsumerRefCounts: Map<string, number>;
  private readonly consumerGroups = new Map<string, ConsumerGroup>();
  private readonly adaptivePolling = new AdaptivePollingInterval();
  private readonly disposed = false;

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
    // R12-01: Store partition-aware subscriber with group assignment
    this.subscribers.set(consumerId, { handler, partitions: partitions ?? new Set(), groupId: effectiveGroupId });
    // R12-02: Register with consumer group
    this.registerActiveConsumer(consumerId);
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
    // @ts-expect-error - mutating readonly for disposal
    this.disposed = true;
    for (const consumerId of this.subscribers.keys()) {
      this.unregisterActiveConsumer(consumerId);
      this.cancelPolling(consumerId);
    }
    this.subscribers.clear();
    this.deliveryChains.clear();
    this.deliveryChainStates.clear();
    this.partitionSubscribers.clear();
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
    const eventRecord = this.db.transaction(() =>
      {
        this.ensureReferencedTask(input.taskId ?? null);
        const record = this.store.event.insertEvent({
          id: newId("evt"),
          taskId: input.taskId ?? null,
          sessionId: input.sessionId ?? null,
          executionId: input.executionId ?? null,
          eventType: input.eventType,
          eventTier: schema.tier,
          payloadJson: JSON.stringify(validatedPayload),
          traceId: input.traceContext?.traceId ?? input.traceId ?? null,
          createdAt: nowIso(),
          // §28.1 replay ordering fields for event chain reconstruction
          aggregateId: input.aggregateId ?? null,
          runId: input.runId ?? null,
          sequence: input.sequence ?? null,
          schemaVersion: input.schemaVersion ?? null,
        });
        this.ensurePendingAcksForActiveConsumers(record);
        return record;
      },
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

    // Insert all events in a single transaction for efficiency
    const eventRecords = this.db.transaction(() =>
      inputs.map((input, index) => {
        const schema = getEventSchema(input.eventType);
        this.ensureReferencedTask(input.taskId ?? null);
        const record = this.store.event.insertEvent({
          id: newId("evt"),
          taskId: input.taskId ?? null,
          sessionId: input.sessionId ?? null,
          executionId: input.executionId ?? null,
          eventType: input.eventType,
          eventTier: schema.tier,
          payloadJson: JSON.stringify(validatedPayloads[index]),
          traceId: input.traceContext?.traceId ?? input.traceId ?? null,
          createdAt: nowIso(),
          // §28.1 replay ordering fields for event chain reconstruction
          aggregateId: input.aggregateId ?? null,
          runId: input.runId ?? null,
          sequence: input.sequence ?? null,
          schemaVersion: input.schemaVersion ?? null,
        });
        this.ensurePendingAcksForActiveConsumers(record);
        return record;
      }),
    );

    // Dispatch volatile events and schedule fan-out once for the batch
    const nonTier1Records = eventRecords.filter((record) => record.eventTier !== "tier_1");
    for (const eventRecord of nonTier1Records) {
      this.dispatchVolatile(eventRecord);
    }
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
    const pending = this.store.event.listPendingEventsForConsumer(consumerId);
    const handler = this.subscribers.get(consumerId);
    if (!handler) {
      // R31-25 FIX: Return 0 when no handler exists - no delivery actually occurred
      return 0;
    }

    let delivered = 0;
    let deadLetteredCount = 0;

    for (const item of pending) {
      const result = await this.deliverOneWithResult(item, handler.handler);
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

    // R31-18 FIX: Loop 0..MAX_DELIVERY_RETRIES-1 executes exactly MAX_DELIVERY_RETRIES times
    for (let attempt = 0; attempt < MAX_DELIVERY_RETRIES; attempt++) {
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

        if (attempt < MAX_DELIVERY_RETRIES - 1) {
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

    // R12-03: Persist to DLQ repository if configured
    if (this.dlqRepository) {
      try {
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
          createdAt: nowIso(),
          updatedAt: nowIso(),
          originalTimestamp: item.event.createdAt,
          firstFailedAt: nowIso(),
          lastFailedAt: nowIso(),
          lastAttemptAt: nowIso(),
          failureCategory: null,
          reason: errorMessage,
          retryExhaustedAt: nowIso(),
          linkedIncidentId: null,
          operatorActionLog: [],
        });
      } catch (dlqError) {
        eventBusLogger.error("event_bus.dlq_persist_failed", {
          eventId: item.event.id,
          consumerId: item.ack.consumerId,
          error: dlqError instanceof Error ? dlqError.message : String(dlqError),
        });
      }
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
        persisted: this.dlqRepository != null,
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

  private ensurePolling(consumerId: string): void {
    if (this.pollingTimers.has(consumerId)) {
      return;
    }
    this.schedulePollingTick(consumerId, 0);
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
        if (!this.disposed && this.subscribers.has(consumerId)) {
          // R12-04: Use adaptive polling interval based on back-pressure
          const chainState = this.deliveryChainStates.get(consumerId);
          const backPressure = chainState?.backPressure ?? { isBackPressure: false, pendingCount: 0, bufferedBytes: 0, lastCheckedAt: nowIso() };
          const interval = this.adaptivePolling.getInterval(backPressure);
          this.schedulePollingTick(consumerId, interval);
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

    // R12-01: Get or initialize partition sequence number
    const currentSeq = partitionSequenceNumbers.get(partitionKey) ?? 0;
    const eventSequence = currentSeq + 1;
    partitionSequenceNumbers.set(partitionKey, eventSequence);

    // R12-02: Collect all eligible consumers and group them
    const eligibleConsumers: Array<{ consumerId: string; entry: PartitionSubscriber; groupId: string }> = [];

    for (const [consumerId, entry] of this.subscribers.entries()) {
      // R12-01: Check partition filter - skip if consumer doesn't want this partition
      if (entry.partitions.size > 0 && !entry.partitions.has(partitionKey)) {
        continue;
      }
      // R12-02: Check consumer group back-pressure and concurrency
      const chainState = this.deliveryChainStates.get(consumerId);
      const group = this.consumerGroups.get(entry.groupId);
      const groupDeliveryCount = this.groupDeliveryCounts.get(entry.groupId) ?? 0;

      // R12-02: Skip if group is at max concurrency
      if (group && groupDeliveryCount >= group.maxConcurrency) {
        eventBusLogger.warn("event_bus.group_concurrency_limit", {
          eventId: event.id,
          consumerId,
          groupId: entry.groupId,
          currentCount: groupDeliveryCount,
          maxConcurrency: group.maxConcurrency,
        });
        continue;
      }

      // R12-02: Skip if consumer itself is under back-pressure
      if (chainState?.backPressure.isBackPressure) {
        eventBusLogger.warn("event_bus.back_pressure_skip", {
          eventId: event.id,
          consumerId,
          bufferedBytes: chainState.backPressure.bufferedBytes,
        });
        continue;
      }

      eligibleConsumers.push({ consumerId, entry, groupId: entry.groupId });
    }

    // R12-01: Enforce FIFO ordering per partition by queuing in sequence order
    for (const { consumerId, entry, groupId } of eligibleConsumers) {
      // R12-02: Increment group delivery count for concurrency control
      this.groupDeliveryCounts.set(groupId, (this.groupDeliveryCounts.get(groupId) ?? 0) + 1);

      // R12-01: Get this consumer's delivery chain for this partition
      const partitionChainKey = `${consumerId}:${partitionKey}`;
      const prior = this.deliveryChains.get(partitionChainKey) ?? Promise.resolve();

      const next = prior
        .catch((err) => {
          eventBusLogger.warn("event_bus.delivery_chain_error", {
            consumerId,
            partitionKey,
            error: err instanceof Error ? err.message : String(err),
          });
          return undefined;
        })
        .then(async () => {
          this.assertNotDisposed();
          // R12-01: Check sequence - only deliver if this is the next expected event
          const expectedSeq = partitionSequenceNumbers.get(`${partitionKey}:${consumerId}`) ?? 0;
          if (eventSequence < expectedSeq) {
            // This event is old, skip it
            eventBusLogger.debug("event_bus.out_of_sequence_skip", {
              eventId: event.id,
              consumerId,
              eventSequence,
              expectedSequence: expectedSeq,
            });
            return;
          }
          partitionSequenceNumbers.set(`${partitionKey}:${consumerId}`, eventSequence + 1);

          try {
            await entry.handler(event);
          } catch (error) {
            eventBusLogger.warn("event_bus.volatile_delivery_failed", {
              eventId: event.id,
              eventType: event.eventType,
              consumerId,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          } finally {
            // R12-02: Decrement group delivery count
            this.groupDeliveryCounts.set(groupId, Math.max(0, (this.groupDeliveryCounts.get(groupId) ?? 1) - 1));
          }
        });

      const chain = next.then(() => undefined, () => undefined);
      this.deliveryChains.set(partitionChainKey, chain);
      void chain.finally(() => {
        if (this.deliveryChains.get(partitionChainKey) === chain) {
          this.deliveryChains.delete(partitionChainKey);
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
      .catch((err) => {
        eventBusLogger.warn("event_bus.delivery_chain_error", {
          consumerId,
          error: err instanceof Error ? err.message : String(err),
        });
        return undefined;
      })
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
      return next.catch((err) => {
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
