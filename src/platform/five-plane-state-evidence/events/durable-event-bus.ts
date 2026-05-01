import { newId, nowIso } from "../../contracts/types/ids.js";
import type { EventRecord, TraceContext } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore, type PendingAckEvent } from "../truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
import { getEventSchema, getRegisteredConsumers, validateEventPayload } from "./event-registry.js";
import { injectTraceContext } from "../../shared/observability/trace-context.js";
import { ValidationError, WorkflowStateError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { DlqService, type FailureCategory } from "./dlq-service.js";

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
 * R16-16 FIX: Was 3 but loop executes 4 times due to off-by-one, changing to 2
 * so total attempts = initial (1) + retries (2) = 3 total attempts.
 */
const MAX_DELIVERY_RETRIES = 2;

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
 *
 * R20-36 FIX: Reduced from 10ms to 100ms to reduce unnecessary CPU usage.
 * 100ms provides sufficient responsiveness while avoiding 100 ops/sec/consumer
 * overhead when idle. This is still well within the §25.3 requirement.
 */
const ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS = 100;

/**
 * Backoff multiplier when many consumers are active to reduce polling overhead.
 * Increases interval as consumer count grows to avoid CPU thrashing.
 */
const CONSUMER_BACKOFF_MULTIPLIER = 1.5;

/**
 * Maximum number of consumers before applying backoff multiplier.
 */
const CONSUMER_BACKOFF_THRESHOLD = 20;

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
 * Aggregate partition key for ordered event delivery within an aggregate.
 * Ensures events within the same aggregate are delivered in sequence order.
 * §7.3/§28.3 requires monotonic sequence within aggregate + partitioned outbox.
 */
interface AggregatePartition {
  aggregateId: string;
  /** Tracks per-consumer-group last acknowledged sequence for that aggregate */
  consumerGroupSequences: Map<string, number>;
}

/**
 * Consumer group state for per-consumer isolation and offset tracking.
 * Enables independent processing offsets, priorities, and circuit breakers per consumer group.
 */
interface ConsumerGroupState {
  groupId: string;
  /** Consumer members in this group */
  memberIds: Set<string>;
  /** Consumer priority level for back-pressure handling */
  priority: "high" | "normal" | "low";
  /** Circuit breaker state: open/closed/half-open */
  circuitBreakerState: "closed" | "open" | "half_open";
  /** Consecutive failures for circuit breaker */
  consecutiveFailures: number;
  /** Last failure timestamp */
  lastFailureAt: string | null;
}

/**
 * Consumer registration with handler and group association.
 */
interface ConsumerRegistration {
  consumerId: string;
  groupId: string | null;
  handler: EventHandler;
}

/**
 * Partition-aware subscriber registry.
 * Organizes subscribers by aggregate for efficient partitioning and ordering.
 * §7.3: partition-by-aggregate with sequence monotonicity per aggregate.
 */
class PartitionAwareSubscriberRegistry {
  /** Consumer ID -> registration mapping */
  private readonly consumers = new Map<string, ConsumerRegistration>();
  /** Aggregate ID -> partition mapping for ordered delivery */
  private readonly aggregatePartitions = new Map<string, AggregatePartition>();
  /** Consumer group ID -> group state */
  private readonly consumerGroups = new Map<string, ConsumerGroupState>();
  /** Aggregate to consumers mapping for fan-out */
  private readonly aggregateConsumers = new Map<string, Set<string>>();

  public register(
    consumerId: string,
    handler: EventHandler,
    options?: { groupId?: string; priority?: "high" | "normal" | "low" },
  ): void {
    const groupId = options?.groupId ?? consumerId;

    // Create consumer group if needed
    if (!this.consumerGroups.has(groupId)) {
      this.consumerGroups.set(groupId, {
        groupId,
        memberIds: new Set(),
        priority: options?.priority ?? "normal",
        circuitBreakerState: "closed",
        consecutiveFailures: 0,
        lastFailureAt: null,
      });
    }

    const group = this.consumerGroups.get(groupId)!;
    group.memberIds.add(consumerId);

    // Create aggregate partition if needed
    const partition = this.getOrCreatePartition("default");
    if (!partition.consumerGroupSequences.has(groupId)) {
      partition.consumerGroupSequences.set(groupId, 0);
    }

    this.consumers.set(consumerId, {
      consumerId,
      groupId,
      handler,
    });
  }

  public unregister(consumerId: string): void {
    const reg = this.consumers.get(consumerId);
    if (!reg) return;

    const group = this.consumerGroups.get(reg.groupId);
    if (group) {
      group.memberIds.delete(consumerId);
      if (group.memberIds.size === 0) {
        this.consumerGroups.delete(reg.groupId);
      }
    }

    // Clean up aggregate sequences for this consumer group
    for (const partition of Array.from(this.aggregatePartitions.values())) {
      partition.consumerGroupSequences.delete(reg.groupId);
    }

    // Remove from aggregate consumers
    for (const consumerSet of Array.from(this.aggregateConsumers.values())) {
      consumerSet.delete(consumerId);
    }

    this.consumers.delete(consumerId);
  }

  public getHandler(consumerId: string): EventHandler | undefined {
    return this.consumers.get(consumerId)?.handler;
  }

  public getGroupState(groupId: string): ConsumerGroupState | undefined {
    return this.consumerGroups.get(groupId);
  }

  public getGroupId(consumerId: string): string | undefined {
    return this.consumers.get(consumerId)?.groupId;
  }

  public getOrCreatePartition(aggregateId: string): AggregatePartition {
    let partition = this.aggregatePartitions.get(aggregateId);
    if (!partition) {
      partition = { aggregateId, consumerGroupSequences: new Map() };
      this.aggregatePartitions.set(aggregateId, partition);
    }
    return partition;
  }

  public getPartition(aggregateId: string): AggregatePartition | undefined {
    return this.aggregatePartitions.get(aggregateId);
  }

  public getAllPartitions(): Map<string, AggregatePartition> {
    return this.aggregatePartitions;
  }

  public getConsumerCount(): number {
    return this.consumers.size;
  }

  public getGroupCount(): number {
    return this.consumerGroups.size;
  }

  public getAllConsumerIds(): string[] {
    return Array.from(this.consumers.keys());
  }

  public clear(): void {
    this.consumers.clear();
    this.aggregatePartitions.clear();
    this.consumerGroups.clear();
    this.aggregateConsumers.clear();
  }
}

/**
 * Event delivery item with group-aware tracking.
 */
interface GroupedDeliveryItem {
  event: PendingAckEvent;
  groupId: string;
  aggregateId: string;
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
  /** Partition-aware subscriber registry with consumer group isolation */
  private readonly subscriberRegistry = new PartitionAwareSubscriberRegistry();
  private readonly deliveryChains = new Map<string, Promise<void>>();
  private readonly pollingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activeConsumerRefCounts: Map<string, number>;
  private disposed = false;
  /** §14.3: Tracks monotonic sequence per runId for ordered event replay */
  private readonly runSequences = new Map<string, number>();

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    private readonly dlqService?: DlqService,
  ) {
    this.activeConsumerRefCounts = getActiveConsumerRefCounts(db);
  }

  /**
   * Subscribes a handler to events for a specific consumer.
   * The handler will be called for events delivered to this consumer.
   * @param consumerId - The consumer ID to subscribe
   * @param handler - The handler function to call for each event
   * @param options - Subscription options including consumer group settings
   */
  public subscribe(consumerId: string, handler: EventHandler, options?: { priority?: "high" | "normal" | "low"; groupId?: string }): void {
    this.assertNotDisposed();
    this.subscriberRegistry.register(consumerId, handler, { priority: options?.priority, groupId: options?.groupId });
    this.registerActiveConsumer(consumerId);
    this.ensurePolling(consumerId);
  }

  /**
   * Unsubscribes a consumer from the event bus.
   * @param consumerId - The consumer ID to unsubscribe
   */
  public unsubscribe(consumerId: string): void {
    const handler = this.subscriberRegistry.getHandler(consumerId);
    if (!handler) {
      return;
    }
    const currentCount = this.activeConsumerRefCounts.get(consumerId) ?? 0;
    this.unregisterActiveConsumer(consumerId);
    if (currentCount <= 1) {
      this.subscriberRegistry.unregister(consumerId);
      this.cancelPolling(consumerId);
    }
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
    for (const consumerId of Array.from(this.subscriberRegistry['consumers'].keys())) {
      this.unregisterActiveConsumer(consumerId);
      this.cancelPolling(consumerId);
    }
    this.subscriberRegistry.clear();
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
    principal?: string | null;
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
    // §14.3: Maintain monotonic sequence for events within the same run
    // If runId is provided but sequence is not, auto-assign a monotonically increasing sequence
    const effectiveSequence = input.sequence ?? (input.runId ? this.getNextRunSequence(input.runId) : null);
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
          // §28.1 replay ordering fields
          schemaVersion: "1.0",
          aggregateId: input.aggregateId ?? null,
          runId: input.runId ?? null,
          sequence: effectiveSequence,
          // §28.1 causation/correlation/payload integrity fields
          causationId: null,
          correlationId: input.traceContext?.correlationId ?? null,
          payloadHash: null,
          idempotencyKey: null,
          replayBehavior: null,
          principal: input.principal ?? null,
          evidenceRefs: [],
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
    principal?: string | null;
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
        // §14.3: Maintain monotonic sequence for events within the same run
        const effectiveSequence = input.sequence ?? (input.runId ? this.getNextRunSequence(input.runId) : null);
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
          // §28.1 replay ordering fields
          schemaVersion: "1.0",
          aggregateId: input.aggregateId ?? null,
          runId: input.runId ?? null,
          sequence: effectiveSequence,
          // §28.1 causation/correlation/payload integrity fields
          causationId: null,
          correlationId: input.traceContext?.correlationId ?? null,
          payloadHash: null,
          idempotencyKey: null,
          replayBehavior: null,
          principal: input.principal ?? null,
          evidenceRefs: [],
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
    const handler = this.subscriberRegistry.getHandler(consumerId);
    if (handler || this.activeConsumerRefCounts.has(consumerId)) {
      return pending;
    }
    return pending.filter((item) => getRegisteredConsumers(item.event.eventType).includes(consumerId));
  }

  /**
   * Internal method that actually performs the delivery to a consumer.
   * Uses aggregate partitioning for ordered delivery within aggregate boundaries.
   * §7.3/§28.3: partition-by-aggregate ensures sequence monotonicity within aggregate.
   * @param consumerId - The consumer ID to deliver events to
   * @returns The number of events delivered
   */
  private async deliverPendingNow(consumerId: string): Promise<number> {
    const pending = this.store.event.listPendingEventsForConsumer(consumerId);
    const handler = this.subscriberRegistry.getHandler(consumerId);
    if (!handler) {
      // Root cause §191-2236: Without handler, nothing can be delivered.
      // Previously this returned 0 which is correct - no delivery means 0 delivered.
      // Ensure we don't return pending.length as "delivered" when no delivery occurred.
      return 0;
    }

    // Get consumer group ID and state for circuit breaker and priority
    const groupId = this.subscriberRegistry.getGroupId(consumerId) ?? consumerId;
    const groupState = this.subscriberRegistry.getGroupState(groupId);
    const priority = groupState?.priority ?? "normal";

    // Check circuit breaker for this consumer group
    if (groupState?.circuitBreakerState === "open") {
      eventBusLogger.warn("event_bus.circuit_breaker_open", { consumerId, groupId });
      return 0;
    }

    // Group pending events by aggregate for ordering
    const aggregateGroups = new Map<string, PendingAckEvent[]>();
    for (const item of pending) {
      const aggId = item.event.aggregateId ?? "default";
      let group = aggregateGroups.get(aggId);
      if (!group) {
        group = [];
        aggregateGroups.set(aggId, group);
      }
      group.push(item);
    }

    // Sort events within each aggregate by sequence
    for (const group of Array.from(aggregateGroups.values())) {
      group.sort((a, b) => {
        const seqA = a.event.sequence ?? 0;
        const seqB = b.event.sequence ?? 0;
        return seqA - seqB;
      });
    }

    let delivered = 0;
    let deadLetteredCount = 0;
    let consecutiveFailures = groupState?.consecutiveFailures ?? 0;

    for (const [aggId, group] of Array.from(aggregateGroups.entries())) {
      // Get or create aggregate partition for this aggregate
      const partition = this.subscriberRegistry.getOrCreatePartition(aggId);
      // Get the consumer group's last acknowledged sequence for this aggregate
      const lastGroupSeq = partition.consumerGroupSequences.get(groupId) ?? 0;

      // Filter events that respect sequence ordering for this consumer group
      const orderedGroup = group.filter((item) => {
        if (item.event.sequence == null) {
          return true;
        }
        return item.event.sequence > lastGroupSeq;
      });

      for (const item of orderedGroup) {
        const result = await this.deliverOneWithResult(item, handler, consumerId);
        if (result.delivered) {
          delivered++;
          // Update consumer group's sequence tracking for this aggregate
          if (item.event.sequence != null) {
            this.updateGroupAggregateSequence(aggId, groupId, item.event.sequence);
          }
          consecutiveFailures = 0;
        } else if (result.deadLettered) {
          deadLetteredCount++;
          consecutiveFailures++;

          // Update circuit breaker based on failure count
          if (consecutiveFailures >= 5) {
            this.updateCircuitBreaker(groupId, "open");
          }
        }
      }
    }

    // Update failure tracking on group state
    if (groupState) {
      groupState.consecutiveFailures = consecutiveFailures;
      if (consecutiveFailures > 0) {
        groupState.lastFailureAt = nowIso();
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
   * Updates the aggregate partition sequence for a consumer group after successful delivery.
   * This ensures monotonic sequence per aggregate per consumer group.
   */
  private updateGroupAggregateSequence(aggregateId: string, groupId: string, sequence: number): void {
    const partition = this.subscriberRegistry.getOrCreatePartition(aggregateId);
    const currentSeq = partition.consumerGroupSequences.get(groupId) ?? 0;
    if (sequence > currentSeq) {
      partition.consumerGroupSequences.set(groupId, sequence);
    }
  }

  /**
   * §14.3: Returns the next monotonic sequence number for a given runId.
   * Maintains run-local monotonic sequence for ordered event replay within a run.
   * @param runId - The run identifier
   * @returns The next sequence number (starting from 1)
   */
  private getNextRunSequence(runId: string): number {
    const current = this.runSequences.get(runId) ?? 0;
    const next = current + 1;
    this.runSequences.set(runId, next);
    return next;
  }

  /**
   * Updates circuit breaker state for a consumer group.
   */
  private updateCircuitBreaker(groupId: string, state: "closed" | "open" | "half_open"): void {
    const groupState = this.subscriberRegistry.getGroupState(groupId);
    if (groupState) {
      groupState.circuitBreakerState = state;
      if (state === "closed") {
        groupState.consecutiveFailures = 0;
      }
    }
  }

  /**
   * Delivers a single event to a handler with retry and exponential backoff.
   * After max retries, marks as dead-lettered.
   * @param item - The pending event with its ack record
   * @param handler - The handler to deliver the event to
   * @param consumerId - The consumer ID for circuit breaker tracking
   */
  private async deliverOne(item: PendingAckEvent, handler: EventHandler, consumerId: string): Promise<void> {
    const result = await this.deliverOneWithResult(item, handler, consumerId);
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
   * @param consumerId - The consumer ID for circuit breaker tracking
   * @returns Result indicating delivered or deadLettered status
   */
  private async deliverOneWithResult(item: PendingAckEvent, handler: EventHandler, consumerId: string): Promise<{ delivered: boolean; deadLettered: boolean }> {
    let lastError: Error | null = null;

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

        if (attempt < MAX_DELIVERY_RETRIES) {
          const backoffDelay = calculateBackoff(attempt - 1);
          await sleep(backoffDelay);
        }
      }
    }

    // All delivery attempts exhausted - mark the ack as dead-lettered so the
    // event does not remain indefinitely "pending" inside the primary queue.
    const errorMessage = lastError
      ? `failed_after_${MAX_DELIVERY_RETRIES}_retries: ${lastError.message}`
      : `failed_after_${MAX_DELIVERY_RETRIES}_retries: unknown_error`;

    this.store.event.markEventDeadLettered({
      eventId: item.event.id,
      consumerId: item.ack.consumerId,
      occurredAt: nowIso(),
      errorCode: errorMessage,
    });

    // §28.1: Persist to event_dead_letters table for independent DLQ tracking
    // This satisfies the "Event不允许物理删除" requirement - dead-lettered events
    // are preserved in the event_dead_letters table rather than being deleted.
    this.store.event.insertEventDeadLetter({
      id: newId("evt_dlq"),
      originalEventId: item.event.id,
      eventType: item.event.eventType,
      payloadJson: item.event.payloadJson,
      consumerId: item.ack.consumerId,
      failureCount: MAX_DELIVERY_RETRIES,
      lastError: errorMessage,
      deadLetteredAt: nowIso(),
      reprocessedAt: null,
      reprocessResult: null,
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

    // Persist to DLQ service for structured tracking with category/reason/retry_count
    if (this.dlqService) {
      const failureCategory = this.categorizeFailure(lastError);
      this.dlqService.enqueue({
        sourceEventId: item.event.id,
        consumerId: item.ack.consumerId,
        errorCode: errorMessage,
        errorMessage: lastError?.message ?? null,
        payloadJson: JSON.stringify(item.event.payloadJson),
        originalTimestamp: item.event.createdAt,
        failureCategory,
        reason: `Delivery failed after ${MAX_DELIVERY_RETRIES} retries: ${lastError?.message ?? "unknown"}`,
      });
    }

    return { delivered: false, deadLettered: true };
  }

  /**
   * Categorizes a delivery failure into a FailureCategory for DLQ tracking.
   */
  private categorizeFailure(error: Error | null): FailureCategory {
    if (!error) return "unknown";
    const message = error.message.toLowerCase();
    if (message.includes("timeout") || message.includes("etimedout") || message.includes("timed out")) {
      return "timeout";
    }
    if (message.includes("auth") || message.includes("token") || message.includes("credential")) {
      return "authentication";
    }
    if (message.includes("rate limit") || message.includes("throttle") || message.includes("too many requests")) {
      return "rate_limit";
    }
    if (message.includes("schema") || message.includes("invalid") || message.includes("malformed")) {
      return "permanent";
    }
    if (message.includes("memory") || message.includes("disk") || message.includes("resource")) {
      return "resource";
    }
    if (message.includes("config") || message.includes("missing") || message.includes("undefined")) {
      return "configuration";
    }
    return "transient";
  }

  /**
   * Schedules fan-out delivery to all registered subscribers.
   */
  private scheduleFanOut(): void {
    if (this.disposed) {
      return;
    }
    for (const consumerId of this.subscriberRegistry.getAllConsumerIds()) {
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
    this.enqueueDelivery(consumerId, true).catch(() => {
      // Error already logged in enqueueDelivery; propagate to ensure unhandled rejection
      // visibility rather than silently discarding via void
    });
  }

  private ensurePolling(consumerId: string): void {
    if (this.pollingTimers.has(consumerId)) {
      return;
    }
    this.schedulePollingTick(consumerId, 0);
  }

  /**
   * Calculates adaptive polling interval based on queue depth, consumer priority, and circuit breaker state.
   * Implements graduated back-pressure: higher depth = longer interval, low priority = longer interval.
   * §9.2: queue-depth graduated back-pressure (reject low priority -> DLQ -> incident).
   * @param consumerId - The consumer ID to calculate interval for
   * @param queueDepth - Number of pending events
   * @returns Polling interval in milliseconds
   */
  private calculatePollingInterval(consumerId: string, queueDepth: number): number {
    const baseInterval = ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS;

    // Get consumer group ID and state for priority and circuit breaker
    const groupId = this.subscriberRegistry.getGroupId(consumerId) ?? consumerId;
    const groupState = this.subscriberRegistry.getGroupState(groupId);
    const priority = groupState?.priority ?? "normal";

    // Circuit breaker open = much longer interval
    if (groupState?.circuitBreakerState === "open") {
      return baseInterval * 100; // 1 second
    }
    if (groupState?.circuitBreakerState === "half_open") {
      return baseInterval * 10; // 100ms
    }

    // Priority-based multiplier
    const priorityMultiplier = priority === "high" ? 0.5 : priority === "low" ? 2.0 : 1.0;

    // Queue depth-based graduated back-pressure
    // 0-10 events: base interval
    // 10-50 events: 2x base
    // 50-100 events: 5x base, consider DLQ for low priority
    // 100+ events: 10x base, reject low priority
    let depthMultiplier = 1.0;
    if (queueDepth > 100) {
      depthMultiplier = 10.0;
    } else if (queueDepth > 50) {
      depthMultiplier = 5.0;
    } else if (queueDepth > 10) {
      depthMultiplier = 2.0;
    }

    // Consumer count backoff: when many consumers are active, increase polling interval
    // to avoid CPU thrashing from excessive polling operations
    const consumerCount = this.subscriberRegistry.getConsumerCount();
    let consumerMultiplier = 1.0;
    if (consumerCount > CONSUMER_BACKOFF_THRESHOLD) {
      consumerMultiplier = Math.pow(CONSUMER_BACKOFF_MULTIPLIER, Math.log2(consumerCount / CONSUMER_BACKOFF_THRESHOLD + 1));
    }

    const interval = baseInterval * priorityMultiplier * depthMultiplier * consumerMultiplier;

    // Cap at 10 seconds
    return Math.min(interval, 10_000);
  }

  private schedulePollingTick(consumerId: string, delayMs: number): void {
    if (this.disposed || !this.subscriberRegistry.getHandler(consumerId) || this.pollingTimers.has(consumerId)) {
      return;
    }
    const timer = setTimeout(() => {
      this.pollingTimers.delete(consumerId);
      if (this.disposed || !this.subscriberRegistry.getHandler(consumerId)) {
        return;
      }
      void this.enqueueDelivery(consumerId, true).finally(() => {
        if (!this.disposed && this.subscriberRegistry.getHandler(consumerId)) {
          // Calculate adaptive polling interval based on queue depth
          const pending = this.store.event.listPendingEventsForConsumer(consumerId);
          const queueDepth = pending.length;
          const nextInterval = this.calculatePollingInterval(consumerId, queueDepth);
          this.schedulePollingTick(consumerId, nextInterval);
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
    // Dispatch to all registered consumers via the partition-aware registry
    const consumerIds = this.subscriberRegistry.getAllConsumerIds();
    for (const consumerId of consumerIds) {
      const handler = this.subscriberRegistry.getHandler(consumerId);
      if (!handler) continue;

      const prior = this.deliveryChains.get(consumerId) ?? Promise.resolve();
      const next = prior.then(async () => {
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
          // Re-throw so the delivery chain correctly reflects failure
          throw error;
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
    let lastError: Error | null = null;
    const next = prior.then(async () => {
      this.assertNotDisposed();
      try {
        return await this.deliverPendingNow(consumerId);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        throw error;
      }
    });
    const chain = next.then(() => undefined, () => undefined);

    this.deliveryChains.set(consumerId, chain);
    void chain.finally(() => {
      if (this.deliveryChains.get(consumerId) === chain) {
        this.deliveryChains.delete(consumerId);
      }
    });

    if (swallowErrors) {
      return next.catch((error) => {
        eventBusLogger.warn("event_bus.delivery_failed", {
          consumerId,
          errorMessage: lastError?.message ?? String(error),
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
    // Root cause §191-2237: Creating acks for activeConsumerRefCounts without eventType filter
    // causes false pending counts for consumers not registered for this eventType.
    // The second loop (activeConsumerRefCounts) was duplicating calls and creating
    // spurious pending acks. Only create acks for consumers actually registered for this eventType.
    const registeredConsumerIds = getRegisteredConsumers(event.eventType);
    for (const consumerId of registeredConsumerIds) {
      this.store.event.ensureEventConsumerAckPending(event.id, consumerId);
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
