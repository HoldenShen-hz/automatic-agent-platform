import { z } from "zod";
export declare const ApprovalEscalationRuleSchema: z.ZodObject<{
    ruleId: z.ZodString;
    triggerAfterMinutes: z.ZodNumber;
    escalateToApproverId: z.ZodString;
    appliesToRiskLevels: z.ZodDefault<z.ZodArray<z.ZodEnum<["low", "medium", "high", "critical"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    ruleId: string;
    triggerAfterMinutes: number;
    escalateToApproverId: string;
    appliesToRiskLevels: ("low" | "high" | "medium" | "critical")[];
}, {
    ruleId: string;
    triggerAfterMinutes: number;
    escalateToApproverId: string;
    appliesToRiskLevels?: ("low" | "high" | "medium" | "critical")[] | undefined;
}>;
export type ApprovalEscalationRule = z.infer<typeof ApprovalEscalationRuleSchema>;
export declare function shouldEscalateApproval(rule: ApprovalEscalationRule, createdAtIso: string, nowIso: string, riskLevel: "low" | "medium" | "high" | "critical"): boolean;
