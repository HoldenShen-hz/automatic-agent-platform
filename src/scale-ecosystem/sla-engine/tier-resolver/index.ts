import { z } from "zod";

export const SlaTierSchema = z.object({
  tierId: z.string().min(1),
  displayName: z.string().min(1),
  priority: z.number().int().nonnegative(),
  reservedCapacityPercent: z.number().min(0).max(100),
});

export type SlaTier = z.infer<typeof SlaTierSchema>;

export function resolveHighestPriorityTier(tiers: readonly SlaTier[]): SlaTier | null {
  return [...tiers].sort((left, right) => right.priority - left.priority)[0] ?? null;
}
