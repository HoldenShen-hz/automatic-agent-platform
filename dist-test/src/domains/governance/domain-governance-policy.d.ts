import { z } from "zod";
export declare const DomainGovernanceRolloutSchema: z.ZodObject<{
    strategy: z.ZodDefault<z.ZodEnum<["manual", "canary", "shadow", "supervised_auto"]>>;
    approvalRequired: z.ZodDefault<z.ZodBoolean>;
    rollbackWindowMinutes: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    strategy: "manual" | "canary" | "shadow" | "supervised_auto";
    approvalRequired: boolean;
    rollbackWindowMinutes: number;
}, {
    strategy?: "manual" | "canary" | "shadow" | "supervised_auto" | undefined;
    approvalRequired?: boolean | undefined;
    rollbackWindowMinutes?: number | undefined;
}>;
export declare const DomainGovernancePolicySchema: z.ZodObject<{
    policyId: z.ZodString;
    domainId: z.ZodString;
    ownerRoles: z.ZodArray<z.ZodString, "many">;
    operatorRoles: z.ZodArray<z.ZodString, "many">;
    approvalRoles: z.ZodArray<z.ZodString, "many">;
    restrictedDataClasses: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    rollout: z.ZodObject<{
        strategy: z.ZodDefault<z.ZodEnum<["manual", "canary", "shadow", "supervised_auto"]>>;
        approvalRequired: z.ZodDefault<z.ZodBoolean>;
        rollbackWindowMinutes: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        strategy: "manual" | "canary" | "shadow" | "supervised_auto";
        approvalRequired: boolean;
        rollbackWindowMinutes: number;
    }, {
        strategy?: "manual" | "canary" | "shadow" | "supervised_auto" | undefined;
        approvalRequired?: boolean | undefined;
        rollbackWindowMinutes?: number | undefined;
    }>;
    mandatoryEvidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    domainId: string;
    policyId: string;
    ownerRoles: string[];
    operatorRoles: string[];
    approvalRoles: string[];
    restrictedDataClasses: string[];
    rollout: {
        strategy: "manual" | "canary" | "shadow" | "supervised_auto";
        approvalRequired: boolean;
        rollbackWindowMinutes: number;
    };
    mandatoryEvidence: string[];
}, {
    domainId: string;
    policyId: string;
    ownerRoles: string[];
    operatorRoles: string[];
    approvalRoles: string[];
    rollout: {
        strategy?: "manual" | "canary" | "shadow" | "supervised_auto" | undefined;
        approvalRequired?: boolean | undefined;
        rollbackWindowMinutes?: number | undefined;
    };
    restrictedDataClasses?: string[] | undefined;
    mandatoryEvidence?: string[] | undefined;
}>;
export type DomainGovernanceRollout = z.infer<typeof DomainGovernanceRolloutSchema>;
export type DomainGovernancePolicy = z.infer<typeof DomainGovernancePolicySchema>;
