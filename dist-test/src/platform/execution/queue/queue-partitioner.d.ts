/**
 * @fileoverview Queue Partitioner
 *
 * Implements §8.3 "Sharding Strategy" from architecture document.
 * Partitions dispatch queues by aggregate_type for horizontal scalability.
 */
import type { QueueAdapter } from "./queue-adapter-types.js";
/**
 * Partition key extracted from job payload.
 * aggregate_type corresponds to the primary domain entity being processed.
 */
export interface PartitionKey {
    aggregateType: string;
    tenantId: string;
}
/**
 * Partition configuration for a queue.
 * Each partition operates as an independent sub-queue with its own
 * consumer group, enabling horizontal scaling.
 */
export interface QueuePartition {
    name: string;
    aggregateType: string;
    priority: number;
    consumerGroup: string;
    config: PartitionConfig;
}
export interface PartitionConfig {
    maxDepth: number;
    alertThreshold: number;
    consumerCount: number;
    partitioningStrategy: "byTenant" | "byAggregateType" | "byTenantAndAggregate";
}
/**
 * Partitions a queue into multiple sub-queues based on aggregate_type.
 *
 * Strategy (§8.3):
 * - dispatch queue: partition by tenant_id hash
 * - event outbox: partition by aggregate_type
 * - projection rebuild: parallel by projection_name
 * - worker pool: by capability_class (coding / operations / browser)
 */
export declare class QueuePartitioner {
    private partitions;
    /**
     * Register a new partition for an aggregate type.
     */
    registerPartition(partition: QueuePartition): void;
    /**
     * Get partition configuration for an aggregate type.
     */
    getPartition(aggregateType: string): QueuePartition | undefined;
    /**
     * Extract partition key from job payload.
     */
    extractPartitionKey(payload: unknown): PartitionKey;
    /**
     * Compute partition name for a job based on strategy.
     */
    computePartitionName(aggregateType: string, tenantId: string, strategy: PartitionConfig["partitioningStrategy"]): string;
    /**
     * Route a job to the appropriate partition queue.
     */
    route(adapter: QueueAdapter, payload: unknown, options?: {
        priority?: number;
        maxAttempts?: number;
    }): string;
    /**
     * Get stats for all partitions.
     */
    getPartitionStats(adapter: QueueAdapter): Map<string, import("./queue-adapter-types.js").QueueStats>;
    /**
     * Detect if any partition exceeds max depth threshold.
     */
    detectOverload(adapter: QueueAdapter): {
        aggregateType: string;
        stats: import("./queue-adapter-types.js").QueueStats;
    }[];
}
