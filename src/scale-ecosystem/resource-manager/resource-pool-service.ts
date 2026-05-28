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

export interface ResourcePoolStateStore {
  load(): readonly ResourcePool[];
  save(pools: readonly ResourcePool[]): void;
}

export interface ResourcePoolServiceOptions {
  readonly defaultFailureRateThreshold?: number;
  readonly defaultMinSampleSize?: number;
  readonly recoveryCooldownMs?: number;
  readonly stateStore?: ResourcePoolStateStore;
}

export class ResourcePoolService {
  private readonly pools = new Map<string, ResourcePool>();
  /** Per-consumer allocation tracking: poolId -> consumerId -> allocatedUnits */
  private readonly consumerAllocations = new Map<string, Map<string, number>>();
  private readonly recoveryCooldownMs: number;
  private readonly defaultFailureRateThreshold: number;
  private readonly defaultMinSampleSize: number;
  private readonly stateStore: ResourcePoolStateStore | undefined;
  private readonly isolationChangedAt = new Map<string, number>();

  public constructor(options: ResourcePoolServiceOptions = {}) {
    this.defaultFailureRateThreshold = options.defaultFailureRateThreshold ?? 0.3;
    this.defaultMinSampleSize = options.defaultMinSampleSize ?? 20;
    this.recoveryCooldownMs = options.recoveryCooldownMs ?? 60_000;
    this.stateStore = options.stateStore;
    for (const pool of options.stateStore?.load() ?? []) {
      this.pools.set(pool.poolId, pool);
      this.consumerAllocations.set(pool.poolId, new Map());
    }
  }

  public registerPool(pool: ResourcePool): ResourcePool {
    const parsed = ResourcePoolSchema.parse({
      ...pool,
      failureRateThreshold: pool.failureRateThreshold ?? this.defaultFailureRateThreshold,
      minSampleSize: pool.minSampleSize ?? this.defaultMinSampleSize,
    });
    this.pools.set(parsed.poolId, parsed);
    this.consumerAllocations.set(parsed.poolId, new Map());
    this.persistState();
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
    this.persistState();
    return {
      poolId,
      consumerId,
      units,
      granted: true,
      reasonCodes: ["resource_pool.allocated"],
    };
  }

  public release(poolId: string, units: number): ResourcePool;
  public release(poolId: string, consumerId: string, units: number): ResourcePool;
  public release(poolId: string, consumerIdOrUnits: string | number, maybeUnits?: number): ResourcePool {
    const pool = this.requirePool(poolId);
    let actualRelease: number;

    if (typeof consumerIdOrUnits === "number") {
      actualRelease = Math.min(consumerIdOrUnits, pool.allocatedUnits);
    } else {
      const consumerId = consumerIdOrUnits;
      const units = maybeUnits ?? 0;
      const poolConsumers = this.consumerAllocations.get(poolId);
      if (!poolConsumers) {
        throw new Error(`resource_pool.not_found:${poolId}`);
      }
      this.verifyConsumerOwnsResources(poolId, consumerId);
      const currentConsumerAllocation = poolConsumers.get(consumerId) ?? 0;
      actualRelease = Math.min(units, currentConsumerAllocation);
      const newConsumerAllocation = Math.max(0, currentConsumerAllocation - actualRelease);
      poolConsumers.set(consumerId, newConsumerAllocation);
    }

    const allocatedUnits = Math.max(0, pool.allocatedUnits - actualRelease);
    const updated: ResourcePool = {
      ...pool,
      allocatedUnits,
    };
    this.pools.set(poolId, updated);
    this.persistState();
    return updated;
  }

  public recordHealthObservation(poolId: string, observation: ResourcePoolHealthObservation): ResourcePool {
    const pool = this.requirePool(poolId);
    const now = Date.now();
    const shouldIsolate = observation.sampleCount >= pool.minSampleSize
      && observation.failureRate > pool.failureRateThreshold;
    const lastChangedAt = this.isolationChangedAt.get(poolId) ?? 0;
    const shouldRemainIsolated = pool.isolationStatus === "isolated"
      && !shouldIsolate
      && now - lastChangedAt < this.recoveryCooldownMs;
    const isolationStatus = shouldIsolate || shouldRemainIsolated ? "isolated" : "active";
    const updated: ResourcePool = {
      ...pool,
      failureRate: observation.failureRate,
      sampleCount: observation.sampleCount,
      isolationStatus,
    };
    this.pools.set(poolId, updated);
    if (updated.isolationStatus !== pool.isolationStatus) {
      this.isolationChangedAt.set(poolId, now);
    }
    this.persistState();
    return updated;
  }

  /**
   * Verify that a consumer owns the resources it attempts to release.
   * Throws if the consumerId does not match the registered owner or if
   * the consumer has no allocation in this pool.
   */
  private verifyConsumerOwnsResources(poolId: string, consumerId: string): void {
    const poolConsumers = this.consumerAllocations.get(poolId);
    if (!poolConsumers) {
      throw new Error(`resource_pool.not_found:${poolId}`);
    }
    const currentAllocation = poolConsumers.get(consumerId) ?? 0;
    if (currentAllocation <= 0) {
      throw new Error(`resource_pool.unauthorized_release:${consumerId} does not own units in pool ${poolId}`);
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

  private persistState(): void {
    this.stateStore?.save([...this.pools.values()]);
  }
}
