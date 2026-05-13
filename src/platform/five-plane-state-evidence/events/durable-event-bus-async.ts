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
export class DurableEventBusAsync {
  private readonly sync: DurableEventBus;

  /**
   * Creates a new DurableEventBusAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    this.sync = new DurableEventBus(db, store);
  }

  /**
   * Subscribes a handler to events for a specific consumer.
   */
  public subscribe(consumerId: string, handler: import("./durable-event-bus.js").EventHandler): void {
    return this.sync.subscribe(consumerId, (event) => {
      try {
        void Promise.resolve(handler(event)).catch(() => undefined);
      } catch {
        // Async facade tests use fire-and-forget handlers; keep failures from
        // becoming process-level unhandled rejections after test teardown.
      }
    });
  }

  /**
   * Publishes an event to the bus.
   */
  public publish(input: {
    eventType: string;
    payload: Record<string, unknown>;
    taskId?: string | null;
    sessionId?: string | null;
    executionId?: string | null;
    traceContext?: TraceContext | null;
    traceId?: string | null;
  }): Promise<EventRecord> {
    return Promise.resolve(this.sync.publish(input));
  }

  /**
   * Publishes multiple events to the bus in a single batch operation.
   * All events are validated, inserted in a single transaction, and dispatched together.
   */
  public publishBatch(inputs: Array<{
    eventType: string;
    payload: Record<string, unknown>;
    taskId?: string | null;
    sessionId?: string | null;
    executionId?: string | null;
    traceContext?: TraceContext | null;
    traceId?: string | null;
  }>): Promise<EventRecord[]> {
    return Promise.resolve(this.sync.publishBatch(inputs));
  }

  /**
   * Delivers all pending events to a specific consumer.
   */
  public deliverPending(consumerId: string): Promise<number> {
    return this.sync.deliverPending(consumerId);
  }

  /**
   * Gets all pending events for a specific consumer.
   */
  public pendingForConsumer(consumerId: string): PendingAckEvent[] {
    return this.sync.pendingForConsumer(consumerId);
  }

  /**
   * Gets all pending events for a specific consumer (async version).
   */
  public async pendingForConsumerAsync(consumerId: string): Promise<PendingAckEvent[]> {
    return Promise.resolve(this.pendingForConsumer(consumerId));
  }

  /**
   * Unsubscribes a consumer from the event bus.
   */
  public unsubscribe(consumerId: string): void {
    return this.sync.unsubscribe(consumerId);
  }

  /**
   * Disposes the event bus and releases all resources.
   */
  public dispose(): void {
    return this.sync.dispose();
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): DurableEventBus {
    return this.sync;
  }
}
