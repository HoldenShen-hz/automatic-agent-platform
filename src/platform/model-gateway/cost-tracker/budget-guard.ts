/**
 * Budget Guard
 *
 * Enforces budget policies for task execution costs.
 * Evaluates whether a task can proceed based on current spend
 * and estimated next step cost against configured limits.
 *
 * R8-01 FIX: Budget guard now implements atomic reserve→execute→settle state machine
 * with BudgetExecutionSession to prevent concurrent overspend.
 */

import {
  createBudgetLedger,
  type ArtifactRef,
  type BudgetLedger,
  type BudgetReservationResult,
  type BudgetResourceKind,
} from "../../contracts/executable-contracts/index.js";
import { BudgetAllocator, BudgetTier } from "../../five-plane-execution/budget-allocator.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";

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

/**
 * R8-01 FIX: Budget execution session implementing atomic reserve→execute→settle state machine.
 *
 * This prevents concurrent requests from overspending due to race conditions.
 * The state machine enforces:
 *   reserve → execute → settle (or release on failure)
 *
 * States:
 *   reserved: Budget is reserved, execution can proceed
 *   executing: Execution is in progress (informational)
 *   settled: Execution completed, actual cost is finalized
 *   released: Execution failed or cancelled, reservation released
 */
export enum BudgetExecutionState {
  RESERVED = "reserved",
  EXECUTING = "executing",
  SETTLED = "settled",
  RELEASED = "released",
}

/**
 * R8-01 FIX: Budget execution session for atomic reserve→execute→settle.
 *
 * Each session is scoped to a single execution (LLM call or tool call) and
 * ensures budget is properly reserved before execution and settled/released after.
 *
 * Concurrency protection:
 *   - Uses optimistic locking via expectedVersion on the ledger
 *   - CAS check ensures only one session can reserve at a time
 *   - If version mismatch occurs, session is invalidated
 */
export interface BudgetExecutionSession {
  readonly sessionId: string;
  readonly harnessRunId: string;
  readonly ledger: BudgetLedger;
  readonly reservation: BudgetReservationResult["reservation"];
  readonly state: BudgetExecutionState;
  readonly createdAt: string;
  readonly estimatedCostUsd: number;
}

/**
 * Budget execution context for creating sessions.
 */
export interface BudgetExecutionContext {
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly ledger: BudgetLedger;
  readonly policy: BudgetPolicy;
}

/**
 * Budget execution session factory and manager.
 *
 * R8-01: This class manages the lifecycle of budget execution sessions
 * ensuring atomic reserve→execute→settle with proper concurrency protection.
 */
export class BudgetExecutionSessionManager {
  private readonly allocator: BudgetAllocator;
  private readonly activeSessions = new Map<string, BudgetExecutionSession>();

  public constructor(options: { readonly allocator?: BudgetAllocator } = {}) {
    this.allocator = options.allocator ?? new BudgetAllocator();
  }

