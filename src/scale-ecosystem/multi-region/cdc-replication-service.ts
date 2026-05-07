/**
 * CDC Replication Service
 *
 * Implements multi-region data synchronization using Change Data Capture (CDC).
 * Based on event store for asynchronous cross-region replication.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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
  readonly lastEventTime: string; // ISO timestamp of last replicated event for time-based lag
  readonly processedAt: string;
}

/**
 * CDC replication event - extends EventRecord with sequence for ordering
 */
export interface CDCReplicationEvent {
  readonly id: string;
  readonly sequence: number;
  readonly epoch?: number;
  readonly sourceRegionId?: string;
  readonly vectorClock?: Readonly<Record<string, number>>;
  readonly eventType: string;
  readonly taskId: string;
  readonly payloadJson: string;
  readonly createdAt: string;
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
 * Vector clock entry for tracking causal ordering across regions
 */
export interface VectorClockEntry {
  readonly regionId: string;
  readonly sequence: number;
  readonly timestamp: string;
}

/**
 * Vector clock for conflict detection - tracks per-region sequence numbers
 */
export class VectorClock {
  private readonly clock = new Map<string, number>();

  constructor(initialClock?: ReadonlyMap<string, number>) {
    if (initialClock) {
      for (const [regionId, seq] of initialClock) {
        this.clock.set(regionId, seq);
      }
    }
  }

  /**
   * Increment the clock for a region
   */
  public increment(regionId: string): VectorClock {
    const newClock = new Map(this.clock);
    newClock.set(regionId, (newClock.get(regionId) ?? 0) + 1);
    return new VectorClock(newClock);
  }

  /**
   * Set a region sequence explicitly, keeping the maximum observed sequence.
   */
  public withRegionSequence(regionId: string, sequence: number): VectorClock {
    const newClock = new Map(this.clock);
    newClock.set(regionId, Math.max(newClock.get(regionId) ?? 0, sequence));
    return new VectorClock(newClock);
  }

  /**
   * Merge another vector clock into this one (takes max of each component)
   */
  public merge(other: VectorClock): VectorClock {
    const newClock = new Map(this.clock);
    for (const [regionId, seq] of other.clock) {
      newClock.set(regionId, Math.max(newClock.get(regionId) ?? 0, seq));
    }
    return new VectorClock(newClock);
  }

  /**
   * Compare two vector clocks
   * @returns -1 if this < other, 1 if this > other, 0 if concurrent
   */
  public compare(other: VectorClock): -1 | 0 | 1 {
    let thisGreater = false;
    let otherGreater = false;

    const allRegions = new Set([...this.clock.keys(), ...other.clock.keys()]);

    for (const regionId of allRegions) {
      const thisSeq = this.clock.get(regionId) ?? 0;
      const otherSeq = other.clock.get(regionId) ?? 0;

      if (thisSeq > otherSeq) {
        thisGreater = true;
      } else if (thisSeq < otherSeq) {
        otherGreater = true;
      }
    }

    if (thisGreater && !otherGreater) return 1;
    if (!thisGreater && otherGreater) return -1;
    return 0; // concurrent (neither dominates)
  }

  /**
   * Check if this clock happened-before or is equal to another
   */
  public happensBeforeOrEqual(other: VectorClock): boolean {
    return this.compare(other) <= 0;
  }

  /**
   * Get current clock as map
   */
  public toMap(): ReadonlyMap<string, number> {
    return new Map(this.clock);
  }

  public toRecord(): Readonly<Record<string, number>> {
    const record: Record<string, number> = {};
    for (const [regionId, sequence] of this.clock) {
      record[regionId] = sequence;
    }
    return record;
  }

  /**
   * Get the maximum sequence across all regions
   */
  public getMaxSequence(): number {
    let max = 0;
    for (const seq of this.clock.values()) {
      if (seq > max) max = seq;
    }
    return max;
  }

