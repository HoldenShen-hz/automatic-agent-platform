/**
 * @fileoverview Queue Partitioner
 *
 * Implements §8.3 "分片策略" from architecture document.
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
export class QueuePartitioner {
  private partitions: Map<string, QueuePartition> = new Map();

  /**
   * Register a new partition for an aggregate type.
   */
  registerPartition(partition: QueuePartition): void {
    this.partitions.set(partition.aggregateType, partition);
  }

  /**
   * Get partition configuration for an aggregate type.
   */
  getPartition(aggregateType: string): QueuePartition | undefined {
    return this.partitions.get(aggregateType);
  }

  /**
   * Extract partition key from job payload.
   */
  extractPartitionKey(payload: unknown): PartitionKey {
    const p = payload as Record<string, unknown>;
    return {
      aggregateType: String(p.aggregateType ?? p.domain ?? "default"),
      tenantId: String(p.tenantId ?? p.tenant_id ?? "default"),
    };
  }

  /**
   * Compute partition name for a job based on strategy.
   */
  computePartitionName(
    aggregateType: string,
    tenantId: string,
    strategy: PartitionConfig["partitioningStrategy"],
  ): string {
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
  route(adapter: QueueAdapter, payload: unknown, options?: { priority?: number; maxAttempts?: number }): string {
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
  getPartitionStats(adapter: QueueAdapter): Map<string, import("./queue-adapter-types.js").QueueStats> {
    const stats = new Map<string, import("./queue-adapter-types.js").QueueStats>();
    for (const [aggregateType, partition] of this.partitions) {
      stats.set(aggregateType, adapter.stats(partition.name));
    }
    return stats;
  }

  /**
   * Detect if any partition exceeds max depth threshold.
   */
  detectOverload(adapter: QueueAdapter): { aggregateType: string; stats: import("./queue-adapter-types.js").QueueStats }[] {
    const overloads: { aggregateType: string; stats: import("./queue-adapter-types.js").QueueStats }[] = [];
    for (const [aggregateType, partition] of this.partitions) {
      const stats = adapter.stats(partition.name);
      if (stats.waiting + stats.delayed > partition.config.maxDepth) {
        overloads.push({ aggregateType, stats });
      }
    }
    return overloads;
  }
}