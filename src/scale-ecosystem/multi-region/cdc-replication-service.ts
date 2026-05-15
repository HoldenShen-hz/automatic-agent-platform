/**
 * CDC Replication Service
 *
 * Implements multi-region data synchronization using Change Data Capture (CDC).
 * Based on event store for asynchronous cross-region replication.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";

const cdcLogger = new StructuredLogger({ retentionLimit: 500 });

/**
 * CDC replication event types
 */
export const CDC_EVENT_TYPES = [
  "cdc:replication_started",
  "cdc:replication_completed",
  "cdc:replication_failed",
  "cdc:checkpoint_updated",
] as const;

/**
 * Region replication status
 */
export type ReplicationStatus = "idle" | "syncing" | "completed" | "failed";

/**
 * CDC replication checkpoint
 */
export interface CDCReplicationCheckpoint {
  readonly checkpointId: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly lastEventId: string | null;
  readonly lastEventSequence: number;
  readonly processedAt: string;
}

/**
 * CDC replication event - extends EventRecord with sequence for ordering
 */
export interface CDCReplicationEvent {
  readonly id: string;
  readonly sequence: number;
  readonly eventType: string;
  readonly taskId: string;
  readonly payloadJson: string;
  readonly createdAt: string;
  readonly sourceRegionId?: string;
  readonly vectorClock?: Readonly<Record<string, number>>;
}

/**
 * CDC replication batch
 */
export interface CDCReplicationBatch {
  readonly batchId: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly events: readonly CDCReplicationEvent[];
  readonly startSequence: number;
  readonly endSequence: number;
  readonly createdAt: string;
}

/**
 * CDC replication result
 */
export interface CDCReplicationResult {
  readonly success: boolean;
  readonly batchId: string;
  readonly eventsReplicated: number;
  readonly lastSequence: number;
  readonly durationMs: number;
  readonly errors: readonly string[];
}

/**
 * Region replication configuration
 */
export interface RegionReplicationConfig {
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly batchSize: number;
  readonly maxQueueDepth?: number;
  readonly replicationIntervalMs: number;
  readonly enabled: boolean;
  readonly retryPolicy: {
    readonly maxRetries: number;
    readonly backoffMs: number;
  };
}

export interface ReplicationLagStatus {
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly measuredAt: string;
  readonly pendingEvents: number;
  readonly lagMs: number;
  readonly lagSloMs: number;
  readonly withinSlo: boolean;
}

/**
 * CDC lag breach error - thrown when replication lag exceeds RPO SLA
 */
export class CdcLagBreachError extends Error {
  constructor(
    public readonly sourceRegionId: string,
    public readonly targetRegionId: string,
    public readonly lagMs: number,
    public readonly lagSloMs: number,
  ) {
    super(`CDC_LAG_BREACH:${sourceRegionId}->${targetRegionId} lag=${lagMs}ms exceeds RPO=${lagSloMs}ms`);
    this.name = "CdcLagBreachError";
  }
}

export class CdcQueueBackpressureError extends Error {
  constructor(
    public readonly replicationKey: string,
    public readonly queueDepth: number,
    public readonly maxQueueDepth: number,
  ) {
    super(`CDC_QUEUE_BACKPRESSURE:${replicationKey} depth=${queueDepth} max=${maxQueueDepth}`);
    this.name = "CdcQueueBackpressureError";
  }
}

export type VectorClockComparison = -1 | 0 | 1;
export type ConflictResolutionStrategy = "lww" | "merge" | "abort";

export class VectorClock {
  private readonly versions: Map<string, number>;

  public constructor(initial?: Map<string, number> | Readonly<Record<string, number>>) {
    if (initial instanceof Map) {
      this.versions = new Map(initial);
      return;
    }
    this.versions = new Map(Object.entries(initial ?? {}));
  }

  public update(regionId: string, sequence: number): void {
    const current = this.versions.get(regionId) ?? 0;
    if (sequence > current) {
      this.versions.set(regionId, sequence);
    }
  }

