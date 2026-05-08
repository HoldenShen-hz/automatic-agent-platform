import { z } from "zod";

export const QuotaPolicySchema = z.object({
  scope: z.string().min(1).default("tenant"),
  scopeId: z.string().min(1).optional(),
  resourceType: z.string().min(1).default("runtime_units"),
  hardLimit: z.number().nonnegative(),
  softLimit: z.number().nonnegative().optional(),
  burstLimit: z.number().nonnegative().optional(),
  resetWindow: z.string().min(1).default("1h"),
  currentUsage: z.number().nonnegative(),
});

export type QuotaPolicy = z.input<typeof QuotaPolicySchema>;

export interface QuotaDecision {
  readonly exceeded: boolean;
  readonly warning: boolean;
  readonly usesBurst: boolean;
  readonly remainingUnits: number;
}

export function evaluateQuota(policy: QuotaPolicy, requestedUnits: number): QuotaDecision {
  const projected = policy.currentUsage + requestedUnits;
  const hardLimit = policy.hardLimit;
  const softLimit = policy.softLimit ?? hardLimit;
  const burstLimit = policy.burstLimit ?? hardLimit;
  const exceeded = projected > burstLimit;
  return {
    exceeded,
    warning: projected > softLimit,
    usesBurst: projected > hardLimit && projected <= burstLimit,
    remainingUnits: Math.max(0, burstLimit - projected),
  };
}

export function isQuotaExceeded(policy: QuotaPolicy, requestedUnits: number): boolean {
  return evaluateQuota(policy, requestedUnits).exceeded;
}
