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
import type { TypedEventPublisher } from "../../state-evidence/events/typed-event-publisher.js";
import type { TypedEventType, TypedEventPayloadMap } from "../../state-evidence/events/typed-event-bus.js";
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
export declare class CrossRegionEventReplicationService {
    private readonly publisher;
    private readonly sourceRegionId;
    private readonly config;
    private readonly pendingEvents;
    private readonly replicationQueue;
    private readonly targetRegions;
    constructor(publisher: TypedEventPublisher, sourceRegionId: string, config?: Partial<ReplicationConfig>);
    /**
     * Registers a target region for replication.
     *
     * @param target - Target region configuration
     */
    registerTargetRegion(target: ReplicationTarget): void;
    /**
     * Removes a target region from replication.
     *
     * @param regionId - Region to remove
     */
    removeTargetRegion(regionId: string): void;
    /**
     * Gets all registered target regions.
     */
    getTargetRegions(): ReplicationTarget[];
    /**
     * Replicates an event to all registered target regions.
     *
     * @param eventType - Type of the event
     * @param payload - Event payload
     * @param targetRegionIds - Specific targets (or all if empty)
     * @returns Replication plan ID
     */
    replicate<TType extends TypedEventType>(eventType: TType, payload: TypedEventPayloadMap[TType], targetRegionIds?: readonly string[]): string;
    /**
     * Gets the replication status for an event.
     *
     * @param eventId - Event ID
     * @returns Replication status or null if not found
     */
    getReplicationStatus(eventId: string): {
        status: ReplicationStatus;
        targets: ReplicatedEvent[];
    } | null;
    /**
     * Gets replication metrics.
     */
    getMetrics(): ReplicationMetrics;
    /**
     * Manually triggers replication for pending events.
     */
    triggerReplication(): void;
    /**
     * Clears completed replication records older than a timestamp.
     *
     * @param olderThan - Timestamp threshold
     * @returns Number of records cleared
     */
    pruneCompleted(olderThan: string): number;
    private processReplicationQueue;
    private executePlan;
    private replicateToTarget;
    private calculateBackoff;
}
export declare function createCrossRegionEventReplicationService(publisher: TypedEventPublisher, sourceRegionId: string, config?: Partial<ReplicationConfig>): CrossRegionEventReplicationService;
