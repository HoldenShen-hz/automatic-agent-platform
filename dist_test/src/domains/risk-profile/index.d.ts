import { z } from "zod";
export declare const DomainRiskLevelSchema: z.ZodEnum<["low", "medium", "high", "critical"]>;
export declare const DomainRiskDimensionSchema: z.ZodObject<{
    dimension: z.ZodString;
    weight: z.ZodNumber;
    threshold: z.ZodNumber;
    mitigation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    dimension: string;
    threshold: number;
    weight: number;
    mitigation: string;
}, {
    dimension: string;
    threshold: number;
    weight: number;
    mitigation: string;
}>;
/**
 * Risk override for domain-specific risk adjustment.
 * As defined in architecture doc §37.3 DomainRiskProfile.
 */
export declare const RiskOverrideSchema: z.ZodObject<{
    actionPattern: z.ZodString;
    baseRisk: z.ZodNumber;
    domainRisk: z.ZodNumber;
    reason: z.ZodString;
    requiresJustification: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    actionPattern: string;
    baseRisk: number;
    domainRisk: number;
    requiresJustification: boolean;
}, {
    reason: string;
    actionPattern: string;
    baseRisk: number;
    domainRisk: number;
    requiresJustification?: boolean | undefined;
}>;
/**
 * Escalation level for risk-based escalation.
 * As defined in architecture doc §37.3 DomainRiskProfile.
 */
export declare const EscalationLevelSchema: z.ZodObject<{
    level: z.ZodNumber;
    trigger: z.ZodString;
    target: z.ZodEnum<["domain_owner", "platform_sre", "security_team", "executive"]>;
    responseSla: z.ZodString;
}, "strip", z.ZodTypeAny, {
    level: number;
    target: "domain_owner" | "platform_sre" | "security_team" | "executive";
    trigger: string;
    responseSla: string;
}, {
    level: number;
    target: "domain_owner" | "platform_sre" | "security_team" | "executive";
    trigger: string;
    responseSla: string;
}>;
/**
 * Approval rule for mandatory approvals.
 * As defined in architecture doc §37.3 DomainRiskProfile.
 */