  public static fromRecord(record?: Readonly<Record<string, number>> | null): VectorClock {
    const next = new Map<string, number>();
    for (const [regionId, sequence] of Object.entries(record ?? {})) {
      next.set(regionId, sequence);
    }
    return new VectorClock(next);
  }
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy = "lww" | "merge" | "abort";

/**
 * Conflict metadata for debugging/auditing
 */
export interface ConflictInfo {
  readonly localEvent: CDCReplicationEvent;
  readonly remoteEvent: CDCReplicationEvent;
  readonly resolution: "local_wins" | "remote_wins" | "merged" | "aborted";
  readonly localVectorClock: VectorClock;
  readonly remoteVectorClock: VectorClock;
  readonly conflictType: "concurrent" | "causal_before" | "causal_after";
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  readonly resolved: boolean;
  readonly resolvedEvent: CDCReplicationEvent | null;
  readonly conflict: ConflictInfo | null;
  readonly strategy: ConflictResolutionStrategy;
}

/**
 * Conflict resolution configuration
 */
export interface ConflictResolutionConfig {
  readonly defaultStrategy: ConflictResolutionStrategy;
  readonly timestampToleranceMs: number;
  readonly enableVectorClock: boolean;
  readonly enableLWW: boolean;
  readonly maxMergeAttempts: number;
}

/**
 * Region replication configuration
 */
export interface RegionReplicationConfig {
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly batchSize: number;
  readonly replicationIntervalMs: number;
  readonly enabled: boolean;
  readonly retryPolicy: {
    readonly maxRetries: number;
    readonly backoffMs: number;
  };
}

/**
 * Lag alert payload for monitoring
 */
export interface LagAlert {
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly lagMs: number;
  readonly severity: "warning" | "critical";
  readonly timestamp: string;
}

export interface CDCReplicationServiceOptions {
  readonly stateFilePath?: string | null;
}

interface CDCReplicationPersistedState {
  readonly checkpoints: readonly CDCReplicationCheckpoint[];
  readonly replicationQueues: readonly {
    readonly key: string;
    readonly batches: readonly CDCReplicationBatch[];
  }[];
}

/**
 * CDC replication service for multi-region data sync
 */
export class CDCReplicationService {
  private readonly checkpoints = new Map<string, CDCReplicationCheckpoint>();
  private readonly configs = new Map<string, RegionReplicationConfig>();
  private readonly replicationQueues = new Map<string, CDCReplicationBatch[]>();
  private readonly stateFilePath: string | null;
  private readonly vectorClocks = new Map<string, VectorClock>();
  private readonly entityEpochs = new Map<string, number>();
  private readonly conflictHistory = new Map<string, ConflictInfo[]>();
  private readonly conflictConfig: ConflictResolutionConfig = {
    defaultStrategy: "lww",
    timestampToleranceMs: 1000,
    enableVectorClock: true,
    enableLWW: true,
    maxMergeAttempts: 3,
  };
  private readonly lagHistory = new Map<string, number[]>();
  private readonly maxLagHistorySize = 100;

  /**
   * RPO/RTO configuration for timing enforcement
   * RPO < 1min: max acceptable replication lag is 60s
   * RTO < 30s: max time to complete failover is 30s
   */
  private readonly rpoConfig = {
    maxLagMs: 60000,           // RPO < 1 min
    lagAlertThreshold: 30000,   // Alert at 30s lag
    lagCriticalThreshold: 50000, // Critical at 50s lag
  };

  private readonly rtoConfig = {
    failoverTimeoutMs: 30000,   // RTO < 30s
    healthCheckIntervalMs: 5000,
    maxFailoverDurationMs: 30000,
  };

  private failoverStartTime: Map<string, number> = new Map();
  private readonly lagAlertListeners = new Set<(alert: LagAlert) => void>();

  public constructor(options: CDCReplicationServiceOptions = {}) {
    this.stateFilePath = options.stateFilePath == null ? null : resolve(options.stateFilePath);
    this.loadPersistedState();
  }

  /**
   * Register a listener for lag alerts (RPO breaches)
   */
  public addLagAlertListener(listener: (alert: LagAlert) => void): void {
    this.lagAlertListeners.add(listener);
  }

  /**
   * Remove a lag alert listener
   */
  public removeLagAlertListener(listener: (alert: LagAlert) => void): void {
    this.lagAlertListeners.delete(listener);
  }

