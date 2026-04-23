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
export function evaluateQuota(policy, requestedUnits) {
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
export function isQuotaExceeded(policy, requestedUnits) {
    return evaluateQuota(policy, requestedUnits).exceeded;
}
//# sourceMappingURL=index.js.map