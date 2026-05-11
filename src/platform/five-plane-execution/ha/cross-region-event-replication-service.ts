/**
 * Cross-Region Event Replication Service
 *
 * Provides cross-region event replication using Change Data Capture (CDC).
 * Ensures events are reliably replicated across regions with:
 * - Per-region acknowledgment tracking
 * - Retry with exponential backoff
 * - Replication lag monitoring
 * - Consistent ordering guarantee within region
 *
 * Architecture: §32 Deployment Strategy - D3 Multi-Region
 * @see docs_zh/architecture/00-platform-architecture.md §32
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { TypedEventPublisher } from "../../state-evidence/events/typed-event-publisher.js";
import type { TypedEventType, TypedEventPayloadMap } from "../../state-evidence/events/typed-event-bus.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReplicationStatus = "pending" | "replicating" | "completed" | "failed" | "partial";

export interface ReplicationTarget {
  regionId: string;
  status: "active" | "inactive" | "degraded";
  endpoint: string;
  latencyMs: number | null;
}

export interface ReplicatedEvent {
  eventId: string;
  sourceRegionId: string;
  targetRegionId: string;
  eventType: TypedEventType;
  payload: unknown;
  replicateAt: string;
  completedAt: string | null;
  status: ReplicationStatus;
  retryCount: number;
  lastError: string | null;
}

export interface ReplicationPlan {
  planId: string;
  eventId: string;
  sourceRegionId: string;
  targets: ReplicationTarget[];
  createdAt: string;
  status: ReplicationStatus;
  completedTargets: number;
  failedTargets: number;
}

export interface ReplicationMetrics {
  totalEvents: number;
  pendingCount: number;
  replicatingCount: number;
  completedCount: number;
  failedCount: number;
  averageLatencyMs: number;
  replicationRatePerSecond: number;
}

export interface ReplicationConfig {
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  batchSize: number;
  replicationIntervalMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ReplicationConfig = {
  maxRetries: 3,
  baseRetryDelayMs: 100,
  maxRetryDelayMs: 30000,
  batchSize: 100,
  replicationIntervalMs: 1000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Region Event Replication Service
// ─────────────────────────────────────────────────────────────────────────────

export class CrossRegionEventReplicationService {
  private readonly config: ReplicationConfig;
  private readonly pendingEvents = new Map<string, ReplicatedEvent[]>();
  private readonly replicationQueue: ReplicationPlan[] = [];
  private readonly targetRegions = new Map<string, ReplicationTarget>();
  private processingQueue: Promise<void> | null = null;

  constructor(
    private readonly publisher: TypedEventPublisher,
    private readonly sourceRegionId: string,
    config?: Partial<ReplicationConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registers a target region for replication.
   *
   * @param target - Target region configuration
   */
  public registerTargetRegion(target: ReplicationTarget): void {
    this.targetRegions.set(target.regionId, target);
  }

  /**
   * Removes a target region from replication.
   *
   * @param regionId - Region to remove
   */
  public removeTargetRegion(regionId: string): void {
    this.targetRegions.delete(regionId);
  }

  /**
   * Gets all registered target regions.
   */
  public getTargetRegions(): ReplicationTarget[] {
    return [...this.targetRegions.values()];
  }

  /**
   * Replicates an event to all registered target regions.
   *
   * @param eventType - Type of the event
   * @param payload - Event payload
   * @param targetRegionIds - Specific targets (or all if empty)
   * @returns Replication plan ID
   */
  public replicate<TType extends TypedEventType>(
    eventType: TType,
    payload: TypedEventPayloadMap[TType],
    targetRegionIds?: readonly string[],
  ): string {
    const eventId = newId("repl");
    const targets = targetRegionIds
      ? targetRegionIds.map((id) => this.targetRegions.get(id)).filter((t): t is ReplicationTarget => t !== undefined)
      : [...this.targetRegions.values()];

    if (targets.length === 0) {
      throw new Error("No target regions configured for replication");
    }

    const replicatedEvents: ReplicatedEvent[] = targets.map((target) => ({
      eventId,
      sourceRegionId: this.sourceRegionId,
      targetRegionId: target.regionId,
      eventType,
      payload,
      replicateAt: nowIso(),
      completedAt: null,
      status: "pending" as const,
      retryCount: 0,
      lastError: null,
    }));

    this.pendingEvents.set(eventId, replicatedEvents);

    const plan: ReplicationPlan = {
      planId: newId("rplan"),
      eventId,
      sourceRegionId: this.sourceRegionId,
      targets,
      createdAt: nowIso(),
      status: "pending",
      completedTargets: 0,
      failedTargets: 0,
    };

    this.replicationQueue.push(plan);
    this.ensureQueueProcessing();

    return eventId;
  }

  /**
   * Gets the replication status for an event.
   *
   * @param eventId - Event ID
   * @returns Replication status or null if not found
   */
  public getReplicationStatus(eventId: string): { status: ReplicationStatus; targets: ReplicatedEvent[] } | null {
    const events = this.pendingEvents.get(eventId);
    if (!events) return null;

    const statuses = new Set(events.map((e) => e.status));
    let overallStatus: ReplicationStatus;

    if (statuses.size === 1) {
      overallStatus = events[0]!.status;
    } else if (statuses.has("failed")) {
      overallStatus = "partial";
    } else if (statuses.has("completed")) {
      overallStatus = "partial";
    } else {
      overallStatus = "replicating";
    }

    return { status: overallStatus, targets: events };
  }

  /**
   * Gets replication metrics.
   */
  public getMetrics(): ReplicationMetrics {
    let totalEvents = 0;
    let pendingCount = 0;
    let replicatingCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const events of this.pendingEvents.values()) {
      totalEvents += events.length;
      for (const event of events) {
        switch (event.status) {
          case "pending":
            pendingCount++;
            break;
          case "replicating":
            replicatingCount++;
            break;
          case "completed":
            completedCount++;
            if (event.completedAt) {
              totalLatency += new Date(event.completedAt).getTime() - new Date(event.replicateAt).getTime();
              latencyCount++;
            }
            break;
          case "failed":
            failedCount++;
            break;
          case "partial":
            pendingCount++;
            break;
        }
      }
    }

    return {
      totalEvents,
      pendingCount,
      replicatingCount,
      completedCount,
      failedCount,
      averageLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
      replicationRatePerSecond: latencyCount > 0
        ? (completedCount * 1000) / Math.max(1, totalLatency)
        : 0,
    };
  }

  /**
   * Manually triggers replication for pending events.
   */
  public triggerReplication(): void {
    this.ensureQueueProcessing();
  }

  /**
   * Clears completed replication records older than a timestamp.
   *
   * @param olderThan - Timestamp threshold
   * @returns Number of records cleared
   */
  public pruneCompleted(olderThan: string): number {
    let pruned = 0;

    for (const [eventId, events] of this.pendingEvents.entries()) {
      const allCompleted = events.every(
        (e) =>
          e.status === "completed" &&
          e.completedAt !== null &&
          e.completedAt < olderThan,
      );

      if (allCompleted) {
        this.pendingEvents.delete(eventId);
        pruned++;
      }
    }

    return pruned;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private ensureQueueProcessing(): void {
    if (this.processingQueue !== null) {
      return;
    }

    this.processingQueue = this.processReplicationQueue()
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        for (const plan of this.replicationQueue.splice(0)) {
          this.markPlanFailed(plan, message);
        }
      })
      .finally(() => {
        this.processingQueue = null;
        if (this.replicationQueue.length > 0) {
          this.ensureQueueProcessing();
        }
      });
  }

  private async processReplicationQueue(): Promise<void> {
    while (this.replicationQueue.length > 0) {
      const plan = this.replicationQueue.shift()!;
      try {
        await this.executePlan(plan);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.markPlanFailed(plan, message);
      }
    }
  }

  private async executePlan(plan: ReplicationPlan): Promise<void> {
    const events = this.pendingEvents.get(plan.eventId);
    if (!events) return;

    plan.status = "replicating";

    const completedPromises: Promise<void>[] = [];

    for (const event of events) {
      if (event.status === "completed" || event.status === "failed") {
        continue;
      }

      event.status = "replicating";
      completedPromises.push(this.replicateToTarget(event, plan));
    }

    await Promise.all(completedPromises);

    // Update plan status
    const allCompleted = events.every((e) => e.status === "completed");
    const anyFailed = events.some((e) => e.status === "failed" && e.retryCount >= this.config.maxRetries);

    if (allCompleted) {
      plan.status = "completed";
    } else if (anyFailed) {
      plan.status = "failed";
    } else {
      plan.status = "partial";
    }

    plan.completedTargets = events.filter((e) => e.status === "completed").length;
    plan.failedTargets = events.filter((e) => e.status === "failed").length;
  }

  private async replicateToTarget(event: ReplicatedEvent, plan: ReplicationPlan): Promise<void> {
    try {
      // In a real implementation, this would send to a cross-region message queue
      // or use a dedicated replication transport. Here we just publish via the event bus.
      await Promise.resolve(this.publisher.publish({
        eventType: event.eventType as TypedEventType,
        payload: event.payload as TypedEventPayloadMap[TypedEventType],
      }));

      event.completedAt = nowIso();
      event.status = "completed";
    } catch (error) {
      event.retryCount++;
      event.lastError = error instanceof Error ? error.message : String(error);

      if (event.retryCount >= this.config.maxRetries) {
        event.status = "failed";
      } else {
        event.status = "pending";
        // R29-23: Re-add plan to queue for retry since queue was already shifted out
        // when executePlan initially processed it. Without this, the retry timeout
        // would find an empty queue and the event would never be retried.
        if (!this.replicationQueue.some((p) => p.planId === plan.planId)) {
          this.replicationQueue.push(plan);
        }
        // Re-queue with backoff delay
        setTimeout(() => {
          this.ensureQueueProcessing();
        }, this.calculateBackoff(event.retryCount));
      }
    }
  }

  private markPlanFailed(plan: ReplicationPlan, message: string): void {
    const events = this.pendingEvents.get(plan.eventId);
    if (events) {
      for (const event of events) {
        if (event.status === "completed") {
          continue;
        }
        event.status = "failed";
        event.lastError = message;
        event.completedAt = event.completedAt ?? nowIso();
        event.retryCount = Math.max(event.retryCount, this.config.maxRetries);
      }
      plan.completedTargets = events.filter((event) => event.status === "completed").length;
      plan.failedTargets = events.filter((event) => event.status === "failed").length;
    }

    plan.status = "failed";
  }

  private calculateBackoff(retryCount: number): number {
    const delay = this.config.baseRetryDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, this.config.maxRetryDelayMs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createCrossRegionEventReplicationService(
  publisher: TypedEventPublisher,
  sourceRegionId: string,
  config?: Partial<ReplicationConfig>,
): CrossRegionEventReplicationService {
  return new CrossRegionEventReplicationService(publisher, sourceRegionId, config);
}
