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
import { EVENT_SCHEMA_REGISTRY } from "./event-registry.js";
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
 * Set of all default Tier 1 consumers extracted from event schemas.
 * These consumers are registered by default as they handle core business logic.
 */
const DEFAULT_TIER1_CONSUMERS = new Set(
  Object.values(EVENT_SCHEMA_REGISTRY).flatMap((schema) => schema.consumers),
);

/**
 * Service for managing event operations including draining, replay, and subscriptions.
 * Provides durable event delivery semantics for the event bus.
 */
export class EventOpsService {
  private readonly bus: DurableEventBus;
  private readonly store: AuthoritativeTaskStore;

  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
  ) {
    this.store = store;
    this.bus = new DurableEventBus(db, store);
    this.registerDefaultConsumers();
  }

  /**
   * Drains all pending events for all default Tier 1 consumers.
   * Iterates through each registered Tier 1 consumer and delivers their pending events.
   * @returns Array of drain results for each consumer
   */
  public async drainDefaultConsumers(): Promise<EventDrainResult[]> {
    return Promise.all([...DEFAULT_TIER1_CONSUMERS].map((consumerId) => this.drainConsumer(consumerId)));
  }

  /**
   * Replays events for all default Tier 1 consumers.
   * @returns Array of replay results for each consumer
   */
  public async replayDefaultConsumers(): Promise<EventDrainResult[]> {
    return Promise.all([...DEFAULT_TIER1_CONSUMERS].map((consumerId) => this.replayConsumer(consumerId)));
  }

  /**
   * Drains pending events for a specific consumer.
   * Attempts to deliver all pending events to the consumer and tracks success/failure.
   * @param consumerId - The consumer ID to drain events for
   * @returns The drain result including counts and outcome
   */
  public async drainConsumer(consumerId: string): Promise<EventDrainResult> {
    const pendingBefore = this.bus.pendingForConsumer(consumerId).length;
    const failedBefore = this.store.event.listFailedEventsForConsumer(consumerId).length;

    try {
      const delivered = await this.bus.deliverPending(consumerId);
      const pendingAfter = this.bus.pendingForConsumer(consumerId).length;
      const failedAfter = this.store.event.listFailedEventsForConsumer(consumerId).length;

      return {
        consumerId,
        pendingBefore,
        failedBefore,
        replayedFromHistoryCount: 0,
        delivered,
        pendingAfter,
        failedAfter,
        outcome: "delivered",
        errorCode: null,
      };
    } catch (error) {
      const pendingAfter = this.bus.pendingForConsumer(consumerId).length;
      const failedAfter = this.store.event.listFailedEventsForConsumer(consumerId).length;

      return {
        consumerId,
        pendingBefore,
        failedBefore,
        replayedFromHistoryCount: 0,
        delivered: 0,
        pendingAfter,
        failedAfter,
        outcome: "failed",
        errorCode: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Replays events for a specific consumer.
   * Resets historical acknowledgements to pending before delivering them again.
   * @param consumerId - The consumer ID to replay events for
   * @returns The replay result
   */
  public async replayConsumer(consumerId: string): Promise<EventDrainResult> {
    const replayedFromHistoryCount = this.store.event.resetConsumerReplayState(consumerId);
    const result = await this.drainConsumer(consumerId);
    return {
      ...result,
      replayedFromHistoryCount,
    };
  }

  /**
   * Subscribes a handler to events for a specific consumer.
   * @param consumerId - The consumer ID to subscribe
   * @param handler - The handler function to call for each event
   */
  public subscribe(consumerId: string, handler: Parameters<DurableEventBus["subscribe"]>[1]): void {
    this.bus.subscribe(consumerId, handler);
  }

  /**
   * Lists all default Tier 1 consumer IDs in sorted order.
   * @returns Array of consumer IDs
   */
  public listDefaultConsumers(): string[] {
    return [...DEFAULT_TIER1_CONSUMERS].sort();
  }

  /**
   * Registers default consumers with the event bus.
   * These consumers read from the authoritative store directly to provide durable ack/replay semantics.
   */
  private registerDefaultConsumers(): void {
    for (const consumerId of DEFAULT_TIER1_CONSUMERS) {
      this.bus.subscribe(consumerId, async () => {
        // Phase 1a reads from the authoritative store directly; this consumer exists to provide durable ack/replay semantics.
      });
    }
  }
}
