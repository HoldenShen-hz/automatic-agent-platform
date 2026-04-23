/**
 * Validates if a governance scope matches a delegation.
 */
export function matchesGovernanceScope(delegation, scope) {
    const orgAllowed = delegation.orgNodeIds.length === 0 || delegation.orgNodeIds.includes(scope.orgNodeId);
    const domainAllowed = delegation.domainIds.length === 0 || scope.domainId == null || delegation.domainIds.includes(scope.domainId);
    const capabilityAllowed = delegation.permissions.length === 0 ||
        (scope.permission != null && delegation.permissions.includes(scope.permission));
    return orgAllowed && domainAllowed && capabilityAllowed;
}
/**
 * Checks if a guardrail allows an operation.
 * Platform team guardrails cannot be overridden.
 */
export function evaluateGuardrail(guardrail, attemptedValue) {
    switch (guardrail.type) {
        case "max_risk_level": {
            const maxRisk = guardrail.value;
            const attemptedRisk = attemptedValue;
            const riskOrder = ["low", "medium", "high", "critical"];
            const maxIndex = riskOrder.indexOf(maxRisk);
            const attemptIndex = riskOrder.indexOf(attemptedRisk);
            if (attemptIndex > maxIndex) {
                return { allowed: false, reason: `Risk level ${attemptedRisk} exceeds max ${maxRisk}` };
            }
            return { allowed: true, reason: "Within risk guardrail" };
        }
        case "max_budget": {
            const maxBudget = guardrail.value;
            const attemptedBudget = attemptedValue;
            if (attemptedBudget > maxBudget) {
                return { allowed: false, reason: `Budget ${attemptedBudget} exceeds max ${maxBudget}` };
            }
            return { allowed: true, reason: "Within budget guardrail" };
        }
        case "forbidden_tools": {
            const forbidden = guardrail.value;
            const attempted = attemptedValue;
            if (forbidden.includes(attempted)) {
                return { allowed: false, reason: `Tool ${attempted} is forbidden` };
            }
            return { allowed: true, reason: "Tool not forbidden" };
        }
        case "mandatory_approval": {
            return { allowed: true, reason: "Approval required for this operation" };
        }
        case "min_eval_threshold": {
            const minThreshold = guardrail.value;
            const attemptedThreshold = attemptedValue;
            if (attemptedThreshold < minThreshold) {
                return { allowed: false, reason: `Eval threshold ${attemptedThreshold} below minimum ${minThreshold}` };
            }
            return { allowed: true, reason: "Above eval threshold" };
        }
        default:
            return { allowed: true, reason: "Unknown guardrail type" };
    }
}
/**
 * Checks if an operation is allowed based on §51.3 table.
 */
export function isOperationAllowedByRole(operation, role) {
    const allowedByRole = {
        platform_team: [
            "domain_onboarding",
            "modify_approval_rules",
            "publish_pack",
            "adjust_agent_autonomy",
            "create_trigger",
            "modify_global_guardrails",
            "cross_domain_strategy",
        ],
        division_admin: [
            "domain_onboarding",
            "modify_approval_rules",
            "publish_pack",
            "adjust_agent_autonomy",
            "create_trigger",
        ],
        department_admin: [
            "domain_onboarding",
            "modify_approval_rules",
            "publish_pack",
            "adjust_agent_autonomy",
            "create_trigger",
        ],
        team_lead: [],
    };
    return allowedByRole[role]?.includes(operation) ?? false;
}
//# sourceMappingURL=index.js.map