  /**
   * R8-01: Atomically reserve budget and create execution session.
   *
   * This combines reserve + session creation in one atomic operation to prevent
   * the race condition where two concurrent requests could both pass the budget
   * check before either had reserved.
   *
   * @param context - Execution context (tenant, harness run, ledger, policy)
   * @param estimatedCostUsd - Estimated cost for this execution
   * @param resourceKind - Type of resource (token, tool_call, etc.)
   * @returns Budget execution session if reservation succeeded
   * @throws Error if budget reservation fails due to insufficient funds or CAS conflict
   */
  public reserveAndCreateSession(
    context: BudgetExecutionContext,
    estimatedCostUsd: number,
    resourceKind: BudgetResourceKind = "token",
  ): BudgetExecutionSession {
    const sessionId = newId("budget_session");

    // Atomic reserve using CAS version check
    const reservationResult = this.allocator.reserve({
      ledger: context.ledger,
      amount: Number(estimatedCostUsd.toFixed(4)),
      resourceKind,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      expectedVersion: context.ledger.version,
      context: {
        tenantId: context.tenantId,
        traceId: context.traceId,
        emittedBy: context.emittedBy,
        tier: BudgetTier.STEP,
        tierLimit: context.policy.maxTaskCostUsd,
        watermarkAlert: {
          warningThreshold: context.policy.warnAtRatio,
          criticalThreshold: 0.95,
          hardCapThreshold: 1.0,
        },
        autoThrottle: { enabled: false, throttleRatio: 1, recoveryRatio: 1 },
        crossRunPriority: { priority: 1, weightFactor: 1 },
        streamingSettle: {
          enabled: false,
          tokenInterval: Number.MAX_SAFE_INTEGER,
          timeIntervalMs: Number.MAX_SAFE_INTEGER,
        },
      },
    });

    if (!reservationResult.reservation) {
      throw new ValidationError(
        "budget_session.reserve_failed",
        `Budget reservation failed for harnessRunId ${context.harnessRunId}`,
        { details: { estimatedCostUsd, harnessRunId: context.harnessRunId } },
      );
    }

    const session: BudgetExecutionSession = {
      sessionId,
      harnessRunId: context.harnessRunId,
      ledger: reservationResult.ledger,
      reservation: reservationResult.reservation,
      state: BudgetExecutionState.RESERVED,
      createdAt: nowIso(),
      estimatedCostUsd,
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * R8-01: Transition session to executing state.
   *
   * Called when actual execution begins. This is informational for tracking
   * but helps with debugging and monitoring.
   */
  public markExecuting(sessionId: string): BudgetExecutionSession {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new ValidationError(
        "budget_session.not_found",
        `Budget execution session not found: ${sessionId}`,
      );
    }
    if (session.state !== BudgetExecutionState.RESERVED) {
      throw new ValidationError(
        "budget_session.invalid_state_transition",
        `Cannot transition from ${session.state} to executing`,
        { details: { sessionId, currentState: session.state } },
      );
    }

    const updated: BudgetExecutionSession = {
      ...session,
      state: BudgetExecutionState.EXECUTING,
    };
    this.activeSessions.set(sessionId, updated);
    return updated;
  }

  /**
   * R8-01: Settle session with actual cost.
   *
   * Called when execution completes to finalize the budget consumption.
   * The actual cost may differ from the estimated cost.
   *
   * @param sessionId - Session to settle
   * @param actualCostUsd - Actual cost incurred
   * @param evidenceRefs - Optional evidence references for the settlement
   * @returns Updated ledger state after settlement
   */
  public settle(
    sessionId: string,
    actualCostUsd: number,
    evidenceRefs?: readonly { readonly ref: string }[],
  ): BudgetLedger {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new ValidationError(
        "budget_session.not_found",
        `Budget execution session not found: ${sessionId}`,
      );
    }
    if (session.state !== BudgetExecutionState.RESERVED && session.state !== BudgetExecutionState.EXECUTING) {
      throw new ValidationError(
        "budget_session.invalid_state_transition",
        `Cannot settle session in ${session.state} state`,
        { details: { sessionId, currentState: session.state } },
      );
    }
    if (!session.reservation) {
      throw new ValidationError(
        "budget_session.no_reservation",
        `Session ${sessionId} has no active reservation to settle`,
      );
    }

    const settleResult = this.allocator.settle({
      ledger: session.ledger,
      reservation: session.reservation,
      actualAmount: Number(actualCostUsd.toFixed(4)),
      evidenceRefs: evidenceRefs as readonly ArtifactRef[] | undefined,
      context: {
        tenantId: session.ledger.tenantId,
        traceId: session.harnessRunId,
        emittedBy: "BudgetExecutionSessionManager",
        tier: BudgetTier.STEP,
        tierLimit: session.estimatedCostUsd,
        watermarkAlert: { warningThreshold: 0.8, criticalThreshold: 0.95, hardCapThreshold: 1.0 },
        autoThrottle: { enabled: false, throttleRatio: 1, recoveryRatio: 1 },
        crossRunPriority: { priority: 0, weightFactor: 1 },
        streamingSettle: { enabled: false, tokenInterval: 1000, timeIntervalMs: 60000 },
      },
    });

    // Update session to settled
    const settled: BudgetExecutionSession = {
      ...session,
      state: BudgetExecutionState.SETTLED,
    };
    this.activeSessions.set(sessionId, settled);

    return settleResult.ledger;
  }

  /**
   * R8-01: Release session without settling (on execution failure).
   *
   * Called when execution fails and we want to release the reserved budget
   * back to the pool without settling for actual cost.
   */
  public release(sessionId: string, reasonCode?: string): BudgetLedger {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new ValidationError(
        "budget_session.not_found",
        `Budget execution session not found: ${sessionId}`,
      );
    }
    if (session.state === BudgetExecutionState.RELEASED || session.state === BudgetExecutionState.SETTLED) {
      throw new ValidationError(
        "budget_session.already_finalized",
        `Session ${sessionId} already ${session.state}`,
      );
    }
    if (!session.reservation) {
      // No reservation to release - just remove session
      this.activeSessions.delete(sessionId);
      return session.ledger;
    }

    const releaseResult = this.allocator.release({
      ledger: session.ledger,
      reservation: session.reservation,
      reasonCode: reasonCode ?? "budget_session.execution_failed",
      context: {
        tenantId: session.ledger.tenantId,
        traceId: session.harnessRunId,
        emittedBy: "BudgetExecutionSessionManager",
        tier: BudgetTier.STEP,
        tierLimit: session.estimatedCostUsd,
        watermarkAlert: { warningThreshold: 0.8, criticalThreshold: 0.95, hardCapThreshold: 1.0 },
        autoThrottle: { enabled: false, throttleRatio: 1, recoveryRatio: 1 },
        crossRunPriority: { priority: 0, weightFactor: 1 },
        streamingSettle: { enabled: false, tokenInterval: 1000, timeIntervalMs: 60000 },
      },
    });

    // Update session to released
    const released: BudgetExecutionSession = {
      ...session,
      state: BudgetExecutionState.RELEASED,
    };
    this.activeSessions.set(sessionId, released);

    return releaseResult.ledger;
  }

  /**
   * Get active session by ID.
   */
  public getSession(sessionId: string): BudgetExecutionSession | null {
    return this.activeSessions.get(sessionId) ?? null;
  }

  /**
   * Clean up finalized sessions (settled or released).
   */
  public pruneFinalizedSessions(): void {
    for (const [sessionId, session] of this.activeSessions) {
      if (session.state === BudgetExecutionState.SETTLED || session.state === BudgetExecutionState.RELEASED) {
        this.activeSessions.delete(sessionId);
      }
    }
  }
}