  public increment(regionId: string): this {
    this.update(regionId, (this.versions.get(regionId) ?? 0) + 1);
    return this;
  }

  public merge(other: VectorClock): VectorClock {
    const merged = new VectorClock(this.versions);
    for (const [regionId, sequence] of other.versions.entries()) {
      merged.update(regionId, sequence);
    }
    return merged;
  }

  public compare(other: VectorClock): VectorClockComparison {
    const regionIds = new Set<string>([
      ...this.versions.keys(),
      ...other.versions.keys(),
    ]);
    let thisLess = false;
    let thisGreater = false;
    for (const regionId of regionIds) {
      const left = this.versions.get(regionId) ?? 0;
      const right = other.versions.get(regionId) ?? 0;
      if (left < right) {
        thisLess = true;
      } else if (left > right) {
        thisGreater = true;
      }
      if (thisLess && thisGreater) {
        return 0;
      }
    }
    if (thisLess) {
      return -1;
    }
    if (thisGreater) {
      return 1;
    }
    return 0;
  }

  public toMap(): Map<string, number> {
    return new Map(this.versions);
  }

  public getMaxSequence(): number {
    let max = 0;
    for (const sequence of this.versions.values()) {
      if (sequence > max) {
        max = sequence;
      }
    }
    return max;
  }
}

export interface CDCReplicationConflict {
  readonly taskId: string;
  readonly localEventId: string;
  readonly remoteEventId: string;
  readonly resolution: "local_wins" | "remote_wins" | "merged" | "aborted";
}

export interface CDCConflictResolutionResult {
  readonly resolved: boolean;
  readonly resolvedEvent: CDCReplicationEvent | null;
  readonly conflict: CDCReplicationConflict | null;
  readonly strategy?: ConflictResolutionStrategy;
}

/**
 * CDC replication service for multi-region data sync
 */
export class CDCReplicationService {
  private readonly checkpoints = new Map<string, CDCReplicationCheckpoint>();
  private readonly configs = new Map<string, RegionReplicationConfig>();
  private readonly replicationQueues = new Map<string, CDCReplicationBatch[]>();
  private readonly latestSourceEventAt = new Map<string, string>();
  private readonly processedEventCounts = new Map<string, number>();
  private readonly vectorClocks = new Map<string, VectorClock>();
  private readonly conflictHistory = new Map<string, CDCReplicationConflict[]>();

  /**
   * Register a replication configuration
   */
  public registerReplication(config: RegionReplicationConfig): void {
    const key = this.getConfigKey(config.sourceRegionId, config.targetRegionId);
    this.configs.set(key, config);

    // Initialize checkpoint if not exists
    if (!this.checkpoints.has(key)) {
      this.checkpoints.set(key, {
        checkpointId: newId("cdc_checkpoint"),
        sourceRegionId: config.sourceRegionId,
        targetRegionId: config.targetRegionId,
        lastEventId: null,
        lastEventSequence: 0,
        processedAt: nowIso(),
      });
    }
  }

  /**
   * Get replication configuration
   */
  public getConfig(sourceRegionId: string, targetRegionId: string): RegionReplicationConfig | undefined {
    return this.configs.get(this.getConfigKey(sourceRegionId, targetRegionId));
  }

  /**
   * Get current checkpoint for replication pair
   */
  public getCheckpoint(sourceRegionId: string, targetRegionId: string): CDCReplicationCheckpoint | undefined {
    return this.checkpoints.get(this.getConfigKey(sourceRegionId, targetRegionId));
  }

  /**
   * Prepare a replication batch from source events
   */
  public prepareBatch(
    sourceRegionId: string,
    targetRegionId: string,
    sourceEvents: readonly CDCReplicationEvent[],
  ): CDCReplicationBatch | null {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);
    const checkpoint = this.checkpoints.get(key);

    if (!checkpoint) {
      return null;
    }

    const config = this.configs.get(key);
    const batchSize = config?.batchSize ?? 100;

    // Filter events after checkpoint. Sequence 0 is the initial checkpoint boundary.
    const eventsToReplicate = sourceEvents.filter((event) => event.sequence > checkpoint.lastEventSequence);