  /**
   * Monitor replication lag and emit alerts if RPO threshold exceeded.
   * Returns lag status and emits alerts via registered listeners if thresholds crossed.
   */
  public monitorReplicationLag(
    sourceRegionId: string,
    targetRegionId: string,
    totalSourceEvents: number,
  ): { lagMs: number; rpoBreached: boolean; severity: "ok" | "warning" | "critical" } {
    const checkpoint = this.getCheckpoint(sourceRegionId, targetRegionId);
    if (!checkpoint) {
      return { lagMs: totalSourceEvents * 100, rpoBreached: totalSourceEvents > 0, severity: "critical" };
    }

    const lagMs = Math.max(0, (totalSourceEvents - checkpoint.lastEventSequence) * 100);
    let severity: "ok" | "warning" | "critical" = "ok";

    if (lagMs >= this.rpoConfig.lagCriticalThreshold) {
      severity = "critical";
    } else if (lagMs >= this.rpoConfig.lagAlertThreshold) {
      severity = "warning";
    }

    const rpoBreached = lagMs > this.rpoConfig.maxLagMs;

    // Record lag in history for trend analysis
    this.recordLagHistory(sourceRegionId, targetRegionId, lagMs);

    // Emit alert if lag exceeds warning threshold
    if (severity !== "ok") {
      const alert: LagAlert = {
        sourceRegionId,
        targetRegionId,
        lagMs,
        severity: severity === "critical" ? "critical" : "warning",
        timestamp: nowIso(),
      };

      for (const listener of this.lagAlertListeners) {
        try {
          listener(alert);
        } catch {
          // Swallow listener errors to prevent cascading failures
        }
      }
    }

    return { lagMs, rpoBreached, severity };
  }

  private recordLagHistory(sourceRegionId: string, targetRegionId: string, lagMs: number): void {
    const key = `${sourceRegionId}->${targetRegionId}`;
    const history = this.lagHistory.get(key) ?? [];
    history.push(lagMs);
    if (history.length > this.maxLagHistorySize) {
      history.shift();
    }
    this.lagHistory.set(key, history);
  }

  /**
   * Get lag history for a region pair (for trend analysis)
   */
  public getLagHistory(sourceRegionId: string, targetRegionId: string): readonly number[] {
    return this.lagHistory.get(`${sourceRegionId}->${targetRegionId}`) ?? [];
  }

  /**
   * Start failover timer tracking for RTO enforcement
   */
  public startFailoverTimer(sourceRegionId: string): void {
    this.failoverStartTime.set(sourceRegionId, Date.now());
  }

  /**
   * Check if failover has exceeded RTO timeout
   */
  public checkFailoverTimeout(sourceRegionId: string): boolean {
    const startTime = this.failoverStartTime.get(sourceRegionId);
    if (startTime == null) return false;
    return Date.now() - startTime > this.rtoConfig.failoverTimeoutMs;
  }

  /**
   * Clear failover timer after failover completes
   */
  public clearFailoverTimer(sourceRegionId: string): void {
    this.failoverStartTime.delete(sourceRegionId);
  }

  /**
   * Get current RPO/RTO configuration
   */
  public getRpoConfig(): Readonly<{ maxLagMs: number; lagAlertThreshold: number; lagCriticalThreshold: number }> {
    return { ...this.rpoConfig };
  }

  /**
   * Get current RTO configuration
   */
  public getRtoConfig(): Readonly<{ failoverTimeoutMs: number; maxFailoverDurationMs: number }> {
    return { failoverTimeoutMs: this.rtoConfig.failoverTimeoutMs, maxFailoverDurationMs: this.rtoConfig.maxFailoverDurationMs };
  }

  /**
   * Get vector clock key for entity across regions
   */
  private getVectorClockKey(entityId: string, regionId: string): string {
    return `${entityId}::${regionId}`;
  }

  /**
   * Get or create vector clock for an entity
   */
  public getVectorClock(entityId: string): VectorClock | undefined {
    return this.vectorClocks.get(entityId);
  }

