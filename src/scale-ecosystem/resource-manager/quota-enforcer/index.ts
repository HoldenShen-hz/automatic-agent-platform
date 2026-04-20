import { z } from "zod";

export const QuotaPolicySchema = z.object({
  scopeId: z.string().min(1),
  hardLimit: z.number().nonnegative(),
  currentUsage: z.number().nonnegative(),
});

export type QuotaPolicy = z.infer<typeof QuotaPolicySchema>;

export function isQuotaExceeded(policy: QuotaPolicy, requestedUnits: number): boolean {
  return policy.currentUsage + requestedUnits > policy.hardLimit;
}
