import { z } from "zod";
export const ApprovalEscalationRuleSchema = z.object({
    ruleId: z.string().min(1),
    triggerAfterMinutes: z.number().int().positive(),
    escalateToApproverId: z.string().min(1),
    appliesToRiskLevels: z.array(z.enum(["low", "medium", "high", "critical"])).default(["high", "critical"]),
});
export function shouldEscalateApproval(rule, createdAtIso, nowIso, riskLevel) {
    if (!rule.appliesToRiskLevels.includes(riskLevel)) {
        return false;
    }
    return Date.parse(nowIso) - Date.parse(createdAtIso) >= rule.triggerAfterMinutes * 60_000;
}
//# sourceMappingURL=index.js.map