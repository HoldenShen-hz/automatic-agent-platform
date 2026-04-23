import { z } from "zod";
export declare const SlaTierSchema: z.ZodObject<{
    tierId: z.ZodString;
    displayName: z.ZodString;
    priority: z.ZodNumber;
    targetLatencyMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    targetSuccessRate: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    maxQueueWaitMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    preemptionPriority: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    reservedCapacityPercent: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    displayName: string;
    priority: number;
    tierId: string;
    targetLatencyMs: number;
    targetSuccessRate: number;
    maxQueueWaitMs: number;
    preemptionPriority: number;
    reservedCapacityPercent: number;
}, {
    displayName: string;
    priority: number;
    tierId: string;
    targetLatencyMs?: number | undefined;
    targetSuccessRate?: number | undefined;
    maxQueueWaitMs?: number | undefined;
    preemptionPriority?: number | undefined;
    reservedCapacityPercent?: number | undefined;
}>;
export type SlaTier = z.input<typeof SlaTierSchema>;
export declare function resolveHighestPriorityTier(tiers: readonly SlaTier[]): SlaTier | null;
