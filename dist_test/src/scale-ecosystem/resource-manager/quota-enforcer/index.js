import { z } from "zod";
export const QuotaPolicySchema = z.object({
    scopeId: z.string().min(1),
    resourceType: z.string().min(1).default("runtime_units"),
    hardLimit: z.number().nonnegative(),
    softLimit: z.number().nonnegative().optional(),
    burstLimit: z.number().nonnegative().optional(),
    resetWindow: z.string().min(1).default("1h"),
    currentUsage: z.number().nonnegative(),
});
export function isQuotaExceeded(policy, requestedUnits) {
    return policy.currentUsage + requestedUnits > policy.hardLimit;
}
//# sourceMappingURL=index.js.map