    if (eventsToReplicate.length === 0) {
      return null;
    }

    const batchEvents = eventsToReplicate.slice(0, batchSize);
    const startSequence = batchEvents[0]?.sequence ?? checkpoint.lastEventSequence;
    const endSequence = batchEvents[batchEvents.length - 1]?.sequence ?? startSequence;

    const batch: CDCReplicationBatch = {
      batchId: newId("cdc_batch"),
      sourceRegionId,
      targetRegionId,
      events: batchEvents,
      startSequence,
      endSequence,
      createdAt: nowIso(),
    };

    const latestEvent = batchEvents[batchEvents.length - 1];
    if (latestEvent != null) {
      this.latestSourceEventAt.set(key, latestEvent.createdAt);
    }

    // Queue batch for async replication
    this.enqueueBatch(key, batch);

    return batch;
  }

  /**
   * Mark batch as replicated and update checkpoint
   */
  public confirmBatch(
    sourceRegionId: string,
    targetRegionId: string,
    batch: CDCReplicationBatch,
  ): void {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);

    const lastEvent = batch.events[batch.events.length - 1];
    const checkpoint: CDCReplicationCheckpoint = {
      checkpointId: this.checkpoints.get(key)?.checkpointId ?? newId("cdc_checkpoint"),
      sourceRegionId,
      targetRegionId,
      lastEventId: lastEvent?.id ?? null,
      lastEventSequence: batch.endSequence,
      processedAt: nowIso(),
    };

    this.checkpoints.set(key, checkpoint);
    this.processedEventCounts.set(key, Math.max(this.processedEventCounts.get(key) ?? 0, batch.endSequence));
    this.removeBatchFromQueue(key, batch.batchId);
  }

  /**
   * Record failed replication
   */
  public recordFailure(
    sourceRegionId: string,
    targetRegionId: string,
    batch: CDCReplicationBatch,
    error: string,
  ): void {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);
    this.removeBatchFromQueue(key, batch.batchId);
    cdcLogger.error(`CDC replication failed for ${key}: ${error}`, {
      data: { sourceRegionId, targetRegionId, batchId: batch.batchId },
    });
  }

  /**
   * Get replication status for a region pair
   */
  public getStatus(sourceRegionId: string, targetRegionId: string): ReplicationStatus {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);
    const queue = this.replicationQueues.get(key);

    if (!queue || queue.length === 0) {
      return "idle";
    }

    // Check if there's pending work
    const hasPending = queue.some((batch) => batch.events.length > 0);
    return hasPending ? "syncing" : "idle";
  }

  /**
   * Get all registered region pairs
   */
  public getRegisteredRegionPairs(): readonly { sourceRegionId: string; targetRegionId: string }[] {
    const pairs: { sourceRegionId: string; targetRegionId: string }[] = [];
    for (const key of this.configs.keys()) {
      const parts = key.split("->");
      if (parts.length === 2 && parts[0] && parts[1]) {
        pairs.push({ sourceRegionId: parts[0], targetRegionId: parts[1] });
      }
    }
    return pairs;
  }

  /**
   * Check if replication is enabled for a region pair
   */
  public isEnabled(sourceRegionId: string, targetRegionId: string): boolean {
    const config = this.getConfig(sourceRegionId, targetRegionId);
    return config?.enabled ?? false;
  }

  /**
   * Calculate pending replication lag (events behind).
   * Legacy API preserved for compatibility with existing callers.
   */
  public getPendingEventCount(
    sourceRegionId: string,
    targetRegionId: string,
    totalSourceEvents: number,
  ): number {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);
    const checkpoint = this.checkpoints.get(key);
    if (checkpoint != null) {
      return Math.max(0, totalSourceEvents - checkpoint.lastEventSequence);
    }
    const processedEventCount = this.processedEventCounts.get(key);
    if (processedEventCount != null) {
      return Math.max(0, totalSourceEvents - processedEventCount);
    }
    return totalSourceEvents;
  }

  public getQueueDepth(sourceRegionId: string, targetRegionId: string): number {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);
    return this.replicationQueues.get(key)?.length ?? 0;
  }

  /**
   * Calculate replication lag.
   * When source events are provided, returns time lag in milliseconds.
   * When a numeric total is provided, preserves legacy pending-event count behavior.
   */
  public getReplicationLag(
    sourceRegionId: string,
    targetRegionId: string,
    sourceEventsOrCount: readonly CDCReplicationEvent[] | number,
  ): number {
    if (Array.isArray(sourceEventsOrCount)) {
      return this.getReplicationLagStatus(sourceRegionId, targetRegionId, sourceEventsOrCount).lagMs;
    }
    return this.getPendingEventCount(sourceRegionId, targetRegionId, sourceEventsOrCount as number);
  }

  /**
   * Return time-based replication lag monitoring aligned to the <=30s SLA.
   */
  public getReplicationLagStatus(
    sourceRegionId: string,
    targetRegionId: string,
    sourceEvents: readonly CDCReplicationEvent[],
    lagSloMs = 30_000,
  ): ReplicationLagStatus {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);
    const checkpoint = this.getCheckpoint(sourceRegionId, targetRegionId);
    const latestEventAt = sourceEvents[sourceEvents.length - 1]?.createdAt
      ?? this.latestSourceEventAt.get(key)
      ?? null;
    const pendingEvents = checkpoint == null
      ? sourceEvents.length
      : sourceEvents.filter((event) => event.sequence > checkpoint.lastEventSequence).length;
    const checkpointAt = checkpoint?.processedAt ?? nowIso();
    const lagMs = latestEventAt == null
      ? 0
      : Math.max(0, Date.parse(latestEventAt) - Date.parse(checkpointAt));

    return {
      sourceRegionId,
      targetRegionId,
      measuredAt: nowIso(),
      pendingEvents,
      lagMs,
      lagSloMs,
      withinSlo: lagMs <= lagSloMs,
    };
  }

  /**
   * R21-06: Assert CDC replication lag is within RPO SLA.
   * Throws CdcLagBreachError if lag exceeds the configured threshold.
   * Used to enforce §52 RPO guarantees - RPO<1min SLA.
   */
  public assertReplicationLagWithinSlo(
    sourceRegionId: string,
    targetRegionId: string,
    sourceEvents: readonly CDCReplicationEvent[],
    lagSloMs = 30_000,
  ): void {
    const status = this.getReplicationLagStatus(sourceRegionId, targetRegionId, sourceEvents, lagSloMs);
    if (!status.withinSlo) {
      throw new CdcLagBreachError(sourceRegionId, targetRegionId, status.lagMs, status.lagSloMs);
    }
  }

  /**
   * R21-06: Get replication lag status and throw if SLA breached.
   * Returns the status object regardless; throws on breach.
   */
  public getReplicationLagStatusOrThrow(
    sourceRegionId: string,
    targetRegionId: string,
    sourceEvents: readonly CDCReplicationEvent[],
    lagSloMs = 30_000,
  ): ReplicationLagStatus {
    const status = this.getReplicationLagStatus(sourceRegionId, targetRegionId, sourceEvents, lagSloMs);
    if (!status.withinSlo) {
      throw new CdcLagBreachError(sourceRegionId, targetRegionId, status.lagMs, status.lagSloMs);
    }
    return status;
  }

  public updateVectorClock(entityId: string, regionId: string, sequence: number): VectorClock {
    const current = this.vectorClocks.get(entityId) ?? new VectorClock();
    current.update(regionId, sequence);
    this.vectorClocks.set(entityId, current);
    return current;
  }

  public getVectorClock(entityId: string): VectorClock | undefined {
    return this.vectorClocks.get(entityId);
  }

  public mergeVectorClock(entityId: string, remoteClock: VectorClock): VectorClock {
    const merged = (this.vectorClocks.get(entityId) ?? new VectorClock()).merge(remoteClock);
    this.vectorClocks.set(entityId, merged);
    return merged;
  }

  public detectConflict(localEvent: CDCReplicationEvent, remoteEvent: CDCReplicationEvent): boolean {
    if (localEvent.taskId !== remoteEvent.taskId) {
      return false;
    }
    const localClock = this.getEventVectorClock(localEvent);
    const remoteClock = this.getEventVectorClock(remoteEvent);
    if (localClock != null && remoteClock != null) {
      return localClock.compare(remoteClock) === 0 && localEvent.id !== remoteEvent.id;
    }
    return localEvent.sequence === remoteEvent.sequence && localEvent.id !== remoteEvent.id;
  }

  public resolveConflictLWW(
    localEvent: CDCReplicationEvent,
    remoteEvent: CDCReplicationEvent,
  ): CDCConflictResolutionResult {
    const localAt = Date.parse(localEvent.createdAt);
    const remoteAt = Date.parse(remoteEvent.createdAt);
    const remoteWins = Number.isNaN(localAt) || (!Number.isNaN(remoteAt) && remoteAt >= localAt);
    return {
      resolved: true,
      resolvedEvent: remoteWins ? remoteEvent : localEvent,
      strategy: "lww",
      conflict: {
        taskId: localEvent.taskId,
        localEventId: localEvent.id,
        remoteEventId: remoteEvent.id,
        resolution: remoteWins ? "remote_wins" : "local_wins",
      },
    };
  }

  public resolveConflictMerge(
    localEvent: CDCReplicationEvent,
    remoteEvent: CDCReplicationEvent,
  ): CDCConflictResolutionResult {
    const localPayload = this.parsePayload(localEvent.payloadJson);
    const remotePayload = this.parsePayload(remoteEvent.payloadJson);
    const mergedEvent: CDCReplicationEvent = {
      ...remoteEvent,
      payloadJson: JSON.stringify({
        ...localPayload,
        ...remotePayload,
        _merged: true,
      }),
    };
    return {
      resolved: true,
      resolvedEvent: mergedEvent,
      strategy: "merge",
      conflict: {
        taskId: localEvent.taskId,
        localEventId: localEvent.id,
        remoteEventId: remoteEvent.id,
        resolution: "merged",
      },
    };
  }

  public resolveConflict(
    localEvent: CDCReplicationEvent,
    remoteEvent: CDCReplicationEvent,
    strategy: ConflictResolutionStrategy = "lww",
  ): CDCConflictResolutionResult {
    if (strategy === "abort") {
      return {
        resolved: false,
        resolvedEvent: null,
        strategy: "abort",
        conflict: {
          taskId: localEvent.taskId,
          localEventId: localEvent.id,
          remoteEventId: remoteEvent.id,
          resolution: "aborted",
        },
      };
    }

    if (!this.detectConflict(localEvent, remoteEvent)) {
      const localClock = this.getEventVectorClock(localEvent);
      const remoteClock = this.getEventVectorClock(remoteEvent);
      if (localClock != null && remoteClock != null) {
        const comparison = localClock.compare(remoteClock);
        if (comparison === -1) {
          return {
            resolved: true,
            resolvedEvent: remoteEvent,
            strategy,
            conflict: null,
          };
        }
        if (comparison === 1) {
          return {
            resolved: true,
            resolvedEvent: localEvent,
            strategy,
            conflict: null,
          };
        }
      }
    }
    return strategy === "merge"
      ? this.resolveConflictMerge(localEvent, remoteEvent)
      : this.resolveConflictLWW(localEvent, remoteEvent);
  }

  public recordConflict(taskId: string, conflict: CDCReplicationConflict): void {
    const history = this.conflictHistory.get(taskId) ?? [];
    history.push(conflict);
    this.conflictHistory.set(taskId, history.slice(-100));
  }

  public getConflictHistory(taskId: string): readonly CDCReplicationConflict[] {
    return this.conflictHistory.get(taskId) ?? [];
  }

  public mergeEventsWithConflictResolution(
    taskId: string,
    localEvents: readonly CDCReplicationEvent[],
    remoteEvents: readonly CDCReplicationEvent[],
    strategy: "lww" | "merge" = "lww",
  ): CDCReplicationEvent[] {
    const merged = [...localEvents];
    for (const remoteEvent of remoteEvents) {
      const localIndex = merged.findIndex((event) =>
        event.taskId === taskId
        && event.taskId === remoteEvent.taskId
        && event.sequence === remoteEvent.sequence);
      if (localIndex === -1) {
        merged.push(remoteEvent);
        continue;
      }
      const resolved = this.resolveConflict(merged[localIndex]!, remoteEvent, strategy);
      const replacement = resolved.resolvedEvent ?? remoteEvent;
      merged.splice(localIndex, 1, replacement);
      if (resolved.conflict != null) {
        this.recordConflict(taskId, resolved.conflict);
      }
    }
    return merged.sort((left, right) => {
      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }
      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    });
  }

  public applyBatch(
    taskId: string,
    localEvents: readonly CDCReplicationEvent[],
    remoteEvents: readonly CDCReplicationEvent[],
    strategy: "lww" | "merge" = "lww",
  ): CDCReplicationEvent[] {
    return this.mergeEventsWithConflictResolution(taskId, localEvents, remoteEvents, strategy);
  }

  /**
   * Enqueue batch for async replication
   */
  private enqueueBatch(key: string, batch: CDCReplicationBatch): void {
    const queue = this.replicationQueues.get(key) ?? [];
    const maxQueueDepth = this.configs.get(key)?.maxQueueDepth ?? Number.POSITIVE_INFINITY;
    if (queue.length >= maxQueueDepth) {
      throw new CdcQueueBackpressureError(key, queue.length, maxQueueDepth);
    }
    queue.push(batch);
    this.replicationQueues.set(key, queue);
  }

  private removeBatchFromQueue(key: string, batchId: string): void {
    const queue = this.replicationQueues.get(key);
    if (queue == null) {
      return;
    }
    const nextQueue = queue.filter((batch) => batch.batchId !== batchId);
    if (nextQueue.length === 0) {
      this.replicationQueues.delete(key);
      return;
    }
    this.replicationQueues.set(key, nextQueue);
  }

  /**
   * Get config key
   */
  private getConfigKey(sourceRegionId: string, targetRegionId: string): string {
    return `${sourceRegionId}->${targetRegionId}`;
  }

  private getEventVectorClock(event: CDCReplicationEvent): VectorClock | null {
    if (event.vectorClock != null) {
      return new VectorClock(event.vectorClock);
    }
    return this.vectorClocks.get(event.taskId) ?? null;
  }

  private parsePayload(payloadJson: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
      return parsed != null && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
}

