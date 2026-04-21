import { z } from "zod";
export declare const SlaTierSchema: z.ZodObject<{
    tierId: z.ZodString;
    displayName: z.ZodString;
    priority: z.ZodNumber;
    targetLatencyMs: z.ZodDefault<z.ZodNumber>;
    targetSuccessRate: z.ZodDefault<z.ZodNumber>;
    maxQueueWaitMs: z.ZodDefault<z.ZodNumber>;
    preemptionPriority: z.ZodDefault<z.ZodNumber>;
    reservedCapacityPercent: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    priority: number;
    displayName: string;
    tierId: string;
    targetLatencyMs: number;
    targetSuccessRate: number;
    maxQueueWaitMs: number;
    preemptionPriority: number;
    reservedCapacityPercent: number;
}, {
    priority: number;
    displayName: string;
    tierId: string;
    reservedCapacityPercent: number;
    targetLatencyMs?: number | undefined;
    targetSuccessRate?: number | undefined;
    maxQueueWaitMs?: number | undefined;
    preemptionPriority?: number | undefined;
}>;
export type SlaTier = z.input<typeof SlaTierSchema>;
export declare function resolveHighestPriorityTier(tiers: readonly SlaTier[]): SlaTier | null;