export declare const ApprovalRuleSchema: z.ZodObject<{
    ruleId: z.ZodString;
    actionPattern: z.ZodString;
    requiredApprovals: z.ZodDefault<z.ZodNumber>;
    approverRole: z.ZodString;
}, "strip", z.ZodTypeAny, {
    actionPattern: string;
    ruleId: string;
    requiredApprovals: number;
    approverRole: string;
}, {
    actionPattern: string;
    ruleId: string;
    approverRole: string;
    requiredApprovals?: number | undefined;
}>;
export declare const DomainRiskProfileSchema: z.ZodObject<{
    profileId: z.ZodString;
    domainId: z.ZodString;
    defaultRiskLevel: z.ZodEnum<["low", "medium", "high", "critical"]>;
    dimensions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        dimension: z.ZodString;
        weight: z.ZodNumber;
        threshold: z.ZodNumber;
        mitigation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        dimension: string;
        threshold: number;
        weight: number;
        mitigation: string;
    }, {
        dimension: string;
        threshold: number;
        weight: number;
        mitigation: string;
    }>, "many">>;
    regulatoryClass: z.ZodOptional<z.ZodEnum<["unregulated", "lightly_regulated", "regulated", "heavily_regulated"]>>;
    timeSensitivity: z.ZodOptional<z.ZodEnum<["batch", "near_realtime", "realtime", "ultra_realtime"]>>;
    reversibility: z.ZodOptional<z.ZodEnum<["fully_reversible", "partially_reversible", "irreversible"]>>;
    blastRadius: z.ZodOptional<z.ZodEnum<["single_user", "team", "department", "company", "external"]>>;
    riskOverrides: z.ZodOptional<z.ZodArray<z.ZodObject<{
        actionPattern: z.ZodString;
        baseRisk: z.ZodNumber;
        domainRisk: z.ZodNumber;
        reason: z.ZodString;
        requiresJustification: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        actionPattern: string;
        baseRisk: number;
        domainRisk: number;
        requiresJustification: boolean;
    }, {
        reason: string;
        actionPattern: string;
        baseRisk: number;
        domainRisk: number;
        requiresJustification?: boolean | undefined;
    }>, "many">>;
    escalationChain: z.ZodOptional<z.ZodArray<z.ZodObject<{
        level: z.ZodNumber;
        trigger: z.ZodString;
        target: z.ZodEnum<["domain_owner", "platform_sre", "security_team", "executive"]>;
        responseSla: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        level: number;
        target: "domain_owner" | "platform_sre" | "security_team" | "executive";
        trigger: string;
        responseSla: string;
    }, {
        level: number;
        target: "domain_owner" | "platform_sre" | "security_team" | "executive";
        trigger: string;
        responseSla: string;
    }>, "many">>;
    mandatoryApprovals: z.ZodOptional<z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        actionPattern: z.ZodString;
        requiredApprovals: z.ZodDefault<z.ZodNumber>;
        approverRole: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        actionPattern: string;
        ruleId: string;
        requiredApprovals: number;
        approverRole: string;
    }, {
        actionPattern: string;
        ruleId: string;
        approverRole: string;
        requiredApprovals?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    domainId: string;
    profileId: string;
    defaultRiskLevel: "low" | "high" | "medium" | "critical";
    dimensions: {
        dimension: string;
        threshold: number;
        weight: number;
        mitigation: string;
    }[];
    regulatoryClass?: "unregulated" | "lightly_regulated" | "regulated" | "heavily_regulated" | undefined;
    timeSensitivity?: "batch" | "near_realtime" | "realtime" | "ultra_realtime" | undefined;
    reversibility?: "fully_reversible" | "partially_reversible" | "irreversible" | undefined;
    blastRadius?: "external" | "single_user" | "team" | "department" | "company" | undefined;
    riskOverrides?: {
        reason: string;
        actionPattern: string;
        baseRisk: number;
        domainRisk: number;
        requiresJustification: boolean;
    }[] | undefined;
    escalationChain?: {
        level: number;
        target: "domain_owner" | "platform_sre" | "security_team" | "executive";
        trigger: string;
        responseSla: string;
    }[] | undefined;
    mandatoryApprovals?: {
        actionPattern: string;
        ruleId: string;
        requiredApprovals: number;
        approverRole: string;
    }[] | undefined;
}, {
    domainId: string;
    profileId: string;
    defaultRiskLevel: "low" | "high" | "medium" | "critical";
    dimensions?: {
        dimension: string;
        threshold: number;
        weight: number;
        mitigation: string;
    }[] | undefined;
    regulatoryClass?: "unregulated" | "lightly_regulated" | "regulated" | "heavily_regulated" | undefined;
    timeSensitivity?: "batch" | "near_realtime" | "realtime" | "ultra_realtime" | undefined;
    reversibility?: "fully_reversible" | "partially_reversible" | "irreversible" | undefined;
    blastRadius?: "external" | "single_user" | "team" | "department" | "company" | undefined;
    riskOverrides?: {
        reason: string;
        actionPattern: string;
        baseRisk: number;
        domainRisk: number;
        requiresJustification?: boolean | undefined;
    }[] | undefined;
    escalationChain?: {
        level: number;
        target: "domain_owner" | "platform_sre" | "security_team" | "executive";
        trigger: string;
        responseSla: string;
    }[] | undefined;
    mandatoryApprovals?: {
        actionPattern: string;
        ruleId: string;
        approverRole: string;
        requiredApprovals?: number | undefined;
    }[] | undefined;
}>;
export type DomainRiskLevel = z.infer<typeof DomainRiskLevelSchema>;
export type DomainRiskDimension = z.infer<typeof DomainRiskDimensionSchema>;
export type RiskOverride = z.infer<typeof RiskOverrideSchema>;
export type EscalationLevel = z.infer<typeof EscalationLevelSchema>;
export type ApprovalRule = z.infer<typeof ApprovalRuleSchema>;
export type DomainRiskProfile = z.infer<typeof DomainRiskProfileSchema>;
export declare function computeDomainRiskLevel(profile: DomainRiskProfile, score: number): DomainRiskLevel;