/**
 * Multi-region replication coordinator
 *
 * Manages CDC replication across multiple regions.
 */
export class MultiRegionReplicationCoordinator {
  private readonly cdcService: CDCReplicationService;
  private readonly regionConfigs = new Map<string, RegionReplicationConfig[]>();

  public constructor(cdcService?: CDCReplicationService) {
    this.cdcService = cdcService ?? new CDCReplicationService();
  }

  /**
   * Set up replication for a region with all target regions
   */
  public setupRegionReplication(
    sourceRegionId: string,
    targets: readonly { targetRegionId: string; batchSize?: number; intervalMs?: number }[],
  ): void {
    const configs: RegionReplicationConfig[] = [];

    for (const target of targets) {
      const config: RegionReplicationConfig = {
        sourceRegionId,
        targetRegionId: target.targetRegionId,
        batchSize: target.batchSize ?? 100,
        replicationIntervalMs: target.intervalMs ?? 5000,
        enabled: true,
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1000,
        },
      };

      this.cdcService.registerReplication(config);
      configs.push(config);
    }

    this.regionConfigs.set(sourceRegionId, configs);
  }

  /**
   * Get the CDC service
   */
  public getCDCService(): CDCReplicationService {
    return this.cdcService;
  }

  /**
   * Get all replications for a source region
   */
  public getRegionReplications(sourceRegionId: string): readonly RegionReplicationConfig[] {
    return this.regionConfigs.get(sourceRegionId) ?? [];
  }
}
