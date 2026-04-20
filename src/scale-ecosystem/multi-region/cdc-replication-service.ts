/**
 * CDC Replication Service
 *
 * Implements multi-region data synchronization using Change Data Capture (CDC).
 * Based on event store for asynchronous cross-region replication.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

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
  readonly replicationIntervalMs: number;
  readonly enabled: boolean;
  readonly retryPolicy: {
    readonly maxRetries: number;
    readonly backoffMs: number;
  };
}

/**
 * CDC replication service for multi-region data sync
 */
export class CDCReplicationService {
  private readonly checkpoints = new Map<string, CDCReplicationCheckpoint>();
  private readonly configs = new Map<string, RegionReplicationConfig>();
  private readonly replicationQueues = new Map<string, CDCReplicationBatch[]>();

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

    // Filter events after checkpoint
    const eventsToReplicate = sourceEvents.filter(
      (event) => event.sequence > checkpoint.lastEventSequence,
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
    console.error(`CDC replication failed for ${key}: ${error}`);
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
   * Calculate replication lag (events behind)
   */
  public getReplicationLag(
    sourceRegionId: string,
    targetRegionId: string,
    totalSourceEvents: number,
  ): number {
    const checkpoint = this.getCheckpoint(sourceRegionId, targetRegionId);
    if (!checkpoint) {
      return totalSourceEvents;
    }
    return Math.max(0, totalSourceEvents - checkpoint.lastEventSequence);
  }

  /**
   * Enqueue batch for async replication
   */
  private enqueueBatch(key: string, batch: CDCReplicationBatch): void {
    const queue = this.replicationQueues.get(key) ?? [];
    queue.push(batch);
    this.replicationQueues.set(key, queue);
  }

  /**
   * Get config key
   */
  private getConfigKey(sourceRegionId: string, targetRegionId: string): string {
    return `${sourceRegionId}->${targetRegionId}`;
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
