/**
 * Budget Guard
 *
 * Enforces budget policies for task execution costs.
 * Evaluates whether a task can proceed based on current spend
 * and estimated next step cost against configured limits.
 */

import {
  createBudgetLedger,
  type BudgetLedger,
  type BudgetReservationResult,
  type BudgetResourceKind,
} from "../../contracts/executable-contracts/index.js";
import { BudgetAllocator, BudgetTier } from "../../five-plane-execution/budget-allocator.js";

/**
 * Budget policy defining cost limits and warning thresholds.
 * §18: Implements three-level budget hierarchy - platform/pack/step
 * §18.3: Independent limits for max_model_tokens, max_steps, max_duration_ms
 */
export interface BudgetPolicy {
  /** Task-level budget limit in USD */
  maxTaskCostUsd: number;
  /** Pack-level budget limit (aggregated task group) */
  maxPackCostUsd: number;
  /** Platform-level budget limit (global) */
  maxPlatformCostUsd: number;
  /** Legacy daily cost limit (deprecated, use maxPlatformCostUsd) */
  maxDailyCostUsd: number;
  /** Legacy monthly cost limit (deprecated, use maxPlatformCostUsd) */
  maxMonthlyCostUsd: number;
  /** §18.3: Independent limit for maximum model tokens per task */
  maxModelTokens: number;
  /** §18.3: Independent limit for maximum execution steps per task */
  maxSteps: number;
  /** §18.3: Independent limit for maximum execution duration in milliseconds */
  maxDurationMs: number;
  warnAtRatio: number;
  mode: "supervised" | "auto" | "full-auto";
}

/** Budget scope levels per §18 hierarchy */
export type BudgetScope = "task" | "pack" | "platform";

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
  /** Current pack-level accumulated cost */
  readonly currentPackCostUsd: number;
  /** Current platform-level accumulated cost */
  readonly currentPlatformCostUsd: number;
  /** Legacy daily cost (deprecated) */
  readonly currentDailyCostUsd: number;
  /** Legacy monthly cost (deprecated) */
  readonly currentMonthlyCostUsd: number;
}

export interface BudgetGuardCascadeResult extends BudgetGuardResult {
  readonly projectedTaskCostUsd: number;
  readonly projectedPackCostUsd: number;
  readonly projectedPlatformCostUsd: number;
  readonly projectedDailyCostUsd: number;
  readonly projectedMonthlyCostUsd: number;
  readonly violatedScope: "task" | "pack" | "platform" | "daily" | "monthly" | null;
  readonly warningScopes: readonly ("task" | "pack" | "platform" | "daily" | "monthly")[];
}

export interface BudgetReservationRequest {
  readonly policy: BudgetPolicy;
  readonly spend: ExecutionChainBudgetSpend;
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly ledger?: BudgetLedger;
  readonly resourceKind?: BudgetResourceKind;
  readonly expiresAt?: string;
}

export interface BudgetReservationExecutionResult extends BudgetGuardCascadeResult {
  readonly ledger: BudgetLedger;
  readonly reservation: BudgetReservationResult["reservation"] | null;
  readonly reservationReasonCode: string | null;
}

interface NormalizedBudgetPolicy extends BudgetPolicy {
  readonly maxPackCostUsd: number;
  readonly maxPlatformCostUsd: number;
}

interface NormalizedExecutionChainBudgetSpend extends ExecutionChainBudgetSpend {
  readonly currentPackCostUsd: number;
  readonly currentPlatformCostUsd: number;
}

function normalizePolicy(policy: BudgetPolicy): NormalizedBudgetPolicy {
  return {
    ...policy,
    // Legacy callers may not provide pack/platform caps yet. Keep their
    // projected values observable without fabricating new enforcement scopes.
    maxPackCostUsd: Number.isFinite(policy.maxPackCostUsd) ? policy.maxPackCostUsd : Number.POSITIVE_INFINITY,
    maxPlatformCostUsd: Number.isFinite(policy.maxPlatformCostUsd) ? policy.maxPlatformCostUsd : Number.POSITIVE_INFINITY,
  };
}

function normalizeSpend(spend: ExecutionChainBudgetSpend): NormalizedExecutionChainBudgetSpend {
  return {
    ...spend,
    currentPackCostUsd: Number.isFinite(spend.currentPackCostUsd) ? spend.currentPackCostUsd : spend.currentTaskCostUsd,
    currentPlatformCostUsd: Number.isFinite(spend.currentPlatformCostUsd) ? spend.currentPlatformCostUsd : spend.currentDailyCostUsd,
  };
}

