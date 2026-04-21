/**
 * CDC Replication Service
 *
 * Implements multi-region data synchronization using Change Data Capture (CDC).
 * Based on event store for asynchronous cross-region replication.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */
/**
 * CDC replication event types
 */
export declare const CDC_EVENT_TYPES: readonly ["cdc:replication_started", "cdc:replication_completed", "cdc:replication_failed", "cdc:checkpoint_updated"];
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
export declare class CDCReplicationService {
    private readonly checkpoints;
    private readonly configs;
    private readonly replicationQueues;
    /**
     * Register a replication configuration
     */
    registerReplication(config: RegionReplicationConfig): void;
    /**
     * Get replication configuration
     */
    getConfig(sourceRegionId: string, targetRegionId: string): RegionReplicationConfig | undefined;
    /**
     * Get current checkpoint for replication pair
     */
    getCheckpoint(sourceRegionId: string, targetRegionId: string): CDCReplicationCheckpoint | undefined;
    /**
     * Prepare a replication batch from source events
     */
    prepareBatch(sourceRegionId: string, targetRegionId: string, sourceEvents: readonly CDCReplicationEvent[]): CDCReplicationBatch | null;
    /**
     * Mark batch as replicated and update checkpoint
     */
    confirmBatch(sourceRegionId: string, targetRegionId: string, batch: CDCReplicationBatch): void;
    /**
     * Record failed replication
     */
    recordFailure(sourceRegionId: string, targetRegionId: string, batch: CDCReplicationBatch, error: string): void;
    /**
     * Get replication status for a region pair
     */
    getStatus(sourceRegionId: string, targetRegionId: string): ReplicationStatus;
    /**
     * Get all registered region pairs
     */
    getRegisteredRegionPairs(): readonly {
        sourceRegionId: string;
        targetRegionId: string;
    }[];
    /**
     * Check if replication is enabled for a region pair
     */
    isEnabled(sourceRegionId: string, targetRegionId: string): boolean;
    /**
     * Calculate replication lag (events behind)
     */
    getReplicationLag(sourceRegionId: string, targetRegionId: string, totalSourceEvents: number): number;
    /**
     * Enqueue batch for async replication
     */
    private enqueueBatch;
    /**
     * Get config key
     */
    private getConfigKey;
}
/**
 * Multi-region replication coordinator
 *
 * Manages CDC replication across multiple regions.
 */
export declare class MultiRegionReplicationCoordinator {
    private readonly cdcService;
    private readonly regionConfigs;
    constructor(cdcService?: CDCReplicationService);
    /**
     * Set up replication for a region with all target regions
     */
    setupRegionReplication(sourceRegionId: string, targets: readonly {
        targetRegionId: string;
        batchSize?: number;
        intervalMs?: number;
    }[]): void;
    /**
     * Get the CDC service
     */
    getCDCService(): CDCReplicationService;
    /**
     * Get all replications for a source region
     */
    getRegionReplications(sourceRegionId: string): readonly RegionReplicationConfig[];
}
