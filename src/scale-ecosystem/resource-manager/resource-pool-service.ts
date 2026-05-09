import { z } from "zod";

export const ResourcePoolSchema = z.object({
  poolId: z.string().min(1),
  resourceType: z.string().min(1),
  scopeType: z.enum(["shared", "tenant", "organization", "workspace"]).default("shared"),
  tenantId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
  capacityUnits: z.number().int().nonnegative(),
  allocatedUnits: z.number().int().nonnegative().default(0),
  burstUnits: z.number().int().nonnegative().default(0),
  failureRateThreshold: z.number().min(0).max(1).default(0.3),
  minSampleSize: z.number().int().positive().default(20),
  failureRate: z.number().min(0).max(1).default(0),
  sampleCount: z.number().int().nonnegative().default(0),
  isolationStatus: z.enum(["active", "isolated"]).default("active"),
});

export type ResourcePool = z.infer<typeof ResourcePoolSchema>;

export interface ResourcePoolAllocation {
  readonly poolId: string;
  readonly consumerId: string;
  readonly units: number;
  readonly granted: boolean;
  readonly reasonCodes: readonly string[];
}

/** Per-consumer resource allocation breakdown */
export interface ConsumerAllocation {
  readonly poolId: string;
  readonly consumerId: string;
  readonly allocatedUnits: number;
}

export interface ResourcePoolHealthObservation {
  readonly failureRate: number;
  readonly sampleCount: number;
}

export class ResourcePoolService {
  private readonly pools = new Map<string, ResourcePool>();
  /** Per-consumer allocation tracking: poolId -> consumerId -> allocatedUnits */
  private readonly consumerAllocations = new Map<string, Map<string, number>>();

  public registerPool(pool: ResourcePool): ResourcePool {
    const parsed = ResourcePoolSchema.parse(pool);
    this.pools.set(parsed.poolId, parsed);
    this.consumerAllocations.set(parsed.poolId, new Map());
    return parsed;
  }

  public allocate(poolId: string, consumerId: string, units: number): ResourcePoolAllocation {
    const pool = this.requirePool(poolId);
    if (pool.isolationStatus === "isolated") {
      return {
        poolId,
        consumerId,
        units,
        granted: false,
        reasonCodes: ["resource_pool.isolated"],
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
    // Track per-consumer allocation
    const poolConsumers = this.consumerAllocations.get(poolId)!;
    poolConsumers.set(consumerId, (poolConsumers.get(consumerId) ?? 0) + units);
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
    const poolConsumers = this.consumerAllocations.get(poolId);
    if (!poolConsumers) {
      throw new Error(`resource_pool.not_found:${poolId}`);
    }
    // R17: Verify consumer owns the resources before releasing
    this.verifyConsumerOwnsResources(poolId, consumerId, units);
    const currentConsumerAllocation = poolConsumers.get(consumerId) ?? 0;
    const actualRelease = Math.min(units, currentConsumerAllocation);
    const newConsumerAllocation = Math.max(0, currentConsumerAllocation - actualRelease);
    poolConsumers.set(consumerId, newConsumerAllocation);
    const allocatedUnits = Math.max(0, pool.allocatedUnits - actualRelease);
    const updated: ResourcePool = {
      ...pool,
      allocatedUnits,
    };
    this.pools.set(poolId, updated);
    return updated;
  }

  public recordHealthObservation(poolId: string, observation: ResourcePoolHealthObservation): ResourcePool {
    const pool = this.requirePool(poolId);
    const shouldIsolate = observation.sampleCount >= pool.minSampleSize
      && observation.failureRate > pool.failureRateThreshold;
    const updated: ResourcePool = {
      ...pool,
      failureRate: observation.failureRate,
      sampleCount: observation.sampleCount,
      isolationStatus: shouldIsolate ? "isolated" : "active",
    };
    this.pools.set(poolId, updated);
    return updated;
  }

  /**
   * Verify that a consumer owns the resources it attempts to release.
   * Throws if the consumerId does not match the registered owner or if
   * the consumer has no allocation in this pool.
   */
  private verifyConsumerOwnsResources(poolId: string, consumerId: string, requestedUnits: number): void {
    const poolConsumers = this.consumerAllocations.get(poolId);
    if (!poolConsumers) {
      throw new Error(`resource_pool.not_found:${poolId}`);
    }
    const currentAllocation = poolConsumers.get(consumerId) ?? 0;
    if (currentAllocation < requestedUnits) {
      throw new Error(`resource_pool.unauthorized_release:${consumerId} does not own ${requestedUnits} units in pool ${poolId} (current: ${currentAllocation})`);
    }
  }

  /**
   * Get per-consumer allocation breakdown for a pool.
   */
  public getConsumerAllocations(poolId: string): ConsumerAllocation[] {
    const poolConsumers = this.consumerAllocations.get(poolId);
    if (!poolConsumers) {
      return [];
    }
    const result: ConsumerAllocation[] = [];
    for (const [consumerId, allocatedUnits] of poolConsumers) {
      result.push({ poolId, consumerId, allocatedUnits });
    }
    return result;
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
