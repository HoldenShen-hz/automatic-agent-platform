import { z } from "zod";
/**
 * Governance permissions as defined in architecture doc §51.1.
 */
export declare const GovernancePermissionSchema: z.ZodEnum<["manage_domains", "manage_packs", "manage_prompts", "manage_triggers", "manage_approvals", "manage_budgets", "manage_knowledge", "view_audit", "manage_agents", "manage_eval"]>;
export type GovernancePermission = z.infer<typeof GovernancePermissionSchema>;
/**
 * Guardrail type enum as defined in architecture doc §51.1.
 */
export declare const GuardrailTypeSchema: z.ZodEnum<["max_risk_level", "max_budget", "forbidden_tools", "mandatory_approval", "min_eval_threshold"]>;
export type GuardrailType = z.infer<typeof GuardrailTypeSchema>;
/**
 * Guardrail set by platform team - cannot be overridden.
 * As defined in architecture doc §51.1.
 */
export declare const GuardrailSchema: z.ZodObject<{
    guardrailId: z.ZodString;
    type: z.ZodEnum<["max_risk_level", "max_budget", "forbidden_tools", "mandatory_approval", "min_eval_threshold"]>;
    value: z.ZodUnknown;
    setBy: z.ZodDefault<z.ZodEnum<["platform_team"]>>;
    overridable: z.ZodDefault<z.ZodLiteral<false>>;
}, "strip", z.ZodTypeAny, {
    type: "max_risk_level" | "max_budget" | "forbidden_tools" | "mandatory_approval" | "min_eval_threshold";
    guardrailId: string;
    setBy: "platform_team";
    overridable: false;
    value?: unknown;
}, {
    type: "max_risk_level" | "max_budget" | "forbidden_tools" | "mandatory_approval" | "min_eval_threshold";
    guardrailId: string;
    value?: unknown;
    setBy?: "platform_team" | undefined;
    overridable?: false | undefined;
}>;
export type Guardrail = z.infer<typeof GuardrailSchema>;
/**
 * Governance delegation - assigns permissions to a grantee within an org node.
 * As defined in architecture doc §51.1.
 */
export declare const GovernanceDelegationSchema: z.ZodObject<{
    delegationId: z.ZodString;
    grantorId: z.ZodString;
    granteeId: z.ZodString;
    /** Org nodes where this delegation applies (empty = all) */
    orgNodeIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Domains where this delegation applies (empty = all) */
    domainIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Specific governance permissions granted */
    permissions: z.ZodDefault<z.ZodArray<z.ZodEnum<["manage_domains", "manage_packs", "manage_prompts", "manage_triggers", "manage_approvals", "manage_budgets", "manage_knowledge", "view_audit", "manage_agents", "manage_eval"]>, "many">>;
    /** Platform team-set guardrails (non-overridable) */
    guardrails: z.ZodDefault<z.ZodArray<z.ZodObject<{
        guardrailId: z.ZodString;
        type: z.ZodEnum<["max_risk_level", "max_budget", "forbidden_tools", "mandatory_approval", "min_eval_threshold"]>;
        value: z.ZodUnknown;
        setBy: z.ZodDefault<z.ZodEnum<["platform_team"]>>;
        overridable: z.ZodDefault<z.ZodLiteral<false>>;
    }, "strip", z.ZodTypeAny, {
        type: "max_risk_level" | "max_budget" | "forbidden_tools" | "mandatory_approval" | "min_eval_threshold";
        guardrailId: string;
        setBy: "platform_team";
        overridable: false;
        value?: unknown;
    }, {
        type: "max_risk_level" | "max_budget" | "forbidden_tools" | "mandatory_approval" | "min_eval_threshold";
        guardrailId: string;
        value?: unknown;
        setBy?: "platform_team" | undefined;
        overridable?: false | undefined;
    }>, "many">>;
    expiresAt: z.ZodString;
    revocable: z.ZodDefault<z.ZodBoolean>;
    status: z.ZodDefault<z.ZodEnum<["active", "revoked", "expired"]>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "expired" | "revoked";
    expiresAt: string;
    domainIds: string[];
    guardrails: {
        type: "max_risk_level" | "max_budget" | "forbidden_tools" | "mandatory_approval" | "min_eval_threshold";
        guardrailId: string;
        setBy: "platform_team";
        overridable: false;
        value?: unknown;
    }[];
    permissions: ("manage_domains" | "manage_packs" | "manage_prompts" | "manage_triggers" | "manage_approvals" | "manage_budgets" | "manage_knowledge" | "view_audit" | "manage_agents" | "manage_eval")[];
    delegationId: string;
    grantorId: string;
    granteeId: string;
    orgNodeIds: string[];
    revocable: boolean;
}, {
    expiresAt: string;
    delegationId: string;
    grantorId: string;
    granteeId: string;
    status?: "active" | "expired" | "revoked" | undefined;
    domainIds?: string[] | undefined;
    guardrails?: {
        type: "max_risk_level" | "max_budget" | "forbidden_tools" | "mandatory_approval" | "min_eval_threshold";
        guardrailId: string;
        value?: unknown;
        setBy?: "platform_team" | undefined;
        overridable?: false | undefined;
    }[] | undefined;
    permissions?: ("manage_domains" | "manage_packs" | "manage_prompts" | "manage_triggers" | "manage_approvals" | "manage_budgets" | "manage_knowledge" | "view_audit" | "manage_agents" | "manage_eval")[] | undefined;
    orgNodeIds?: string[] | undefined;
    revocable?: boolean | undefined;
}>;
export type GovernanceDelegation = z.infer<typeof GovernanceDelegationSchema>;
export declare function listActiveGovernanceDelegations(delegations: readonly GovernanceDelegation[], nowIso: string): GovernanceDelegation[];
