import { nowIso } from "../../platform/contracts/types/ids.js";
import { listActiveGovernanceDelegations, } from "./delegation-registry/index.js";
import { evaluateGuardrail, matchesGovernanceScope, isOperationAllowedByRole, } from "./scope-manager/index.js";
export class DelegatedGovernanceService {
    delegations;
    constructor(delegations) {
        this.delegations = delegations;
    }
    /**
     * Resolves whether a grantee has permission for a governance action scope.
     */
    resolve(granteeId, scope, now = nowIso()) {
        const active = listActiveGovernanceDelegations(this.delegations, now)
            .filter((item) => item.granteeId === granteeId);
        const matched = active.find((item) => matchesGovernanceScope(item, scope)) ?? null;
        return {
            allowed: matched != null,
            delegationId: matched?.delegationId ?? null,
            reasonCodes: matched == null
                ? ["delegated_governance.scope_not_granted"]
                : ["delegated_governance.scope_granted"],
        };
    }
    /**
     * Checks if an operation is allowed for the given context, considering guardrails.
     * Implements §51.2 governance inheritance and override rules.
     */
    checkOperation(ctx, operation, attemptedValue) {
        // First check if operation is allowed by role per §51.3
        const roleAllowed = isOperationAllowedByRole(operation, ctx.actorRole);
        if (!roleAllowed) {
            return {
                allowed: false,
                violatedGuardrails: ["role_guardrail"],
                reasons: [`Operation ${operation} not permitted for role ${ctx.actorRole}`],
            };
        }
        // Platform team guardrails apply to all roles - collect all applicable guardrails
        const allGuardrails = [];
        for (const delegation of this.delegations) {
            if (delegation.status !== "active")
                continue;
            if (delegation.grantorId !== "platform_team")
                continue;
            const orgMatch = delegation.orgNodeIds.length === 0 || delegation.orgNodeIds.includes(ctx.orgNodeId);
            const domainMatch = delegation.domainIds.length === 0 || (ctx.domainId != null && delegation.domainIds.includes(ctx.domainId));
            if (orgMatch && domainMatch) {
                allGuardrails.push(...delegation.guardrails);
            }
        }
        // Evaluate each guardrail
        const violatedGuardrails = [];
        const reasons = [];
        for (const guardrail of allGuardrails) {
            if (attemptedValue === undefined)
                continue;
            const result = evaluateGuardrail(guardrail, attemptedValue);
            if (!result.allowed) {
                violatedGuardrails.push(guardrail.guardrailId);
                reasons.push(result.reason);
            }
        }
        return {
            allowed: violatedGuardrails.length === 0,
            violatedGuardrails,
            reasons,
        };
    }
    /**
     * Gets all guardrails applicable to an org node / domain.
     */
    getApplicableGuardrails(orgNodeId, domainId) {
        const guardrails = [];
        for (const delegation of this.delegations) {
            if (delegation.status !== "active")
                continue;
            const orgMatch = delegation.orgNodeIds.length === 0 || delegation.orgNodeIds.includes(orgNodeId);
            const domainMatch = delegation.domainIds.length === 0 || (domainId != null && delegation.domainIds.includes(domainId));
            if (orgMatch && domainMatch) {
                guardrails.push(...delegation.guardrails);
            }
        }
        return guardrails;
    }
    /**
     * Lists all active delegations for a grantee.
     */
    listDelegationsForGrantee(granteeId, now = nowIso()) {
        return listActiveGovernanceDelegations(this.delegations, now)
            .filter((item) => item.granteeId === granteeId);
    }
    /**
     * Validates governance inheritance rules per §51.2.
     * Returns true if the action is valid given the hierarchy.
     */
    validateInheritanceRule(parentRole, childRole, action) {
        // Hierarchy: platform_team > division_admin > department_admin > team_lead
        const hierarchy = [
            "platform_team",
            "division_admin",
            "department_admin",
            "team_lead",
        ];
        const parentIndex = hierarchy.indexOf(parentRole);
        const childIndex = hierarchy.indexOf(childRole);
        // Child cannot perform actions reserved for parent
        if (childIndex < parentIndex) {
            return { allowed: false, reason: "Insufficient role level" };
        }
        switch (action) {
            case "tighten":
                // Anyone can tighten (lower risk, lower budget)
                return { allowed: true, reason: "Tightening allowed" };
            case "loosen":
                // Only parent can loosen (higher risk, higher budget)
                if (childIndex > parentIndex) {
                    return { allowed: false, reason: "Lower roles cannot loosen restrictions" };
                }
                return { allowed: true, reason: "Loosening allowed for parent role" };
            case "append":
                // Anyone can append constraints
                return { allowed: true, reason: "Appending constraints allowed" };
            case "delete":
                // Only the role that set it can delete (must check grantorId)
                return { allowed: true, reason: "Delete subject to ownership check" };
            default:
                return { allowed: false, reason: "Unknown action" };
        }
    }
}
//# sourceMappingURL=delegated-governance-service.js.map