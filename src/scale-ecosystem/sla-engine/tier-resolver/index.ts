import { z } from "zod";

export const SlaTierSchema = z.object({
  tierId: z.string().min(1),
  displayName: z.string().min(1),
  priority: z.number().int().nonnegative(),
  availability: z.number().min(0).max(1).optional().default(0.999),
  externalP95: z.number().int().nonnegative().optional().default(200),
  internalP99: z.number().int().nonnegative().optional().default(100),
  approvalLatencySlo: z.number().int().nonnegative().optional().default(3600),
  incidentResponseSlo: z.number().int().nonnegative().optional().default(1800),
  costMultiplier: z.number().min(0).optional().default(1.0),
  supportLevel: z.enum(["basic", "standard", "premium", "enterprise"]).optional().default("standard"),
  targetLatencyMs: z.number().int().positive().optional().default(1000),
  targetSuccessRate: z.number().min(0).max(1).optional().default(0.99),
  maxQueueWaitMs: z.number().int().nonnegative().optional().default(3000),
  preemptionPriority: z.number().int().nonnegative().optional().default(0),
  reservedCapacityPercent: z.number().min(0).max(100).optional().default(0),
  executionTimeoutMs: z.number().int().positive().optional().default(30000),
  degradationTolerancePercent: z.number().min(0).max(100).optional().default(5),
  recoveryAction: z.enum(["skip", "retry", "escalate", "freeze"]).optional().default("retry"),
  budgetAllocationPercent: z.number().min(0).max(100).optional().default(0),
});

export type SlaTier = z.input<typeof SlaTierSchema>;

export function resolveHighestPriorityTier(tiers: readonly SlaTier[]): SlaTier | null {
  return [...tiers].sort((left, right) => right.priority - left.priority)[0] ?? null;
}
