import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
export class PolicyCenterService {
    options;
    constructor(options = {}) {
        this.options = {
            policyVersion: options.policyVersion ?? "policy-center.authoritative.v1",
            killSwitchEnabled: options.killSwitchEnabled ?? false,
            frozenActions: options.frozenActions ?? [],
            allowedActionsByRole: options.allowedActionsByRole ?? {},
            subjectRoles: options.subjectRoles ?? {},
            maxEstimatedCostUsd: options.maxEstimatedCostUsd ?? null,
            budgetWarningCostUsd: options.budgetWarningCostUsd ?? null,
            allowedPathPrefixes: options.allowedPathPrefixes ?? [],
            allowedNetworkHosts: options.allowedNetworkHosts ?? [],
            enabledGovernanceActions: options.enabledGovernanceActions ?? [
                "dispatch_execution",
                "set_isolation_level",
                "promote_improvement",
                "advance_rollout",
            ],
            approvalRequiredRiskCategories: options.approvalRequiredRiskCategories ?? [
                "destructive",
                "irreversible",
                "prod_affecting",
                "org_changing",
                "strategy_affecting",
                "governance_sensitive",
            ],
        };
    }
    evaluate(input) {
        validateRequest(input);
        const auditPayload = buildAuditPayload(input);
        if (this.options.killSwitchEnabled) {
            return this.result(input, "deny", "policy.kill_switch_active", false, {}, true, ["kill_switch"], "Kill switch is active.", auditPayload);
        }
        if (this.options.frozenActions.includes(input.action)) {
            return this.result(input, "deny", "policy.action_frozen", false, {}, false, ["freeze.action"], "Action is frozen by policy.", auditPayload);
        }
        if (!this.isActionAllowedByRole(input)) {
            return this.result(input, "deny", "policy.role_action_denied", false, {}, false, ["role_permission"], "Subject role does not allow this action.", auditPayload);
        }
        if (isGovernanceAction(input.action) && !this.options.enabledGovernanceActions.includes(input.action)) {
            return this.result(input, "deny", "policy.governance_plane_disabled", false, {}, false, ["governance_action"], "Governance action is not enabled.", auditPayload);
        }
        const constraints = this.evaluateConstraints(input);
        if (constraints.denyReason != null) {
            return this.result(input, "deny", constraints.denyReason, false, constraints.constraints, false, constraints.matchedRuleRefs, constraints.explainSummary, auditPayload);
        }
        if (this.mustEscalate(input, constraints.requiresApproval)) {
            return this.result(input, "escalate_for_approval", "policy.approval_required", true, constraints.constraints, false, constraints.matchedRuleRefs, "Action requires approval before execution.", auditPayload);
        }
        if (Object.keys(constraints.constraints).length > 0) {
            return this.result(input, "allow_with_constraints", "policy.allow_with_constraints", false, constraints.constraints, false, constraints.matchedRuleRefs, "Action allowed with authoritative constraints.", auditPayload);
        }
        return this.result(input, "allow", "policy.allow", false, {}, false, ["default_allow"], "Action allowed by policy center.", auditPayload);
    }
    isActionAllowedByRole(input) {
        const roles = this.options.subjectRoles[input.subjectId] ?? [];
        const rolePolicyEntries = Object.entries(this.options.allowedActionsByRole);
        if (rolePolicyEntries.length === 0) {
            return true;
        }
        return roles.some((role) => this.options.allowedActionsByRole[role]?.includes(input.action) === true);
    }
    evaluateConstraints(input) {
        const constraints = {};
        const matchedRuleRefs = [];
        const estimatedCostUsd = input.estimatedCostUsd ?? 0;
        if (this.options.maxEstimatedCostUsd != null && estimatedCostUsd > this.options.maxEstimatedCostUsd) {
            return {
                constraints: { maxEstimatedCostUsd: this.options.maxEstimatedCostUsd, requestedCostUsd: estimatedCostUsd },
                denyReason: "policy.budget_exceeded",
                requiresApproval: false,
                matchedRuleRefs: ["budget.max_estimated_cost"],
                explainSummary: "Estimated cost exceeds the configured maximum.",
            };
        }
        let requiresApproval = false;
        if (this.options.budgetWarningCostUsd != null && estimatedCostUsd > this.options.budgetWarningCostUsd) {
            constraints.budgetWarningCostUsd = this.options.budgetWarningCostUsd;
            matchedRuleRefs.push("budget.warning_threshold");
            requiresApproval = true;
        }
        if (input.action === "write_file" && this.options.allowedPathPrefixes.length > 0) {
            const resourceRef = input.resourceRef ?? "";
            if (!this.options.allowedPathPrefixes.some((prefix) => resourceRef.startsWith(prefix))) {
                return {
                    constraints: { allowedPathPrefixes: this.options.allowedPathPrefixes },
                    denyReason: "policy.path_scope_denied",
                    requiresApproval: false,
                    matchedRuleRefs: ["sandbox.path_scope"],
                    explainSummary: "Resource path is outside the allowed path scope.",
                };
            }
            constraints.allowedPathPrefixes = this.options.allowedPathPrefixes;
            matchedRuleRefs.push("sandbox.path_scope");
        }
        if (input.action === "network_access" && this.options.allowedNetworkHosts.length > 0) {
            const host = parseHost(input.resourceRef);
            if (host == null || !this.options.allowedNetworkHosts.includes(host)) {
                return {
                    constraints: { allowedNetworkHosts: this.options.allowedNetworkHosts },
                    denyReason: "policy.network_scope_denied",
                    requiresApproval: false,
                    matchedRuleRefs: ["sandbox.network_scope"],
                    explainSummary: "Network host is outside the allowed network scope.",
                };
            }
            constraints.allowedNetworkHosts = this.options.allowedNetworkHosts;
            matchedRuleRefs.push("sandbox.network_scope");
        }
        return {
            constraints,
            denyReason: null,
            requiresApproval,
            matchedRuleRefs: matchedRuleRefs.length === 0 ? ["constraint.none"] : matchedRuleRefs,
            explainSummary: "Constraints evaluated successfully.",
        };
    }
    mustEscalate(input, constraintRequiresApproval) {
        if (input.mode === "full-auto" && !["governance_sensitive", "prod_affecting", "org_changing"].includes(input.riskCategory)) {
            return constraintRequiresApproval;
        }
        return constraintRequiresApproval || this.options.approvalRequiredRiskCategories.includes(input.riskCategory);
    }
    result(input, decision, reasonCode, requiresApproval, enforcedConstraints, killSwitchApplied, matchedRuleRefs, explainSummary, auditPayload) {
        return {
            decision,
            reasonCode,
            requiresApproval,
            enforcedConstraints,
            killSwitchApplied,
            auditPayload,
            evaluatedPolicyVersion: this.options.policyVersion,
            decisionTtlMs: decision === "deny" ? 30_000 : 5_000,
            matchedRuleRefs,
            explainSummary,
        };
    }
}
function validateRequest(input) {
    for (const [field, value] of Object.entries({
        decisionId: input.decisionId,
        taskId: input.taskId,
        subjectId: input.subjectId,
        action: input.action,
        riskCategory: input.riskCategory,
        mode: input.mode,
        stage: input.stage,
    })) {
        if (typeof value !== "string" || value.trim().length === 0) {
            throw new ValidationError(`policy.${field}_required`, "Policy decision request is missing a required field.", {
                details: { field },
            });
        }
    }
}
function buildAuditPayload(input) {
    return {
        decisionId: input.decisionId,
        taskId: input.taskId,
        executionId: input.executionId ?? null,
        sessionId: input.sessionId ?? null,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        action: input.action,
        resourceRef: input.resourceRef ?? null,
        riskCategory: input.riskCategory,
        mode: input.mode,
        stage: input.stage,
        estimatedCostUsd: input.estimatedCostUsd ?? 0,
        evaluatedAt: nowIso(),
    };
}
function isGovernanceAction(action) {
    return action === "promote_improvement"
        || action === "advance_rollout"
        || action === "modify_knowledge_trust"
        || action === "promote_memory_layer";
}
function parseHost(resourceRef) {
    if (resourceRef == null || resourceRef.trim().length === 0) {
        return null;
    }
    try {
        return new URL(resourceRef).host;
    }
    catch {
        return resourceRef;
    }
}
//# sourceMappingURL=index.js.map