  /**
   * Update vector clock for an entity after local event
   */
  public updateVectorClock(entityId: string, regionId: string, sequence: number): VectorClock {
    const existing = this.vectorClocks.get(entityId) ?? new VectorClock();
    const updated = existing.withRegionSequence(regionId, sequence);
    this.vectorClocks.set(entityId, updated);
    return updated;
  }

  /**
   * Merge remote vector clock into local for an entity
   */
  public mergeVectorClock(entityId: string, remoteClock: VectorClock): VectorClock {
    const existing = this.vectorClocks.get(entityId) ?? new VectorClock();
    const merged = existing.merge(remoteClock);
    this.vectorClocks.set(entityId, merged);
    return merged;
  }

  /**
   * Resolve conflict between local and remote events using LWW
   * Returns the winning event based on timestamp (Last Writer Wins)
   */
  public resolveConflictLWW(
    localEvent: CDCReplicationEvent,
    remoteEvent: CDCReplicationEvent,
  ): ConflictResolutionResult {
    const localTime = new Date(localEvent.createdAt).getTime();
    const remoteTime = new Date(remoteEvent.createdAt).getTime();

    // LWW: later timestamp wins
    if (remoteTime > localTime) {
      return {
        resolved: true,
        resolvedEvent: remoteEvent,
        conflict: {
          localEvent,
          remoteEvent,
          resolution: "remote_wins",
          localVectorClock: this.getEventVectorClock(localEvent),
          remoteVectorClock: this.getEventVectorClock(remoteEvent),
          conflictType: this.getConflictType(localEvent, remoteEvent),
        },
        strategy: "lww",
      };
    }
    return {
      resolved: true,
      resolvedEvent: localEvent,
      conflict: {
        localEvent,
        remoteEvent,
        resolution: "local_wins",
        localVectorClock: this.getEventVectorClock(localEvent),
        remoteVectorClock: this.getEventVectorClock(remoteEvent),
        conflictType: this.getConflictType(localEvent, remoteEvent),
      },
      strategy: "lww",
    };
  }

  /**
   * Detect if two events are in conflict (concurrent updates)
   */
  public detectConflict(localEvent: CDCReplicationEvent, remoteEvent: CDCReplicationEvent): boolean {
    if (localEvent.taskId !== remoteEvent.taskId) {
      return false;
    }
    const localClock = this.getEventVectorClock(localEvent);
    const remoteClock = this.getEventVectorClock(remoteEvent);
    const concurrent = localClock.compare(remoteClock) === 0;
    const sameLogicalPosition = localEvent.sequence === remoteEvent.sequence;
    const payloadDiffers = localEvent.id !== remoteEvent.id || localEvent.payloadJson !== remoteEvent.payloadJson;
    return concurrent && sameLogicalPosition && payloadDiffers;
  }

  /**
   * Resolve conflict using merge strategy - combines both updates
   * For simple payload merge, we use remote as base and apply local delta
   */
  public resolveConflictMerge(
    localEvent: CDCReplicationEvent,
    remoteEvent: CDCReplicationEvent,
  ): ConflictResolutionResult {
    // Merge by taking the later event but preserving metadata from both
    const localTime = new Date(localEvent.createdAt).getTime();
    const remoteTime = new Date(remoteEvent.createdAt).getTime();

    const winningEvent = remoteTime >= localTime ? remoteEvent : localEvent;
    const losingEvent = remoteTime >= localTime ? localEvent : remoteEvent;

    return {
      resolved: true,
      resolvedEvent: {
        ...winningEvent,
        payloadJson: this.mergePayload(winningEvent.payloadJson, losingEvent.payloadJson),
      },
      conflict: {
        localEvent,
        remoteEvent,
        resolution: "merged",
        localVectorClock: this.getEventVectorClock(localEvent),
        remoteVectorClock: this.getEventVectorClock(remoteEvent),
        conflictType: this.getConflictType(localEvent, remoteEvent),
      },
      strategy: "merge",
    };
  }

  /**
   * Merge two payload JSON strings (simple field-level merge)
   */
  private mergePayload(baseJson: string, deltaJson: string): string {
    try {
      const base = JSON.parse(baseJson);
      const delta = JSON.parse(deltaJson);
      const merged = { ...base, ...delta, _merged: true, _mergedAt: nowIso() };
      return JSON.stringify(merged);
    } catch {
      // If parsing fails, return base
      return baseJson;
    }
  }

