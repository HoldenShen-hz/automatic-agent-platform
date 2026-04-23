/**
 * Policy Engine
 *
 * Unified policy evaluation for security decisions, approvals, and budget guards.
 * This is the central decision point for whether actions are permitted.
 *
 * ## Purpose
 *
 * Consolidates multiple policy concerns into a single evaluation chain:
 * - Role-based permissions
 * - Execution policies
 * - Approval escalation
 * - Budget guards
 * - Kill switch
 *
 * ## Decision Flow
 *
 * For each action, the engine evaluates:
 * 1. Kill switch - if active, all actions are denied
 * 2. Budget check - if action exceeds budget, it's denied
 * 3. Risk assessment - high-risk actions in supervised mode escalate
 * 4. Approval requirement - high-risk actions in auto mode require approval
 * 5. Default outcome - allow with constraints
 *
 * ## Modes
 *
 * - supervised: Human in the loop, high-risk needs explicit approval
 * - auto: Automated execution, high-risk still needs approval
 * - full-auto: Fully automated, no approval required (use with caution)
 *
 * @see docs_zh/contracts/policy_engine_contract.md
 */
import { BudgetGuard } from "../../model-gateway/cost-tracker/budget-guard.js";
import { ValidationError } from "../../contracts/errors.js";
/**
 * Validates PolicyDecisionRequest input fields.
 * V-01: Critical API endpoints must validate input to prevent malformed data.
 */
function validatePolicyRequest(input) {
    if (!input.decisionId || typeof input.decisionId !== "string" || input.decisionId.trim().length === 0) {
        throw new ValidationError("policy.invalid_decision_id", "Policy decision request must have a non-empty decisionId", {
            details: { decisionId: input.decisionId },
        });
    }
    if (!input.taskId || typeof input.taskId !== "string" || input.taskId.trim().length === 0) {
        throw new ValidationError("policy.invalid_task_id", "Policy decision request must have a non-empty taskId", {
            details: { taskId: input.taskId },
        });
    }
    if (!input.subjectId || typeof input.subjectId !== "string" || input.subjectId.trim().length === 0) {
        throw new ValidationError("policy.invalid_subject_id", "Policy decision request must have a non-empty subjectId", {
            details: { subjectId: input.subjectId },
        });
    }
    if (!input.action || typeof input.action !== "string") {
        throw new ValidationError("policy.invalid_action", "Policy decision request must have a valid action", {
            details: { action: input.action },
        });
    }
    if (!input.riskCategory || typeof input.riskCategory !== "string") {
        throw new ValidationError("policy.invalid_risk_category", "Policy decision request must have a valid risk category", {
            details: { riskCategory: input.riskCategory },
        });
    }
    if (!input.mode || typeof input.mode !== "string") {
        throw new ValidationError("policy.invalid_mode", "Policy decision request must have a valid mode", {
            details: { mode: input.mode },
        });
    }
}
/**
 * Policy Engine
 *
 * Evaluates actions against security and budget policies.
 */
export class PolicyEngine {
    options;
    budgetGuard = new BudgetGuard();
    constructor(options) {
        this.options = options;
    }
    /**
     * Evaluates a policy decision request.
     * This is the main entry point for policy evaluation.
     *
     * The evaluation order is:
     * 1. Input validation
     * 2. Kill switch check
     * 3. Budget check
     * 4. Risk-based escalation
     *
     * @param input - The policy decision request
     * @returns The policy decision result
     */
    evaluate(input) {
        // V-01: Validate input before processing
        validatePolicyRequest(input);
        // Step 1: Kill switch check
        if (this.options.killSwitchEnabled) {
            return {
                decision: "deny",
                reasonCode: "policy.kill_switch_active",
                requiresApproval: false,
                enforcedConstraints: {},
                killSwitchApplied: true,
                auditPayload: { action: input.action, subjectId: input.subjectId },
                evaluatedPolicyVersion: "authoritative.v1",
                explainSummary: "Action denied because kill switch is active.",
            };
        }
        // Step 2: Budget check
        const budget = this.evaluateBudget(input);
        if (!budget.allowed) {
            return {
                decision: "deny",
                reasonCode: budget.reasonCode ?? "budget.denied",
                requiresApproval: false,
                enforcedConstraints: {
                    remainingBudgetUsd: budget.remainingBudgetUsd,
                },
                killSwitchApplied: false,
                auditPayload: { action: input.action, estimatedCostUsd: input.estimatedCostUsd ?? 0 },
                evaluatedPolicyVersion: "authoritative.v1",
                explainSummary: "Action denied because task budget would be exceeded.",
            };
        }
        // Step 3: Risk-based escalation
        const isHighRisk = input.riskCategory === "destructive" ||
            input.riskCategory === "irreversible" ||
            input.riskCategory === "prod_affecting" ||
            input.riskCategory === "org_changing";
        // In supervised mode, high-risk or budget-warning actions escalate
        if (input.mode === "supervised" && (isHighRisk || budget.requiresApproval)) {
            return this.escalate(input, budget, "policy.supervised_escalation");
        }
        // In auto mode, high-risk actions require approval
        if (input.mode === "auto" && isHighRisk) {
            return this.escalate(input, budget, "policy.high_risk_requires_approval");
        }
        // Default: allow with constraints
        return {
            decision: "allow_with_constraints",
            reasonCode: budget.requiresApproval ? "policy.allow_under_budget_warning" : "policy.allow",
            requiresApproval: false,
            enforcedConstraints: {
                remainingBudgetUsd: budget.remainingBudgetUsd,
            },
            killSwitchApplied: false,
            auditPayload: {
                action: input.action,
                riskCategory: input.riskCategory,
                estimatedCostUsd: input.estimatedCostUsd ?? 0,
            },
            evaluatedPolicyVersion: "authoritative.v1",
            explainSummary: "Action allowed under current mode and budget constraints.",
        };
    }
    /**
     * Evaluates budget constraints for the action.
     */
    evaluateBudget(input) {
        return this.budgetGuard.evaluateTaskSpend({
            policy: this.options.budgetPolicy,
            currentTaskCostUsd: Number(input.metadata?.currentTaskCostUsd ?? 0),
            nextEstimatedCostUsd: input.estimatedCostUsd ?? 0,
        });
    }
    /**
     * Creates an escalation decision for actions requiring approval.
     */
    escalate(input, budget, reasonCode) {
        return {
            decision: "escalate_for_approval",
            reasonCode,
            requiresApproval: true,
            enforcedConstraints: {
                remainingBudgetUsd: budget.remainingBudgetUsd,
            },
            killSwitchApplied: false,
            auditPayload: {
                action: input.action,
                riskCategory: input.riskCategory,
                estimatedCostUsd: input.estimatedCostUsd ?? 0,
            },
            evaluatedPolicyVersion: "authoritative.v1",
            explainSummary: "Action requires approval under current risk or budget policy.",
        };
    }
}
/**
 * Maps tool risk levels to policy risk categories.
 *
 * @param risk - The tool risk level
 * @returns The corresponding policy risk category
 */
export function mapToolRiskToPolicyCategory(risk) {
    switch (risk) {
        case "critical":
            return "prod_affecting";
        case "high":
            return "destructive";
        case "medium":
            return "cost_sensitive";
        default:
            return "sensitive_data";
    }
}
//# sourceMappingURL=policy-engine.js.map