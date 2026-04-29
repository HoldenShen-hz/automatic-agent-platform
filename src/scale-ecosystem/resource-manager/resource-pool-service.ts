import { z } from "zod";

// §54.2: Per-resource-type capacity weight for weighted multi-resource scheduling
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
});

export type ResourcePool = z.infer<typeof ResourcePoolSchema>;

export interface ResourcePoolAllocation {
  readonly poolId: string;
  readonly consumerId: string;
  readonly units: number;
  readonly granted: boolean;
  readonly reasonCodes: readonly string[];
}

export class ResourcePoolService {
  private readonly pools = new Map<string, ResourcePool>();

  // §9.8: Failure rate threshold for automatic isolation
  private static readonly FAILURE_RATE_ISOLATION_THRESHOLD = 0.3;

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
    });
    return {
      poolId,
      consumerId,
      units,
      granted: true,
      reasonCodes: ["resource_pool.allocated"],
    };
  }

  public release(poolId: string, units: number): ResourcePool {
    const pool = this.requirePool(poolId);
    const allocatedUnits = Math.max(0, pool.allocatedUnits - units);
    const updated: ResourcePool = {
      ...pool,
      allocatedUnits,
    };
    this.pools.set(poolId, updated);
    return updated;
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