/**
 * Evaluates whether a task can proceed given its current cost and next step estimate.
 *
 * Compares projected total cost against the policy limit and determines
 * if the task should proceed, require approval, or be blocked.
 */
export class BudgetGuard {
  private readonly allocator: BudgetAllocator;

  public constructor(options: { readonly allocator?: BudgetAllocator } = {}) {
    this.allocator = options.allocator ?? new BudgetAllocator();
  }

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
    const policy = normalizePolicy(input.policy);
    const spend = normalizeSpend(input.spend);
    const next = spend.nextEstimatedCostUsd;
    // §18: Three-level budget hierarchy - task/pack/platform
    const projectedTask = spend.currentTaskCostUsd + next;
    const projectedPack = spend.currentPackCostUsd + next;
    const projectedPlatform = spend.currentPlatformCostUsd + next;
    const projectedDaily = spend.currentDailyCostUsd + next;
    const projectedMonthly = spend.currentMonthlyCostUsd + next;

    const checks = [
      { scope: "task" as const, projected: projectedTask, limit: policy.maxTaskCostUsd },
      { scope: "pack" as const, projected: projectedPack, limit: policy.maxPackCostUsd },
      { scope: "platform" as const, projected: projectedPlatform, limit: policy.maxPlatformCostUsd },
      { scope: "daily" as const, projected: projectedDaily, limit: policy.maxDailyCostUsd },
      { scope: "monthly" as const, projected: projectedMonthly, limit: policy.maxMonthlyCostUsd },
    ];
    const violation = checks.find((check) => check.projected > check.limit) ?? null;
    const warningScopes = checks
      .filter((check) => check.projected >= check.limit * input.policy.warnAtRatio)
      .map((check) => check.scope);
    const remainingBudgetUsd = Math.max(
      0,
      Math.min(
        input.policy.maxTaskCostUsd - projectedTask,
        policy.maxPackCostUsd - projectedPack,
        policy.maxPlatformCostUsd - projectedPlatform,
        policy.maxDailyCostUsd - projectedDaily,
        policy.maxMonthlyCostUsd - projectedMonthly,
      ),
    );

    if (violation != null) {
      return {
        allowed: false,
        requiresApproval: false,
        reasonCode: `budget.${violation.scope}_limit_exceeded`,
        remainingBudgetUsd,
        projectedTaskCostUsd: projectedTask,
        projectedPackCostUsd: projectedPack,
        projectedPlatformCostUsd: projectedPlatform,
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
      projectedPackCostUsd: projectedPack,
      projectedPlatformCostUsd: projectedPlatform,
      projectedDailyCostUsd: projectedDaily,
      projectedMonthlyCostUsd: projectedMonthly,
      violatedScope: null,
      warningScopes,
    };
  }

  public reserveExecutionChainBudget(input: BudgetReservationRequest): BudgetReservationExecutionResult {
    const evaluation = this.evaluateExecutionChain({
      policy: input.policy,
      spend: input.spend,
    });
    const ledger = input.ledger ?? createBudgetLedger({
      tenantId: input.tenantId,
      harnessRunId: input.harnessRunId,
      currency: "USD",
      hardCap: input.policy.maxTaskCostUsd,
      softCap: Number((input.policy.maxTaskCostUsd * input.policy.warnAtRatio).toFixed(4)),
    });

    if (!evaluation.allowed || input.spend.nextEstimatedCostUsd <= 0) {
      return {
        ...evaluation,
        ledger,
        reservation: null,
        reservationReasonCode: evaluation.reasonCode,
      };
    }

    const reserved = this.allocator.reserve({
      ledger,
      amount: Number(input.spend.nextEstimatedCostUsd.toFixed(4)),
      resourceKind: input.resourceKind ?? "token",
      expiresAt: input.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      expectedVersion: ledger.version,
      context: {
        tenantId: input.tenantId,
        traceId: input.traceId,
        emittedBy: input.emittedBy,
        tier: BudgetTier.PACK,
        tierLimit: input.policy.maxTaskCostUsd,
        watermarkAlert: { warningThreshold: input.policy.warnAtRatio, criticalThreshold: 1, hardCapThreshold: 1 },
        autoThrottle: { enabled: false, throttleRatio: 1, recoveryRatio: 0 },
        crossRunPriority: { priority: 0, weightFactor: 1 },
        streamingSettle: { enabled: false, tokenInterval: 1000, timeIntervalMs: 60000 },
      },
    });

    return {
      ...evaluation,
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      reservationReasonCode: "budget.reserved_pre_execution",
    };
  }
}
