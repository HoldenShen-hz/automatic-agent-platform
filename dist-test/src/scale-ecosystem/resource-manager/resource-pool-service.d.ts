import { z } from "zod";
export declare const ResourcePoolSchema: z.ZodObject<{
    poolId: z.ZodString;
    resourceType: z.ZodString;
    capacityUnits: z.ZodNumber;
    allocatedUnits: z.ZodDefault<z.ZodNumber>;
    burstUnits: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    resourceType: string;
    poolId: string;
    capacityUnits: number;
    allocatedUnits: number;
    burstUnits: number;
}, {
    resourceType: string;
    poolId: string;
    capacityUnits: number;
    allocatedUnits?: number | undefined;
    burstUnits?: number | undefined;
}>;
export type ResourcePool = z.infer<typeof ResourcePoolSchema>;
export interface ResourcePoolAllocation {
    readonly poolId: string;
    readonly consumerId: string;
    readonly units: number;
    readonly granted: boolean;
    readonly reasonCodes: readonly string[];
}
export declare class ResourcePoolService {
    private readonly pools;
    registerPool(pool: ResourcePool): ResourcePool;
    allocate(poolId: string, consumerId: string, units: number): ResourcePoolAllocation;
    release(poolId: string, units: number): ResourcePool;
    getPool(poolId: string): ResourcePool | null;
    private requirePool;
}
