import type { GovernanceDelegation, GovernancePermission, Guardrail } from "../delegation-registry/index.js";
export interface GovernanceActionScope {
    readonly orgNodeId: string;
    readonly domainId?: string;
    readonly capability: string;
    readonly permission?: GovernancePermission;
}
export interface GovernanceOperationContext {
    readonly actorId: string;
    readonly actorRole: "platform_team" | "division_admin" | "department_admin" | "team_lead";
    readonly orgNodeId: string;
    readonly domainId?: string;
}
/**
 * Validates if a governance scope matches a delegation.
 */
export declare function matchesGovernanceScope(delegation: GovernanceDelegation, scope: GovernanceActionScope): boolean;
/**
 * Checks if a guardrail allows an operation.
 * Platform team guardrails cannot be overridden.
 */
export declare function evaluateGuardrail(guardrail: Guardrail, attemptedValue: unknown): {
    allowed: boolean;
    reason: string;
};
/**
 * Operation type for self-service governance as defined in §51.3.
 */
export type GovernanceOperationType = "domain_onboarding" | "modify_approval_rules" | "publish_pack" | "adjust_agent_autonomy" | "create_trigger" | "modify_global_guardrails" | "cross_domain_strategy";
/**
 * Checks if an operation is allowed based on §51.3 table.
 */
export declare function isOperationAllowedByRole(operation: GovernanceOperationType, role: GovernanceActionScope["orgNodeId"] extends string ? "platform_team" | "division_admin" | "department_admin" | "team_lead" : never): boolean;
