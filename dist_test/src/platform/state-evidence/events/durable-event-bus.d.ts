import type { EventRecord, TraceContext } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore, type PendingAckEvent } from "../truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
/**
 * Handler function type for processing events.
 * May return void or a Promise for async handlers.
 */
export type EventHandler = (event: EventRecord) => void | Promise<void>;
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
export declare class DurableEventBus {
    private readonly db;
    private readonly store;
    private readonly subscribers;
    private readonly deliveryChains;
    private disposed;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Subscribes a handler to events for a specific consumer.
     * The handler will be called for events delivered to this consumer.
     * @param consumerId - The consumer ID to subscribe
     * @param handler - The handler function to call for each event
     */
    subscribe(consumerId: string, handler: EventHandler): void;
    /**
     * Unsubscribes a consumer from the event bus.
     * @param consumerId - The consumer ID to unsubscribe
     */
    unsubscribe(consumerId: string): void;
    /**
     * Disposes the event bus and rejects subsequent operations.
     * Clears all in-memory subscribers and delivery chains so long-lived processes
     * can shut down without leaving stale fan-out state behind.
     */
    dispose(): void;
    /**
     * Publishes an event to the bus, storing it durably and creating ack records for required consumers.
     *
     * @param input - The event data including type, payload, and optional IDs
     * @returns The persisted event record
     */
    publish(input: {
        eventType: string;
        taskId?: string | null;
        sessionId?: string | null;
        executionId?: string | null;
        traceId?: string | null;
        traceContext?: TraceContext | null;
        payload: Record<string, unknown>;
    }): EventRecord;
    /**
     * Delivers all pending events to a specific consumer.
     * Continues processing even if individual deliveries fail, but throws if any event
     * ends up dead-lettered after exhausting retries.
     * @param consumerId - The consumer ID to deliver events to
     * @returns The number of events delivered
     * @throws Error if any event is dead-lettered
     */
    deliverPending(consumerId: string): Promise<number>;
    /**
     * Gets all pending events for a specific consumer.
     * @param consumerId - The consumer ID to get pending events for
     * @returns Array of pending events with their ack records
     */
    pendingForConsumer(consumerId: string): PendingAckEvent[];
    /**
     * Internal method that actually performs the delivery to a consumer.
     * @param consumerId - The consumer ID to deliver events to
     * @returns The number of events delivered
     */
    private deliverPendingNow;
    /**
     * Delivers a single event to a handler with retry and exponential backoff.
     * After max retries, marks as dead-lettered.
     * @param item - The pending event with its ack record
     * @param handler - The handler to deliver the event to
     */
    private deliverOne;
    /**
     * Delivers a single event to a handler with retry and exponential backoff.
     * Returns a result indicating whether delivery succeeded or dead-lettered.
     * @param item - The pending event with its ack record
     * @param handler - The handler to deliver the event to
     * @returns Result indicating delivered or deadLettered status
     */
    private deliverOneWithResult;
    /**
     * Schedules fan-out delivery to all registered subscribers.
     */
    private scheduleFanOut;
    /**
     * Schedules delivery to a specific consumer.
     * @param consumerId - The consumer ID to schedule delivery for
     */
    private scheduleDelivery;
    private dispatchVolatile;
    /**
     * Enqueues a delivery operation for a consumer.
     * @param consumerId - The consumer ID to deliver to
     * @param swallowErrors - If true, errors are caught and return 0; if false, errors propagate
     * @returns Promise resolving to number of events delivered
     */
    private enqueueDelivery;
    private assertNotDisposed;
}
