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
import { DurableEventBus } from "./durable-event-bus.js";
/**
 * Async Durable Event Bus
 *
 * Reliable event delivery with acknowledgment tracking.
 *
 * This async version provides the same functionality as DurableEventBus
 * but with async/await interface for modern async contexts.
 */
export class DurableEventBusAsync {
    sync;
    /**
     * Creates a new DurableEventBusAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db, store) {
        this.sync = new DurableEventBus(db, store);
    }
    /**
     * Subscribes a handler to events for a specific consumer.
     */
    subscribe(consumerId, handler) {
        return this.sync.subscribe(consumerId, handler);
    }
    /**
     * Publishes an event to the bus.
     */
    publish(input) {
        return Promise.resolve(this.sync.publish(input));
    }
    /**
     * Publishes multiple events to the bus in a single batch operation.
     * All events are validated, inserted in a single transaction, and dispatched together.
     */
    publishBatch(inputs) {
        return Promise.resolve(this.sync.publishBatch(inputs));
    }
    /**
     * Delivers all pending events to a specific consumer.
     */
    deliverPending(consumerId) {
        return this.sync.deliverPending(consumerId);
    }
    /**
     * Gets all pending events for a specific consumer.
     */
    pendingForConsumer(consumerId) {
        return this.sync.pendingForConsumer(consumerId);
    }
    /**
     * Gets all pending events for a specific consumer (async version).
     */
    async pendingForConsumerAsync(consumerId) {
        return Promise.resolve(this.pendingForConsumer(consumerId));
    }
    /**
     * Unsubscribes a consumer from the event bus.
     */
    unsubscribe(consumerId) {
        return this.sync.unsubscribe(consumerId);
    }
    /**
     * Disposes the event bus and releases all resources.
     */
    dispose() {
        return this.sync.dispose();
    }
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService() {
        return this.sync;
    }
}
//# sourceMappingURL=durable-event-bus-async.js.map