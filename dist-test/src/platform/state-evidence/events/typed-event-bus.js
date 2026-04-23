import { DurableEventBus } from "./durable-event-bus.js";
import { getEventSchema } from "./event-registry.js";
const TYPED_EVENT_COVERAGE_CHECK = true;
void TYPED_EVENT_COVERAGE_CHECK;
/**
 * TypedEventBus - Provides type-safe event publishing and subscribing.
 * Wraps the DurableEventBus with compile-time type checking for event payloads.
 */
export class TypedEventBus {
    bus;
    constructor(db, store) {
        this.bus = new DurableEventBus(db, store);
    }
    /**
     * Publishes a typed event to the event bus.
     * Validates the event type against the schema before publishing.
     * @param input - The event data including type, payload, and optional IDs
     * @returns The persisted event record
     */
    publish(input) {
        getEventSchema(input.eventType);
        return this.bus.publish({
            ...input,
            payload: input.payload,
        });
    }
    /**
     * Subscribes a handler to specific typed event types.
     * The handler receives events with fully typed payloads.
     * @param consumerId - The consumer ID to subscribe
     * @param eventTypes - Array of event types to subscribe to
     * @param handler - Handler function called for each matching event
     */
    subscribe(consumerId, eventTypes, handler) {
        const accepted = new Set(eventTypes);
        const typedHandler = async (event) => {
            if (!accepted.has(event.eventType)) {
                return;
            }
            await handler({
                event: event,
                payload: JSON.parse(event.payloadJson),
            });
        };
        this.bus.subscribe(consumerId, typedHandler);
    }
    /**
     * Unsubscribes a consumer from the event bus.
     * @param consumerId - The consumer ID to unsubscribe
     */
    unsubscribe(consumerId) {
        this.bus.unsubscribe(consumerId);
    }
    /**
     * Delivers all pending events to a specific consumer.
     * @param consumerId - The consumer ID to deliver events to
     * @returns The number of events delivered
     */
    async deliverPending(consumerId) {
        return this.bus.deliverPending(consumerId);
    }
    /**
     * Gets all pending events for a specific consumer.
     * @param consumerId - The consumer ID to get pending events for
     * @returns Array of pending events
     */
    pendingForConsumer(consumerId) {
        return this.bus.pendingForConsumer(consumerId);
    }
}
//# sourceMappingURL=typed-event-bus.js.map