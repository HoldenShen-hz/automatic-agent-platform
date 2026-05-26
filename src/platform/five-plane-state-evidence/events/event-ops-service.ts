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
import { ValidationError } from "../../contracts/errors.js";

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
  outcome: "delivered" | "failed" | "timeout";
  errorCode: string | null;
}

export interface EventOpsServiceOptions {
  replayTimeoutMs?: number;
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
  private readonly replayTimeoutMs: number;

  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    options: EventOpsServiceOptions = {},
  ) {
    this.store = store;
    this.bus = new DurableEventBus(db, store);
    this.replayTimeoutMs = options.replayTimeoutMs ?? 30_000;
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
    const replayedFromHistoryCount = this.withTimeout(
      Promise.resolve(this.store.event.resetConsumerReplayState(consumerId)),
      `event_ops.replay_timeout:${consumerId}:reset`,
    );
    const result = await this.withTimeout(
      this.drainConsumer(consumerId),
      `event_ops.replay_timeout:${consumerId}:drain`,
    ).catch((error) => ({
      consumerId,
      pendingBefore: this.bus.pendingForConsumer(consumerId).length,
      failedBefore: this.store.event.listFailedEventsForConsumer(consumerId).length,
      replayedFromHistoryCount: 0,
      delivered: 0,
      pendingAfter: this.bus.pendingForConsumer(consumerId).length,
      failedAfter: this.store.event.listFailedEventsForConsumer(consumerId).length,
      outcome: this.isTimeoutError(error) ? "timeout" as const : "failed" as const,
      errorCode: error instanceof Error ? error.message : String(error),
    }));
    return {
      ...result,
      replayedFromHistoryCount: await replayedFromHistoryCount,
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
   * Disposes the underlying event bus and waits for in-flight polling/delivery
   * work to settle before callers tear down the backing database.
   */
  public async dispose(): Promise<void> {
    await this.bus.disposeAsync();
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
      this.bus.subscribe(consumerId, this.createDefaultConsumerHandler(consumerId));
    }
  }

  private createDefaultConsumerHandler(consumerId: string): (event: Parameters<DurableEventBus["subscribe"]>[1] extends (event: infer T) => unknown ? T : never) => Promise<void> {
    return async (event) => {
      // Phase 1a still reads from the authoritative store directly, but the
      // default consumer now validates referenced aggregates before acking.
      if (event.taskId != null && this.store.task.getTask(event.taskId) == null) {
        throw new ValidationError(
          "event_ops.consumer_missing_task",
          `event_ops.consumer_missing_task: Consumer ${consumerId} could not resolve task ${event.taskId}.`,
        );
      }
      if (event.executionId != null && this.store.execution.getExecution(event.executionId) == null) {
        throw new ValidationError(
          "event_ops.consumer_missing_execution",
          `event_ops.consumer_missing_execution: Consumer ${consumerId} could not resolve execution ${event.executionId}.`,
        );
      }
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutCode: string): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(timeoutCode)), this.replayTimeoutMs);
          timeoutHandle.unref?.();
        }),
      ]);
    } finally {
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith("event_ops.replay_timeout:");
  }
}
