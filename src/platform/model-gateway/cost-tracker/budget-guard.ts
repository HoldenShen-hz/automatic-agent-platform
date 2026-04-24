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

export interface ExecutionChainBudgetSpend {
  readonly currentTaskCostUsd: number;
  readonly nextEstimatedCostUsd: number;
  readonly currentDailyCostUsd: number;
  readonly currentMonthlyCostUsd: number;
}

export interface BudgetGuardCascadeResult extends BudgetGuardResult {
  readonly projectedTaskCostUsd: number;
  readonly projectedDailyCostUsd: number;
  readonly projectedMonthlyCostUsd: number;
  readonly violatedScope: "task" | "daily" | "monthly" | null;
  readonly warningScopes: readonly ("task" | "daily" | "monthly")[];
}

/**
 * Evaluates whether a task can proceed given its current cost and next step estimate.
 *
 * Compares projected total cost against the policy limit and determines
 * if the task should proceed, require approval, or be blocked.
 */
export class BudgetGuard {
  public evaluateTaskSpend(input: {
    policy: BudgetPolicy;
    currentTaskCostUsd: number;
    nextEstimatedCostUsd: number;
  }): BudgetGuardResult {
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

  public evaluateExecutionChain(input: {
    policy: BudgetPolicy;
    spend: ExecutionChainBudgetSpend;
  }): BudgetGuardCascadeResult {
    const next = input.spend.nextEstimatedCostUsd;
    const projectedTask = input.spend.currentTaskCostUsd + next;
    const projectedDaily = input.spend.currentDailyCostUsd + next;
    const projectedMonthly = input.spend.currentMonthlyCostUsd + next;

    const checks = [
      { scope: "task" as const, projected: projectedTask, limit: input.policy.maxTaskCostUsd },
      { scope: "daily" as const, projected: projectedDaily, limit: input.policy.maxDailyCostUsd },
      { scope: "monthly" as const, projected: projectedMonthly, limit: input.policy.maxMonthlyCostUsd },
    ];
    const violation = checks.find((check) => check.projected > check.limit) ?? null;
    const warningScopes = checks
      .filter((check) => check.projected >= check.limit * input.policy.warnAtRatio)
      .map((check) => check.scope);
    const remainingBudgetUsd = Math.max(
      0,
      Math.min(
        input.policy.maxTaskCostUsd - projectedTask,
        input.policy.maxDailyCostUsd - projectedDaily,
        input.policy.maxMonthlyCostUsd - projectedMonthly,
      ),
    );

    if (violation != null) {
      return {
        allowed: false,
        requiresApproval: false,
        reasonCode: `budget.${violation.scope}_limit_exceeded`,
        remainingBudgetUsd,
        projectedTaskCostUsd: projectedTask,
        projectedDailyCostUsd: projectedDaily,
        projectedMonthlyCostUsd: projectedMonthly,
        violatedScope: violation.scope,
        warningScopes,
      };
    }

    return {
      allowed: true,
      requiresApproval: warningScopes.length > 0,
      reasonCode: warningScopes.length > 0 ? "budget.cascade_approaching_limit" : null,
      remainingBudgetUsd,
      projectedTaskCostUsd: projectedTask,
      projectedDailyCostUsd: projectedDaily,
      projectedMonthlyCostUsd: projectedMonthly,
      violatedScope: null,
      warningScopes,
    };
  }
}
