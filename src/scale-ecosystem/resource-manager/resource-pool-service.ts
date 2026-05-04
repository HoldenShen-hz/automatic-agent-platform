import { z } from "zod";

// R24-5 FIX: Per-consumer resource breakdown for noisy neighbor detection
// Track allocations per consumer to enable per-consumer utilization analysis
interface ConsumerAllocation {
  readonly consumerId: string;
  readonly units: number;
  readonly allocatedAt: string;
}

export interface ResourceCapacityWeight {
  readonly resourceType: string;
  readonly weight: number;
}

export const ResourcePoolSchema = z.object({
  poolId: z.string().min(1),
  resourceType: z.string().min(1),
  // §9.8: tenant/org scope for failure isolation
  tenantId: z.string().min(1).optional(),
  orgNodeId: z.string().min(1).optional(),
  capacityUnits: z.number().int().nonnegative(),
  allocatedUnits: z.number().int().nonnegative().default(0),
  burstUnits: z.number().int().nonnegative().default(0),
  // §54.2: Per-resource-type capacity weight for weighted scheduling
  capacityWeight: z.number().min(0).optional().default(1.0),
  // §9.8: Failure tracking for automatic isolation
  failureRate: z.number().min(0).max(1).optional().default(0),
  isolatedAt: z.string().nullable().optional(),
  // R24-5 FIX: Per-consumer allocation breakdown for noisy neighbor detection
  consumerAllocations: z.record(z.string(), z.number().int().nonnegative()).optional().default({}),
});

export type ResourcePool = z.infer<typeof ResourcePoolSchema>;

export interface ResourcePoolAllocation {
  readonly poolId: string;
  readonly consumerId: string;
  readonly units: number;
  readonly granted: boolean;
  readonly reasonCodes: readonly string[];
}

// R24-5 FIX: Per-consumer utilization record for noisy neighbor detection
export interface ConsumerUtilization {
  readonly poolId: string;
  readonly consumerId: string;
  readonly allocatedUnits: number;
  readonly utilizationPercent: number;
  readonly isNoisyNeighbor: boolean;
}

export class ResourcePoolService {
  private readonly pools = new Map<string, ResourcePool>();

  // §9.8: Failure rate threshold for automatic isolation
  private static readonly FAILURE_RATE_ISOLATION_THRESHOLD = 0.3;

  // R24-5 FIX: Noisy neighbor detection threshold (50% of pool capacity)
  private static readonly NOISY_NEIGHBOR_THRESHOLD = 0.5;

  public registerPool(pool: ResourcePool): ResourcePool {
    const parsed = ResourcePoolSchema.parse(pool);
    this.pools.set(parsed.poolId, parsed);
    return parsed;
  }

  /**
   * Allocates units from a resource pool.
   * §9.8: Automatically isolates pools with failure_rate > 30%
   */
  public allocate(poolId: string, consumerId: string, units: number): ResourcePoolAllocation {
    const pool = this.requirePool(poolId);

    // §9.8: Check if pool should be isolated due to high failure rate
    if (pool.failureRate != null && pool.failureRate > ResourcePoolService.FAILURE_RATE_ISOLATION_THRESHOLD) {
      return {
        poolId,
        consumerId,
        units,
        granted: false,
        reasonCodes: ["resource_pool.isolated_high_failure_rate"],
      };
    }

    const available = pool.capacityUnits + pool.burstUnits - pool.allocatedUnits;
    if (units > available) {
      return {
        poolId,
        consumerId,
        units,
        granted: false,
        reasonCodes: ["resource_pool.capacity_exceeded"],
      };
    }
    this.pools.set(poolId, {
      ...pool,
      allocatedUnits: pool.allocatedUnits + units,
      // R24-5 FIX: Track per-consumer allocation for noisy neighbor detection
      consumerAllocations: {
        ...pool.consumerAllocations,
        [consumerId]: (pool.consumerAllocations[consumerId] ?? 0) + units,
      },
    });
    return {
      poolId,
      consumerId,
      units,
      granted: true,
      reasonCodes: ["resource_pool.allocated"],
    };
  }

  public release(poolId: string, consumerId: string, units: number): ResourcePool {
    const pool = this.requirePool(poolId);
    const allocatedUnits = Math.max(0, pool.allocatedUnits - units);
    // R24-5 FIX: Update per-consumer allocation tracking
    const currentConsumerAlloc = pool.consumerAllocations[consumerId] ?? 0;
    const updatedConsumerAllocations = { ...pool.consumerAllocations };
    if (currentConsumerAlloc <= units) {
      delete updatedConsumerAllocations[consumerId];
    } else {
      updatedConsumerAllocations[consumerId] = currentConsumerAlloc - units;
    }
    const updated: ResourcePool = {
      ...pool,
      allocatedUnits,
      consumerAllocations: updatedConsumerAllocations,
    };
    this.pools.set(poolId, updated);
    return updated;
  }

  /**
   * R24-5 FIX: Get per-consumer utilization for noisy neighbor detection.
   * Returns utilization metrics per consumer including noisy neighbor flag.
   */
  public getConsumerUtilization(poolId: string): ConsumerUtilization[] {
    const pool = this.pools.get(poolId);
    if (!pool) return [];

    const totalCapacity = pool.capacityUnits + pool.burstUnits;
    if (totalCapacity === 0) return [];

    return Object.entries(pool.consumerAllocations).map(([consumerId, units]) => {
      const utilizationPercent = totalCapacity > 0 ? units / totalCapacity : 0;
      return {
        poolId,
        consumerId,
        allocatedUnits: units,
        utilizationPercent,
        isNoisyNeighbor: utilizationPercent > ResourcePoolService.NOISY_NEIGHBOR_THRESHOLD,
      };
    });
  }

  public getPool(poolId: string): ResourcePool | null {
    return this.pools.get(poolId) ?? null;
  }

  private requirePool(poolId: string): ResourcePool {
    const pool = this.pools.get(poolId);
    if (pool == null) {
      throw new Error(`resource_pool.not_found:${poolId}`);
    }
    return pool;
  }
}
