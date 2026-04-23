import { z } from "zod";
export const SlaTierSchema = z.object({
    tierId: z.string().min(1),
    displayName: z.string().min(1),
    priority: z.number().int().nonnegative(),
    targetLatencyMs: z.number().int().positive().optional().default(1000),
    targetSuccessRate: z.number().min(0).max(1).optional().default(0.99),
    maxQueueWaitMs: z.number().int().nonnegative().optional().default(3000),
    preemptionPriority: z.number().int().nonnegative().optional().default(0),
    reservedCapacityPercent: z.number().min(0).max(100).optional().default(0),
});
export function resolveHighestPriorityTier(tiers) {
    return [...tiers].sort((left, right) => right.priority - left.priority)[0] ?? null;
}
//# sourceMappingURL=index.js.map