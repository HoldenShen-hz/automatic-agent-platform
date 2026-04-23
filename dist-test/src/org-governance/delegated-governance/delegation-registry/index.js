import { z } from "zod";
/**
 * Governance permissions as defined in architecture doc §51.1.
 */
export const GovernancePermissionSchema = z.enum([
    "manage_domains",
    "manage_packs",
    "manage_prompts",
    "manage_triggers",
    "manage_approvals",
    "manage_budgets",
    "manage_knowledge",
    "view_audit",
    "manage_agents",
    "manage_eval",
]);
/**
 * Guardrail type enum as defined in architecture doc §51.1.
 */
export const GuardrailTypeSchema = z.enum([
    "max_risk_level",
    "max_budget",
    "forbidden_tools",
    "mandatory_approval",
    "min_eval_threshold",
]);
/**
 * Guardrail set by platform team - cannot be overridden.
 * As defined in architecture doc §51.1.
 */
export const GuardrailSchema = z.object({
    guardrailId: z.string().min(1),
    type: GuardrailTypeSchema,
    value: z.unknown(),
    setBy: z.enum(["platform_team"]).default("platform_team"),
    overridable: z.literal(false).default(false),
});
/**
 * Governance delegation - assigns permissions to a grantee within an org node.
 * As defined in architecture doc §51.1.
 */
export const GovernanceDelegationSchema = z.object({
    delegationId: z.string().min(1),
    grantorId: z.string().min(1),
    granteeId: z.string().min(1),
    /** Org nodes where this delegation applies (empty = all) */
    orgNodeIds: z.array(z.string()).default([]),
    /** Domains where this delegation applies (empty = all) */
    domainIds: z.array(z.string()).default([]),
    /** Specific governance permissions granted */
    permissions: z.array(GovernancePermissionSchema).default([]),
    /** Platform team-set guardrails (non-overridable) */
    guardrails: z.array(GuardrailSchema).default([]),
    expiresAt: z.string().min(1),
    revocable: z.boolean().default(true),
    status: z.enum(["active", "revoked", "expired"]).default("active"),
});
export function listActiveGovernanceDelegations(delegations, nowIso) {
    return delegations.filter((item) => item.status === "active" && item.expiresAt >= nowIso);
}
//# sourceMappingURL=index.js.map