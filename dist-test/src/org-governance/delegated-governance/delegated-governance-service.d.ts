import { type GovernanceDelegation, type Guardrail } from "./delegation-registry/index.js";
import { type GovernanceActionScope, type GovernanceOperationContext, type GovernanceOperationType } from "./scope-manager/index.js";
export interface DelegationResolution {
    readonly allowed: boolean;
    readonly delegationId: string | null;
    readonly reasonCodes: readonly string[];
    readonly violatedGuardrails?: readonly string[];
}
export interface GuardrailCheckResult {
    readonly allowed: boolean;
    readonly violatedGuardrails: readonly string[];
    readonly reasons: readonly string[];
}
export declare class DelegatedGovernanceService {
    private readonly delegations;
    constructor(delegations: readonly GovernanceDelegation[]);
    /**
     * Resolves whether a grantee has permission for a governance action scope.
     */
    resolve(granteeId: string, scope: GovernanceActionScope, now?: string): DelegationResolution;
    /**
     * Checks if an operation is allowed for the given context, considering guardrails.
     * Implements §51.2 governance inheritance and override rules.
     */
    checkOperation(ctx: GovernanceOperationContext, operation: GovernanceOperationType, attemptedValue?: unknown): GuardrailCheckResult;
    /**
     * Gets all guardrails applicable to an org node / domain.
     */
    getApplicableGuardrails(orgNodeId: string, domainId?: string): Guardrail[];
    /**
     * Lists all active delegations for a grantee.
     */
    listDelegationsForGrantee(granteeId: string, now?: string): GovernanceDelegation[];
    /**
     * Validates governance inheritance rules per §51.2.
     * Returns true if the action is valid given the hierarchy.
     */
    validateInheritanceRule(parentRole: GovernanceOperationContext["actorRole"], childRole: GovernanceOperationContext["actorRole"], action: "tighten" | "loosen" | "append" | "delete"): {
        allowed: boolean;
        reason: string;
    };
}