  /**
   * Resolve conflict with configured strategy
   * R21-01: When vector clocks diverge (concurrent), use VectorClock.merge() to combine
   * instead of simple LWW which loses concurrent updates.
   */
  public resolveConflict(
    localEvent: CDCReplicationEvent,
    remoteEvent: CDCReplicationEvent,
    strategy?: ConflictResolutionStrategy,
  ): ConflictResolutionResult {
    const resolvedStrategy = strategy ?? this.conflictConfig.defaultStrategy;

    switch (resolvedStrategy) {
      case "lww":
        // R21-01: Check if vector clocks are divergent (concurrent)
        // If divergent, use merge() instead of simple LWW to preserve both updates
        if (this.conflictConfig.enableVectorClock) {
          const localClock = this.getVectorClock(localEvent.taskId) ?? new VectorClock();
          const remoteClock = this.getVectorClock(remoteEvent.taskId) ?? new VectorClock();
          const comparison = localClock.compare(remoteClock);

          // If concurrent (neither happens-before), merge instead of LWW
          if (comparison === 0 && localEvent.sequence !== remoteEvent.sequence) {
            return this.resolveConflictMerge(localEvent, remoteEvent);
          }
        }
        return this.resolveConflictLWW(localEvent, remoteEvent);
      case "merge":
        return this.resolveConflictMerge(localEvent, remoteEvent);
      case "abort":
        return {
          resolved: false,
          resolvedEvent: null,
          conflict: {
            localEvent,
            remoteEvent,
            resolution: "aborted",
            localVectorClock: this.getEventVectorClock(localEvent),
            remoteVectorClock: this.getEventVectorClock(remoteEvent),
            conflictType: this.getConflictType(localEvent, remoteEvent),
          },
          strategy: "abort",
        };
    }
  }

  /**
   * Record conflict for auditing
   */
  public recordConflict(entityId: string, conflict: ConflictInfo): void {
    const history = this.conflictHistory.get(entityId) ?? [];
    history.push(conflict);
    // Keep last 100 conflicts per entity
    if (history.length > 100) {
      history.shift();
    }
    this.conflictHistory.set(entityId, history);
  }

  /**
   * Get conflict history for an entity
   */
  public getConflictHistory(entityId: string): readonly ConflictInfo[] {
    return this.conflictHistory.get(entityId) ?? [];
  }

  /**
   * Merge incoming remote events with local state using conflict resolution
   * and update vector clock state to reflect resolved causal ordering.
   */
  public mergeEventsWithConflictResolution(
    entityId: string,
    localEvents: readonly CDCReplicationEvent[],
    remoteEvents: readonly CDCReplicationEvent[],
    strategy?: ConflictResolutionStrategy,
  ): CDCReplicationEvent[] {
    // Update local vector clock from local events first
    for (const event of localEvents) {
      this.mergeVectorClock(entityId, this.getEventVectorClock(event));
    }

    const result: CDCReplicationEvent[] = [...localEvents];

    for (const remoteEvent of remoteEvents) {
      const remoteClock = this.getEventVectorClock(remoteEvent);
      this.mergeVectorClock(entityId, remoteClock);

      const existingLocal = localEvents.find(
        (e) => e.sequence === remoteEvent.sequence && e.taskId === remoteEvent.taskId,
      );

      if (!existingLocal) {
        // No conflict - just add
        result.push(remoteEvent);
      } else {
        const localClock = this.getEventVectorClock(existingLocal);
        const ordering = localClock.compare(remoteClock);

        if (ordering === -1) {
          const idx = result.findIndex(
            (e) => e.sequence === existingLocal.sequence && e.taskId === existingLocal.taskId,
          );
          if (idx >= 0) {
            result[idx] = remoteEvent;
          }
          this.mergeVectorClock(entityId, remoteClock);
          continue;
        }

        if (ordering === 1) {
          continue;
        }

        // Conflict detected - resolve using configured strategy
        const conflictResult = this.resolveConflict(existingLocal, remoteEvent, strategy);
        if (conflictResult.resolved && conflictResult.resolvedEvent) {
          const idx = result.findIndex(
            (e) => e.sequence === conflictResult.conflict!.localEvent.sequence &&
                   e.taskId === conflictResult.conflict!.localEvent.taskId,
          );
          if (idx >= 0) {
            result[idx] = conflictResult.resolvedEvent;
          }
          this.mergeVectorClock(entityId, this.getEventVectorClock(conflictResult.resolvedEvent));
        }
        // Record the conflict for auditing
        if (conflictResult.conflict) {
          this.recordConflict(entityId, conflictResult.conflict);
        }
      }
    }

    return result;
  }

