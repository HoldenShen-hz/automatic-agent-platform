/**
 * Event Operations Service
 *
 * Provides event operations including draining, replay, and subscriptions for
 * the durable event bus. Implements durable event delivery semantics with
 * explicit acknowledgement handling for Tier 1 consumers.
 *
 * @see {@link docs_zh/contracts/event_bus_contract.md}
 * @see {@link docs_zh/contracts/event_registry_and_ops_threshold_contract.md}
 * @see {@link docs_zh/contracts/typed_event_bus_contract.md}
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 */
import { DurableEventBus } from "./durable-event-bus.js";
import { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../truth/authoritative-sql-database.js";
/**
 * Result of a drain operation for a specific consumer.
 * Contains before/after counts to determine if events were successfully delivered.
 */
export interface EventDrainResult {
    consumerId: string;
    pendingBefore: number;
    failedBefore: number;
    replayedFromHistoryCount: number;
    delivered: number;
    pendingAfter: number;
    failedAfter: number;
    outcome: "delivered" | "failed";
    errorCode: string | null;
}
/**
 * Service for managing event operations including draining, replay, and subscriptions.
 * Provides durable event delivery semantics for the event bus.
 */
export declare class EventOpsService {
    private readonly bus;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Drains all pending events for all default Tier 1 consumers.
     * Iterates through each registered Tier 1 consumer and delivers their pending events.
     * @returns Array of drain results for each consumer
     */
    drainDefaultConsumers(): Promise<EventDrainResult[]>;
    /**
     * Replays events for all default Tier 1 consumers.
     * @returns Array of replay results for each consumer
     */
    replayDefaultConsumers(): Promise<EventDrainResult[]>;
    /**
     * Drains pending events for a specific consumer.
     * Attempts to deliver all pending events to the consumer and tracks success/failure.
     * @param consumerId - The consumer ID to drain events for
     * @returns The drain result including counts and outcome
     */
    drainConsumer(consumerId: string): Promise<EventDrainResult>;
    /**
     * Replays events for a specific consumer.
     * Resets historical acknowledgements to pending before delivering them again.
     * @param consumerId - The consumer ID to replay events for
     * @returns The replay result
     */
    replayConsumer(consumerId: string): Promise<EventDrainResult>;
    /**
     * Subscribes a handler to events for a specific consumer.
     * @param consumerId - The consumer ID to subscribe
     * @param handler - The handler function to call for each event
     */
    subscribe(consumerId: string, handler: Parameters<DurableEventBus["subscribe"]>[1]): void;
    /**
     * Lists all default Tier 1 consumer IDs in sorted order.
     * @returns Array of consumer IDs
     */
    listDefaultConsumers(): string[];
    /**
     * Registers default consumers with the event bus.
     * These consumers read from the authoritative store directly to provide durable ack/replay semantics.
     */
    private registerDefaultConsumers;
}
