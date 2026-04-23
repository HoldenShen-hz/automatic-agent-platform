/**
 * Budget Guard
 *
 * Enforces budget policies for task execution costs.
 * Evaluates whether a task can proceed based on current spend
 * and estimated next step cost against configured limits.
 */
/**
 * Budget policy defining cost limits and warning thresholds.
 */
export interface BudgetPolicy {
    maxTaskCostUsd: number;
    maxDailyCostUsd: number;
    maxMonthlyCostUsd: number;
    warnAtRatio: number;
    mode: "supervised" | "auto" | "full-auto";
}
/**
 * Result of a budget evaluation.
 */
export interface BudgetGuardResult {
    allowed: boolean;
    requiresApproval: boolean;
    reasonCode: string | null;
    remainingBudgetUsd: number;
}
/**
 * Evaluates whether a task can proceed given its current cost and next step estimate.
 *
 * Compares projected total cost against the policy limit and determines
 * if the task should proceed, require approval, or be blocked.
 */
export declare class BudgetGuard {
    evaluateTaskSpend(input: {
        policy: BudgetPolicy;
        currentTaskCostUsd: number;
        nextEstimatedCostUsd: number;
    }): BudgetGuardResult;
}
