/**
 * Async Durable Event Bus
 *
 * Async version of DurableEventBus that provides async/await interface.
 * This is a thin async wrapper around the sync DurableEventBus,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see DurableEventBus for the sync implementation
 */
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import type { EventRecord, TraceContext } from "../../contracts/types/domain.js";
import type { PendingAckEvent } from "../truth/authoritative-task-store.js";
import { DurableEventBus } from "./durable-event-bus.js";
export type { EventHandler } from "./durable-event-bus.js";
/**
 * Async Durable Event Bus
 *
 * Reliable event delivery with acknowledgment tracking.
 *
 * This async version provides the same functionality as DurableEventBus
 * but with async/await interface for modern async contexts.
 */
export declare class DurableEventBusAsync {
    private readonly sync;
    /**
     * Creates a new DurableEventBusAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Subscribes a handler to events for a specific consumer.
     */
    subscribe(consumerId: string, handler: import("./durable-event-bus.js").EventHandler): void;
    /**
     * Publishes an event to the bus.
     */
    publish(input: {
        eventType: string;
        payload: Record<string, unknown>;
        taskId?: string | null;
        sessionId?: string | null;
        executionId?: string | null;
        traceContext?: TraceContext | null;
        traceId?: string | null;
    }): Promise<EventRecord>;
    /**
     * Publishes multiple events to the bus in a single batch operation.
     * All events are validated, inserted in a single transaction, and dispatched together.
     */
    publishBatch(inputs: Array<{
        eventType: string;
        payload: Record<string, unknown>;
        taskId?: string | null;
        sessionId?: string | null;
        executionId?: string | null;
        traceContext?: TraceContext | null;
        traceId?: string | null;
    }>): Promise<EventRecord[]>;
    /**
     * Delivers all pending events to a specific consumer.
     */
    deliverPending(consumerId: string): Promise<number>;
    /**
     * Gets all pending events for a specific consumer.
     */
    pendingForConsumer(consumerId: string): PendingAckEvent[];
    /**
     * Gets all pending events for a specific consumer (async version).
     */
    pendingForConsumerAsync(consumerId: string): Promise<PendingAckEvent[]>;
    /**
     * Unsubscribes a consumer from the event bus.
     */
    unsubscribe(consumerId: string): void;
    /**
     * Disposes the event bus and releases all resources.
     */
    dispose(): void;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): DurableEventBus;
}
