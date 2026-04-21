/**
 * @fileoverview Queue Partitioner
 *
 * Implements §8.3 "分片策略" from architecture document.
 * Partitions dispatch queues by aggregate_type for horizontal scalability.
 */
/**
 * Partitions a queue into multiple sub-queues based on aggregate_type.
 *
 * Strategy (§8.3):
 * - dispatch queue: partition by tenant_id hash
 * - event outbox: partition by aggregate_type
 * - projection rebuild: parallel by projection_name
 * - worker pool: by capability_class (coding / operations / browser)
 */
export class QueuePartitioner {
    partitions = new Map();
    /**
     * Register a new partition for an aggregate type.
     */
    registerPartition(partition) {
        this.partitions.set(partition.aggregateType, partition);
    }
    /**
     * Get partition configuration for an aggregate type.
     */
    getPartition(aggregateType) {
        return this.partitions.get(aggregateType);
    }
    /**
     * Extract partition key from job payload.
     */
    extractPartitionKey(payload) {
        const p = payload;
        return {
            aggregateType: String(p.aggregateType ?? p.domain ?? "default"),
            tenantId: String(p.tenantId ?? p.tenant_id ?? "default"),
        };
    }
    /**
     * Compute partition name for a job based on strategy.
     */
    computePartitionName(aggregateType, tenantId, strategy) {
        switch (strategy) {
            case "byTenant":
                return `queue:${tenantId}`;
            case "byAggregateType":
                return `queue:${aggregateType}`;
            case "byTenantAndAggregate":
                return `queue:${tenantId}:${aggregateType}`;
            default:
                return `queue:${aggregateType}`;
        }
    }
    /**
     * Route a job to the appropriate partition queue.
     */
    route(adapter, payload, options) {
        const key = this.extractPartitionKey(payload);
        const partition = this.getPartition(key.aggregateType);
        const strategy = partition?.config.partitioningStrategy ?? "byAggregateType";
        const queueName = this.computePartitionName(key.aggregateType, key.tenantId, strategy);
        const input = {
            queueName,
            payload,
            ...(options?.priority !== undefined ? { priority: options.priority } : {}),
            ...(options?.maxAttempts !== undefined ? { maxAttempts: options.maxAttempts } : {}),
        };
        const job = adapter.enqueue(input);
        return job.id;
    }
    /**
     * Get stats for all partitions.
     */
    getPartitionStats(adapter) {
        const stats = new Map();
        for (const [aggregateType, partition] of this.partitions) {
            stats.set(aggregateType, adapter.stats(partition.name));
        }
        return stats;
    }
    /**
     * Detect if any partition exceeds max depth threshold.
     */
    detectOverload(adapter) {
        const overloads = [];
        for (const [aggregateType, partition] of this.partitions) {
            const stats = adapter.stats(partition.name);
            if (stats.waiting + stats.delayed > partition.config.maxDepth) {
                overloads.push({ aggregateType, stats });
            }
        }
        return overloads;
    }
}
//# sourceMappingURL=queue-partitioner.js.map