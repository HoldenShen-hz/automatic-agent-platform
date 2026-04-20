import { z } from "zod";

export const SlaTierSchema = z.object({
  tierId: z.string().min(1),
  displayName: z.string().min(1),
  priority: z.number().int().nonnegative(),
  targetLatencyMs: z.number().int().positive().default(1000),
  targetSuccessRate: z.number().min(0).max(1).default(0.99),
  maxQueueWaitMs: z.number().int().nonnegative().default(3000),
  preemptionPriority: z.number().int().nonnegative().default(0),
  reservedCapacityPercent: z.number().min(0).max(100),
});

export type SlaTier = z.input<typeof SlaTierSchema>;

export function resolveHighestPriorityTier(tiers: readonly SlaTier[]): SlaTier | null {
  return [...tiers].sort((left, right) => right.priority - left.priority)[0] ?? null;
}
