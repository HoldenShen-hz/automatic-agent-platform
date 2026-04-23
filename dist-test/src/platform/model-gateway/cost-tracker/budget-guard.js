/**
 * Budget Guard
 *
 * Enforces budget policies for task execution costs.
 * Evaluates whether a task can proceed based on current spend
 * and estimated next step cost against configured limits.
 */
/**
 * Evaluates whether a task can proceed given its current cost and next step estimate.
 *
 * Compares projected total cost against the policy limit and determines
 * if the task should proceed, require approval, or be blocked.
 */
export class BudgetGuard {
    evaluateTaskSpend(input) {
        const projected = input.currentTaskCostUsd + input.nextEstimatedCostUsd;
        const remaining = Math.max(0, input.policy.maxTaskCostUsd - projected);
        if (projected > input.policy.maxTaskCostUsd) {
            return {
                allowed: false,
                requiresApproval: false,
                reasonCode: "budget.task_limit_exceeded",
                remainingBudgetUsd: remaining,
            };
        }
        const requiresApproval = projected >= input.policy.maxTaskCostUsd * input.policy.warnAtRatio;
        return {
            allowed: true,
            requiresApproval,
            reasonCode: requiresApproval ? "budget.approaching_limit" : null,
            remainingBudgetUsd: remaining,
        };
    }
}
//# sourceMappingURL=budget-guard.js.map