  private getEventVectorClock(event: CDCReplicationEvent): VectorClock {
    if (event.vectorClock != null) {
      return VectorClock.fromRecord(event.vectorClock);
    }
    if (event.sourceRegionId != null) {
      return new VectorClock().withRegionSequence(event.sourceRegionId, event.sequence);
    }
    return this.getVectorClock(event.taskId) ?? new VectorClock();
  }

  private getConflictType(
    localEvent: CDCReplicationEvent,
    remoteEvent: CDCReplicationEvent,
  ): ConflictInfo["conflictType"] {
    const ordering = this.getEventVectorClock(localEvent).compare(this.getEventVectorClock(remoteEvent));
    if (ordering === -1) {
      return "causal_before";
    }
    if (ordering === 1) {
      return "causal_after";
    }
    return "concurrent";
  }

  /**
   * §R8-33: Apply a batch of remote events with conflict resolution and epoch validation.
   * Ensures conflict resolution is called before applying events.
   * Rejects writes if incoming event epoch < local epoch (stale event).
   *
   * @param entityId - Entity ID for the events
   * @param localEvents - Current local events
   * @param remoteEvents - Remote events to apply
   * @param strategy - Conflict resolution strategy
   * @param localEpoch - Current local epoch for fence validation
   * @returns Events after applying conflict resolution
   */
  public applyBatch(
    entityId: string,
    localEvents: readonly CDCReplicationEvent[],
    remoteEvents: readonly CDCReplicationEvent[],
    strategy?: ConflictResolutionStrategy,
    localEpoch?: number,
  ): CDCReplicationEvent[] {
    // §R8-33: Reject events with stale epoch (incoming epoch < local epoch)
    // This enforces single-leader ordering: only events from the current leader epoch
    // should be accepted. Events from an older epoch are stale and must be rejected.
    const currentEpoch = localEpoch ?? this.getCurrentEpochForEntity(entityId);

    const filteredRemoteEvents: CDCReplicationEvent[] = [];

    for (const remoteEvent of remoteEvents) {
      // §R8-33: If incoming event epoch < local epoch, reject the write (stale event)
      // Events without an epoch are considered legacy and always accepted (backwards compatible)
      const remoteEpoch = remoteEvent.epoch ?? Number.MAX_SAFE_INTEGER;
      if (remoteEpoch < currentEpoch) {
        cdcLogger.warn(`§R8-33: Rejected stale event ${remoteEvent.id} with epoch ${remoteEpoch} < local epoch ${currentEpoch}`, {
          data: { entityId, eventId: remoteEvent.id, remoteEpoch, localEpoch: currentEpoch },
        });
        continue;
      }
      filteredRemoteEvents.push(remoteEvent);
    }

    // If all events were filtered out as stale, return just local events
    if (filteredRemoteEvents.length === 0) {
      return [...localEvents];
    }

    // §R8-33: Call conflict resolution before applying events
    // Use mergeEventsWithConflictResolution which internally calls conflict resolution
    return this.mergeEventsWithConflictResolution(entityId, localEvents, filteredRemoteEvents, strategy);
  }

  /**
   * Get current epoch for an entity (tracks the highest epoch seen)
   */
  private getCurrentEpochForEntity(entityId: string): number {
    // Track per-entity epoch based on events received
    return this.entityEpochs.get(entityId) ?? 0;
  }

