import { z } from "zod";

export const ResourcePoolSchema = z.object({
  poolId: z.string().min(1),
  resourceType: z.string().min(1),
  capacityUnits: z.number().int().nonnegative(),
  allocatedUnits: z.number().int().nonnegative().default(0),
  burstUnits: z.number().int().nonnegative().default(0),
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

  public registerPool(pool: ResourcePool): ResourcePool {
    const parsed = ResourcePoolSchema.parse(pool);
    this.pools.set(parsed.poolId, parsed);
    return parsed;
  }

  public allocate(poolId: string, consumerId: string, units: number): ResourcePoolAllocation {
    const pool = this.requirePool(poolId);
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
