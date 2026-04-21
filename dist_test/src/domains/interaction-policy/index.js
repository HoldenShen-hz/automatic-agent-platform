import { z } from "zod";
export const DomainInteractionModeSchema = z.enum(["allow", "approval_required", "deny"]);
export const DomainInteractionRuleSchema = z.object({
    sourceDomainId: z.string().min(1),
    targetDomainId: z.string().min(1),
    mode: DomainInteractionModeSchema,
    maxConcurrentWorkflows: z.number().int().positive().default(1),
    compensationRequired: z.boolean().default(false),
});
export function isCrossDomainInteractionAllowed(rules, sourceDomainId, targetDomainId) {
    const match = rules.find((item) => item.sourceDomainId === sourceDomainId && item.targetDomainId === targetDomainId);
    return match?.mode === "allow";
}
//# sourceMappingURL=index.js.map