  /**
   * §R8-33: Validate that the leader holds a valid fencing token before allowing writes.
   * This is called by truth/budget/side-effect write operations.
   *
   * @param entityId - Entity ID for the write
   * @param leaderFencingToken - Fencing token from the current leader
   * @returns Validation result with rejection reason if token is invalid
   */
  public validateLeaderFencingToken(
    entityId: string,
    leaderFencingToken: { epoch: number; regionId: string },
  ): { valid: boolean; reason: string | null } {
    const currentEpoch = this.getCurrentEpochForEntity(entityId);

    // If we don't have an epoch tracked yet, allow the write (leader is establishing initial epoch)
    if (currentEpoch === 0) {
      return { valid: true, reason: null };
    }

    // Leader must have epoch >= current local epoch
    // If leader's epoch is less than our current epoch, they are stale
    if (leaderFencingToken.epoch < currentEpoch) {
      cdcLogger.warn(`§R8-32: Rejected write from stale leader ${leaderFencingToken.regionId} with epoch ${leaderFencingToken.epoch} < local epoch ${currentEpoch}`, {
        data: { entityId, leaderRegionId: leaderFencingToken.regionId, leaderEpoch: leaderFencingToken.epoch, localEpoch: currentEpoch },
      });
      return {
        valid: false,
        reason: `stale_leader_epoch: leader epoch ${leaderFencingToken.epoch} < local epoch ${currentEpoch}`,
      };
    }

    return { valid: true, reason: null };
  }

