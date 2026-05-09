import { z } from "zod";

export const SlaTierSchema = z.object({
  tierId: z.string().min(1),
  tenantId: z.string().min(1).optional(),  // Optional tenant ID for multi-tenancy
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

/**
 * Resolve the highest priority tier for a given tenant.
 * If tenantId is provided, only tiers matching that tenant (or with no tenant) are considered.
 * If tenantId is null/undefined, global tiers (those without tenantId) are prioritized.
 */
export function resolveHighestPriorityTier(tiers: readonly SlaTier[], tenantId?: string | null): SlaTier | null {
  // Filter tiers by tenant scope
  const tenantTiers = tiers.filter((tier) => {
    if (tenantId == null) {
      // When no tenant specified, only use global tiers (no tenantId)
      return tier.tenantId == null;
    }
    // Match tiers belonging to the tenant or global tiers
    return tier.tenantId === tenantId || tier.tenantId == null;
  });

  if (tenantTiers.length === 0) {
    return null;
  }

  return [...tenantTiers].sort((left, right) => right.priority - left.priority)[0] ?? null;
}
