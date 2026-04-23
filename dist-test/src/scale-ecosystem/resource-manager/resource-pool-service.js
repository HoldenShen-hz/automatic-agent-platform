import { z } from "zod";
export const ResourcePoolSchema = z.object({
    poolId: z.string().min(1),
    resourceType: z.string().min(1),
    capacityUnits: z.number().int().nonnegative(),
    allocatedUnits: z.number().int().nonnegative().default(0),
    burstUnits: z.number().int().nonnegative().default(0),
});
export class ResourcePoolService {
    pools = new Map();
    registerPool(pool) {
        const parsed = ResourcePoolSchema.parse(pool);
        this.pools.set(parsed.poolId, parsed);
        return parsed;
    }
    allocate(poolId, consumerId, units) {
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
    release(poolId, units) {
        const pool = this.requirePool(poolId);
        const allocatedUnits = Math.max(0, pool.allocatedUnits - units);
        const updated = {
            ...pool,
            allocatedUnits,
        };
        this.pools.set(poolId, updated);
        return updated;
    }
    getPool(poolId) {
        return this.pools.get(poolId) ?? null;
    }
    requirePool(poolId) {
        const pool = this.pools.get(poolId);
        if (pool == null) {
            throw new Error(`resource_pool.not_found:${poolId}`);
        }
        return pool;
    }
}
//# sourceMappingURL=resource-pool-service.js.map