  /**
   * §R8-32: Record a new epoch for an entity (called when leader advances epoch).
   * This establishes the fencing token epoch for subsequent writes.
   *
   * @param entityId - Entity ID
   * @param epoch - New epoch number
   * @param regionId - Region that owns this epoch
   */
  public recordEntityEpoch(entityId: string, epoch: number, regionId: string): void {
    const currentEpoch = this.getCurrentEpochForEntity(entityId);
    if (epoch > currentEpoch) {
      this.entityEpochs.set(entityId, epoch);
      cdcLogger.info(`§R8-32: Recorded new epoch for entity ${entityId}: ${epoch} from region ${regionId}`, {
        data: { entityId, epoch, regionId },
      });
    }
  }

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
        lastEventTime: nowIso(),
        processedAt: nowIso(),
      });
    }
    if (!this.replicationQueues.has(key)) {
      this.replicationQueues.set(key, []);
    }
    this.persistState();
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
    const queue = this.replicationQueues.get(key) ?? [];

    if (!checkpoint) {
      return null;
    }

    const config = this.configs.get(key);
    const batchSize = config?.batchSize ?? 100;

    const highestQueuedSequence = queue.reduce(
      (maxSequence, batch) => Math.max(maxSequence, batch.endSequence),
      checkpoint.lastEventSequence,
    );

    // Filter events after the latest durable checkpoint or already-queued batch.
    const eventsToReplicate = sourceEvents.filter(
      (event) => event.sequence > highestQueuedSequence,
    );

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

    // Queue batch for async replication
    this.enqueueBatch(key, batch);

    return batch;
  }

  /**
   * Mark batch as replicated and update checkpoint
   * §187-2196: Fixed memory leak - confirmed batches must be dequeued
   * Previously only updated checkpoint without removing batch from queue,
   * causing unbounded memory growth (OOM). Now properly drains confirmed batch.
   */
  public confirmBatch(
    sourceRegionId: string,
    targetRegionId: string,
    batch: CDCReplicationBatch,
  ): void {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);

    const lastEvent = batch.events[batch.events.length - 1];
    // Capture the last event's timestamp for time-based lag calculation
    const lastEventTime = lastEvent?.createdAt ?? nowIso();
    const checkpoint: CDCReplicationCheckpoint = {
      checkpointId: this.checkpoints.get(key)?.checkpointId ?? newId("cdc_checkpoint"),
      sourceRegionId,
      targetRegionId,
      lastEventId: lastEvent?.id ?? null,
      lastEventSequence: batch.endSequence,
      lastEventTime,
      processedAt: nowIso(),
    };

    this.checkpoints.set(key, checkpoint);

    // §187-2196: Dequeue confirmed batch to prevent memory leak
    // Without this, queue grows unbounded causing OOM
    this.dequeueBatch(key, batch.batchId);
    this.persistState();
  }

  /**
   * Remove batch from queue after successful confirmation
   */
  private dequeueBatch(key: string, batchId: string): void {
    const queue = this.replicationQueues.get(key);
    if (!queue) return;
    const index = queue.findIndex((b) => b.batchId === batchId);
    if (index !== -1) {
      queue.splice(index, 1);
      this.persistState();
    }
  }

  /**
   * Record failed replication
   * Root cause: Only logs failure without retry - batch is silently dropped
   * Fix: Enqueue failed batch for retry instead of just logging
   */
  public recordFailure(
    sourceRegionId: string,
    targetRegionId: string,
    batch: CDCReplicationBatch,
    error: string,
  ): void {
    const key = this.getConfigKey(sourceRegionId, targetRegionId);
    cdcLogger.error(`CDC replication failed for ${key}: ${error}`, {
      data: { sourceRegionId, targetRegionId, batchId: batch.batchId },
    });
    this.requeueBatch(key, batch);
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
   * Calculate replication lag in milliseconds based on time since last replicated event.
   * This replaces the previous event-count based calculation with true time-based lag.
   */
  public getReplicationLag(
    sourceRegionId: string,
    targetRegionId: string,
    _totalSourceEvents?: number,
  ): number {
    const checkpoint = this.getCheckpoint(sourceRegionId, targetRegionId);
    if (!checkpoint || !checkpoint.lastEventTime) {
      // No checkpoint or no event timestamp yet - return 0 (no lag measurable)
      return 0;
    }

    const lastEventMs = new Date(checkpoint.lastEventTime).getTime();
    const nowMs = Date.now();
    const lagMs = nowMs - lastEventMs;

    // Lag should never be negative - if clock skew causes negative, return 0
    return Math.max(0, lagMs);
  }

  /**
   * Enqueue batch for async replication
   */
  private enqueueBatch(key: string, batch: CDCReplicationBatch): void {
    const queue = this.replicationQueues.get(key) ?? [];
    if (!queue.some((existing) => existing.batchId === batch.batchId)) {
      queue.push(batch);
    }
    this.replicationQueues.set(key, queue);
    this.persistState();
  }

  private requeueBatch(key: string, batch: CDCReplicationBatch): void {
    const queue = this.replicationQueues.get(key) ?? [];
    const existingIndex = queue.findIndex((item) => item.batchId === batch.batchId);
    if (existingIndex >= 0) {
      const [existing] = queue.splice(existingIndex, 1);
      queue.push(existing ?? batch);
    } else {
      queue.push(batch);
    }
    this.replicationQueues.set(key, queue);
    this.persistState();
  }

  /**
   * Get config key
   */
  private getConfigKey(sourceRegionId: string, targetRegionId: string): string {
    return `${sourceRegionId}->${targetRegionId}`;
  }

  private loadPersistedState(): void {
    if (this.stateFilePath == null || !existsSync(this.stateFilePath)) {
      return;
    }

    try {
      const raw = readFileSync(this.stateFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CDCReplicationPersistedState>;
      for (const checkpoint of parsed.checkpoints ?? []) {
        const key = this.getConfigKey(checkpoint.sourceRegionId, checkpoint.targetRegionId);
        this.checkpoints.set(key, checkpoint);
      }
      for (const queueEntry of parsed.replicationQueues ?? []) {
        this.replicationQueues.set(queueEntry.key, [...queueEntry.batches]);
      }
    } catch (error) {
      cdcLogger.error("Failed to load CDC replication state", {
        data: {
          stateFilePath: this.stateFilePath,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private persistState(): void {
    if (this.stateFilePath == null) {
      return;
    }

    const state: CDCReplicationPersistedState = {
      checkpoints: [...this.checkpoints.values()],
      replicationQueues: [...this.replicationQueues.entries()].map(([key, batches]) => ({
        key,
        batches,
      })),
    };

    mkdirSync(dirname(this.stateFilePath), { recursive: true });
    writeFileSync(this.stateFilePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
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
    this.cdcService = cdcService ?? new CDCReplicationService({
      stateFilePath: "data/runtime/multi-region/cdc-replication-state.json",
    });
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
