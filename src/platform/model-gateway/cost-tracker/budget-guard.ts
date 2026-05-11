/**
 * Budget Guard
 *
 * Enforces budget policies for task execution costs.
 * Evaluates whether a task can proceed based on current spend
 * and estimated next step cost against configured limits.
 */

import { newId } from "../../contracts/types/ids.js";
import {
  createBudgetLedger,
  type BudgetLedger,
  type BudgetReservation,
  type BudgetReservationResult,
  type BudgetResourceKind,
} from "../../contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../execution/budget-allocator.js";

/**
 * Budget policy defining cost limits and warning thresholds.
 * R2-6: 3-level hierarchy - platform / pack / step
 *
 * R23-61: Updated to use non-deprecated fields:
 * - maxPlatformCostUsd (replaces deprecated platformBudget)
 * - maxPackCostUsd (replaces deprecated packBudget)
 * - maxStepCostUsd (replaces deprecated stepBudget)
 *
 * R23-62: mode field expanded to 8 values per contract:
 * supervised, auto, full-auto, preview, simulation, audit, enforcement, learning
 */
export interface BudgetPolicy {
  /** Platform-level hard cap (top-level budget ceiling). Defaults to 0 (disabled). */
  maxPlatformCostUsd?: number;
  /** Pack-level budget cap (optional intermediate limit) */
  maxPackCostUsd?: number;
  /** Step-level budget cap (optional per-step limit) */
  maxStepCostUsd?: number;
  /** R23-64: Optional per-stage budgets across the OAPEFLIR loop */
  stageBudgets?: readonly StageBudgetPolicy[];
  maxTaskCostUsd: number;
  maxDailyCostUsd: number;
  maxMonthlyCostUsd: number;
  maxModelTokens?: number;
  maxSteps?: number;
  maxDurationMs?: number;
  warnAtRatio: number;
  /** R23-73: Named cost-estimation templates available to the runtime */
  costEstimationTemplates?: readonly CostEstimationTemplate[];
  /** R23-74: Cost isolation between platform governance spend and BYOK/user-model spend */
  byokCostIsolation?: ByokCostIsolationPolicy;
  /** R23-62: Expanded to 8 values: supervised, auto, full-auto, preview, simulation, audit, enforcement, learning */
  mode: "supervised" | "auto" | "full-auto" | "preview" | "simulation" | "audit" | "enforcement" | "learning";
}

export type BudgetExecutionStage =
  | "observe"
  | "assess"
  | "plan"
  | "execute"
  | "feedback"
  | "learn"
  | "improve"
  | "release";

export interface StageBudgetPolicy {
  readonly stage: BudgetExecutionStage;
  readonly maxCostUsd: number;
  readonly warnAtRatio?: number;
  readonly approvalThresholdUsd?: number;
}

export interface CostEstimationTemplate {
  readonly templateId: "passthrough" | "fast" | "standard" | "full";
  readonly description: string;
  readonly confidence: "low" | "medium" | "high";
  readonly multiplier: number;
}

export interface ByokCostIsolationPolicy {
  readonly enabled: boolean;
  readonly platformGovernanceBudgetUsd?: number;
  readonly userModelBudgetUsd?: number;
  readonly defaultChargeTarget: "platform_governance" | "tenant_model" | "split";
}

export interface CostEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly traceId: string;
  readonly stage: BudgetExecutionStage;
  readonly scope: "platform" | "pack" | "step";
  readonly totalCostUsd: number;
  readonly platformGovernanceCostUsd: number;
  readonly tenantModelCostUsd: number;
  readonly packId?: string;
  readonly stepId?: string;
  readonly byok: boolean;
  readonly templateId?: CostEstimationTemplate["templateId"];
  readonly recordedAt: string;
  readonly metadata?: Record<string, unknown>;
}

export const DEFAULT_COST_ESTIMATION_TEMPLATES: readonly CostEstimationTemplate[] = [
  { templateId: "passthrough", description: "Use provider estimate as-is", confidence: "low", multiplier: 1 },
  { templateId: "fast", description: "Low-latency estimate for lightweight steps", confidence: "medium", multiplier: 1.05 },
  { templateId: "standard", description: "Balanced estimate for normal executions", confidence: "medium", multiplier: 1.15 },
  { templateId: "full", description: "Conservative estimate with governance overhead", confidence: "high", multiplier: 1.3 },
];

export function actualizeCostEvent(input: {
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly traceId: string;
  readonly stage: BudgetExecutionStage;
  readonly scope: CostEvent["scope"];
  readonly observedCostUsd: number;
  readonly governanceOverheadUsd?: number;
  readonly byok?: boolean;
  readonly templateId?: CostEstimationTemplate["templateId"];
  readonly packId?: string;
  readonly stepId?: string;
  readonly recordedAt: string;
  readonly metadata?: Record<string, unknown>;
  readonly policy?: Pick<BudgetPolicy, "byokCostIsolation">;
}): CostEvent {
  const governanceOverheadUsd = Math.max(0, input.governanceOverheadUsd ?? 0);
  const observedCostUsd = Math.max(0, input.observedCostUsd);
  const byok = input.byok ?? false;
  const split = input.policy?.byokCostIsolation?.defaultChargeTarget ?? "split";
  let platformGovernanceCostUsd = governanceOverheadUsd;
  let tenantModelCostUsd = observedCostUsd;

  if (!byok || split === "platform_governance") {
    platformGovernanceCostUsd = observedCostUsd + governanceOverheadUsd;
    tenantModelCostUsd = 0;
  } else if (split === "tenant_model") {
    platformGovernanceCostUsd = 0;
    tenantModelCostUsd = observedCostUsd + governanceOverheadUsd;
  }

  return {
    eventId: newId("cost_evt"),
    tenantId: input.tenantId,
    harnessRunId: input.harnessRunId,
    traceId: input.traceId,
    stage: input.stage,
    scope: input.scope,
    totalCostUsd: Number((platformGovernanceCostUsd + tenantModelCostUsd).toFixed(4)),
    platformGovernanceCostUsd: Number(platformGovernanceCostUsd.toFixed(4)),
    tenantModelCostUsd: Number(tenantModelCostUsd.toFixed(4)),
    ...(input.packId != null ? { packId: input.packId } : {}),
    ...(input.stepId != null ? { stepId: input.stepId } : {}),
    byok,
    ...(input.templateId != null ? { templateId: input.templateId } : {}),
    recordedAt: input.recordedAt,
    ...(input.metadata != null ? { metadata: input.metadata } : {}),
  };
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
  readonly stage?: BudgetExecutionStage;
}

export type BudgetViolationScope = "task" | "daily" | "monthly" | "platform" | "pack" | "step" | "stage";

export interface BudgetGuardCascadeResult extends BudgetGuardResult {
  readonly projectedTaskCostUsd: number;
  readonly projectedDailyCostUsd: number;
  readonly projectedMonthlyCostUsd: number;
  /** R2-6: Scope that violated the budget limit */
  readonly violatedScope: BudgetViolationScope | null;
  /** R2-6: Warning scopes approaching their limits */
  readonly warningScopes: readonly BudgetViolationScope[];
}

export interface BudgetReservationRequest {
  readonly policy: BudgetPolicy;
  readonly spend: ExecutionChainBudgetSpend;
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  /** R2-6: Pack identifier for pack-level budget tracking */
  readonly packId?: string;
  /** R2-6: Step identifier for step-level budget tracking */
  readonly stepId?: string;
  readonly ledger?: BudgetLedger;
  readonly resourceKind?: BudgetResourceKind;
  readonly expiresAt?: string;
}

export interface BudgetReservationExecutionResult extends BudgetGuardCascadeResult {
  readonly ledger: BudgetLedger;
  readonly reservation: BudgetReservationResult["reservation"] | null;
  readonly reservationReasonCode: string | null;
}

export interface BudgetExecutionSession {
  readonly sessionId: string;
  readonly state: "reserved" | "executing" | "settled";
  readonly ledger: BudgetLedger;
  readonly reservation: BudgetReservation;
  readonly request: BudgetReservationRequest;
}

/**
 * Atomic budget state machine states.
 */
export type BudgetStateMachineState = "idle" | "reserved" | "executing" | "settled" | "released";

/**
 * Atomic budget execution session with state machine.
 * Provides reserve→execute→settle atomic flow per R8-01.
 */
export interface AtomicBudgetSession {
  readonly sessionId: string;
  readonly state: BudgetStateMachineState;
  readonly ledger: BudgetLedger;
  readonly reservation: BudgetReservation | null;
  readonly reservedAmount: number;
  readonly actualAmount: number | null;
  readonly request: BudgetReservationRequest;
}

/**
 * Result of atomic budget state transition.
 */
export interface BudgetStateTransitionResult {
  readonly session: AtomicBudgetSession;
  readonly success: boolean;
  readonly reasonCode: string | null;
  error?: Error;
}

/**
 * Evaluates whether a task can proceed given its current cost and next step estimate.
 *
 * Compares projected total cost against the policy limit and determines
 * if the task should proceed, require approval, or be blocked.
 */
export class BudgetGuard {
  private readonly allocator: BudgetAllocator;
  private readonly sessionManager: BudgetExecutionSessionManager;
  private readonly atomicSessions = new Map<string, AtomicBudgetSession>();

  public constructor(options: { readonly allocator?: BudgetAllocator } = {}) {
    this.allocator = options.allocator ?? new BudgetAllocator();
    this.sessionManager = new BudgetExecutionSessionManager({ allocator: this.allocator });
  }

  /**
   * Atomically reserve budget and create an execution session.
   * This is the entry point for the reserve→execute→settle state machine.
   */
  public atomicReserve(input: BudgetReservationRequest): BudgetStateTransitionResult {
    const evaluation = this.evaluateExecutionChain({
      policy: input.policy,
      spend: input.spend,
    });

    if (!evaluation.allowed || input.spend.nextEstimatedCostUsd <= 0) {
      const session: AtomicBudgetSession = {
        sessionId: newId("abs"),
        state: "idle",
        ledger: input.ledger ?? createBudgetLedger({
          tenantId: input.tenantId,
          harnessRunId: input.harnessRunId,
          currency: "USD",
          hardCap: input.policy.maxTaskCostUsd,
          softCap: Number((input.policy.maxTaskCostUsd * input.policy.warnAtRatio).toFixed(4)),
        }),
        reservation: null,
        reservedAmount: 0,
        actualAmount: null,
        request: input,
      };
      this.atomicSessions.set(session.sessionId, session);
      return {
        session,
        success: false,
        reasonCode: evaluation.reasonCode,
      };
    }

    const session = this.sessionManager.reserveAndCreateSession(
      input,
      Number(input.spend.nextEstimatedCostUsd.toFixed(4)),
    );

    const atomicSession: AtomicBudgetSession = {
      sessionId: session.sessionId,
      state: "reserved",
      ledger: session.ledger,
      reservation: session.reservation,
      reservedAmount: input.spend.nextEstimatedCostUsd,
      actualAmount: null,
      request: session.request,
    };
    this.atomicSessions.set(atomicSession.sessionId, atomicSession);

    return {
      session: atomicSession,
      success: true,
      reasonCode: "budget.reserved",
    };
  }

  /**
   * Transition session from reserved to executing state.
   * This marks the beginning of actual execution.
   */
  public atomicExecute(sessionId: string): BudgetStateTransitionResult {
    const session = this.atomicSessions.get(sessionId);
    if (!session) {
      return {
        session: this.createErrorSession(sessionId, "idle", "budget.session_not_found"),
        success: false,
        reasonCode: "budget.session_not_found",
      };
    }

    if (session.state !== "reserved") {
      return {
        session: this.createErrorSession(sessionId, session.state, `budget.invalid_state_transition:${session.state}→executing`),
        success: false,
        reasonCode: `budget.invalid_state_transition:${session.state}→executing`,
      };
    }

    const updatedSession: AtomicBudgetSession = {
      ...session,
      state: "executing",
    };
    this.atomicSessions.set(sessionId, updatedSession);

    return {
      session: updatedSession,
      success: true,
      reasonCode: "budget.executing",
    };
  }

  /**
   * Transition session from executing to settled state with actual cost.
   * This finalizes the budget consumption.
   */
  public atomicSettle(sessionId: string, actualAmount: number): BudgetStateTransitionResult {
    const session = this.atomicSessions.get(sessionId);
    if (!session) {
      return {
        session: this.createErrorSession(sessionId, "idle", "budget.session_not_found"),
        success: false,
        reasonCode: "budget.session_not_found",
      };
    }

    if (session.state !== "executing" && session.state !== "reserved") {
      return {
        session: this.createErrorSession(sessionId, session.state, `budget.invalid_state_transition:${session.state}→settled`),
        success: false,
        reasonCode: `budget.invalid_state_transition:${session.state}→settled`,
      };
    }

    if (!session.reservation) {
      return {
        session: this.createErrorSession(sessionId, session.state, "budget.no_reservation_to_settle"),
        success: false,
        reasonCode: "budget.no_reservation_to_settle",
      };
    }

    const settledLedger = await this.sessionManager.settle(sessionId, actualAmount);

    const updatedSession: AtomicBudgetSession = {
      ...session,
      state: "settled",
      ledger: settledLedger,
      actualAmount,
    };
    this.atomicSessions.set(sessionId, updatedSession);

    return {
      session: updatedSession,
      success: true,
      reasonCode: "budget.settled",
    };
  }

  /**
   * Release a reserved session without execution (e.g., task cancelled).
   */
  public atomicRelease(sessionId: string): BudgetStateTransitionResult {
    const session = this.atomicSessions.get(sessionId);
    if (!session) {
      return {
        session: this.createErrorSession(sessionId, "idle", "budget.session_not_found"),
        success: false,
        reasonCode: "budget.session_not_found",
      };
    }

    if (session.state === "settled" || session.state === "released") {
      return {
        session: this.createErrorSession(sessionId, session.state, `budget.invalid_state_transition:${session.state}→released`),
        success: false,
        reasonCode: `budget.invalid_state_transition:${session.state}→released`,
      };
    }

    const releasedLedger = this.sessionManager.settle(sessionId, 0);

    const updatedSession: AtomicBudgetSession = {
      ...session,
      state: "released",
      ledger: releasedLedger,
      actualAmount: 0,
    };
    this.atomicSessions.set(sessionId, updatedSession);

    return {
      session: updatedSession,
      success: true,
      reasonCode: "budget.released",
    };
  }

  /**
   * Get the current atomic session state.
   */
  public getAtomicSession(sessionId: string): AtomicBudgetSession | null {
    return this.atomicSessions.get(sessionId) ?? null;
  }

  private createErrorSession(sessionId: string, state: BudgetStateMachineState, reasonCode: string): AtomicBudgetSession {
    return {
      sessionId,
      state,
      ledger: createBudgetLedger({
        tenantId: "unknown",
        harnessRunId: "unknown",
        currency: "USD",
        hardCap: 0,
        softCap: 0,
      }),
      reservation: null,
      reservedAmount: 0,
      actualAmount: null,
      request: {
        policy: {
          maxTaskCostUsd: 0,
          maxDailyCostUsd: 0,
          maxMonthlyCostUsd: 0,
          warnAtRatio: 0.8,
          mode: "auto",
        },
        spend: {
          currentTaskCostUsd: 0,
          nextEstimatedCostUsd: 0,
          currentDailyCostUsd: 0,
          currentMonthlyCostUsd: 0,
        },
        tenantId: "unknown",
        harnessRunId: "unknown",
        traceId: "unknown",
        emittedBy: "budget-guard",
      },
    };
  }

  /**
   * Executes a task with atomic budget reservation→execute→settle flow.
   * Returns the settled ledger and actual cost, or an error result.
   *
   * R8-01 FIX: Provides atomic reserve→execute→settle flow that was missing.
   * Budget evaluation is now stateful with proper reservation lifecycle.
   *
   * @param request - Budget reservation request with policy and spend info
   * @param executeFn - Function to execute after budget is reserved
   * @returns Result containing settled ledger and actual amount, or error
   */
  public async executeWithBudget(
    request: BudgetReservationRequest,
    executeFn: () => Promise<unknown>,
  ): Promise<{
    success: boolean;
    ledger: BudgetLedger;
    actualAmount: number;
    error?: string;
  }> {
    // Phase 1: Reserve budget atomically
    const reserveResult = this.atomicReserve(request);
    if (!reserveResult.success) {
      return {
        success: false,
        ledger: reserveResult.session.ledger,
        actualAmount: 0,
        error: reserveResult.reasonCode ?? "budget.reservation_failed",
      };
    }

    // Phase 2: Transition to executing state
    const executeResult = this.atomicExecute(reserveResult.session.sessionId);
    if (!executeResult.success) {
      // Release reserved budget on failure
      this.atomicRelease(reserveResult.session.sessionId);
      return {
        success: false,
        ledger: executeResult.session.ledger,
        actualAmount: 0,
        error: executeResult.reasonCode ?? "budget.execute_failed",
      };
    }

    // Phase 3: Execute the task
    let actualCost = 0;
    try {
      await executeFn();
      // Estimate actual cost based on spend (in production, this would come from actual metering)
      actualCost = request.spend.nextEstimatedCostUsd;
    } catch (err) {
      // Release on execution failure
      this.atomicRelease(reserveResult.session.sessionId);
      return {
        success: false,
        ledger: reserveResult.session.ledger,
        actualAmount: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // Phase 4: Settle with actual cost
    const settleResult = this.atomicSettle(reserveResult.session.sessionId, actualCost);
    if (settleResult.success) {
      return {
        success: true,
        ledger: settleResult.session.ledger,
        actualAmount: settleResult.session.actualAmount ?? actualCost,
      };
    }
    return {
      success: false,
      ledger: settleResult.session.ledger,
      actualAmount: settleResult.session.actualAmount ?? actualCost,
      error: settleResult.reasonCode ?? "budget.settle_failed",
    };
  }

  public evaluateTaskSpend(input: {
    policy: BudgetPolicy;
    currentTaskCostUsd: number;
    nextEstimatedCostUsd: number;
  }): BudgetGuardResult {
    const projected = input.currentTaskCostUsd + input.nextEstimatedCostUsd;
    const remaining = Math.max(0, input.policy.maxTaskCostUsd - projected);

    if (projected >= input.policy.maxTaskCostUsd) {
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

    const checks: { scope: BudgetViolationScope; projected: number; limit: number }[] = [
      { scope: "task", projected: projectedTask, limit: input.policy.maxTaskCostUsd },
      { scope: "daily", projected: projectedDaily, limit: input.policy.maxDailyCostUsd },
      { scope: "monthly", projected: projectedMonthly, limit: input.policy.maxMonthlyCostUsd },
    ];

    // R2-6: 3-level budget hierarchy: add platform/pack/step checks if configured
    if ((input.policy.maxPlatformCostUsd ?? 0) > 0) {
      checks.push({ scope: "platform" as const, projected: projectedTask, limit: input.policy.maxPlatformCostUsd! });
    }
    if (input.policy.maxPackCostUsd != null && input.policy.maxPackCostUsd > 0) {
      checks.push({ scope: "pack" as const, projected: projectedTask, limit: input.policy.maxPackCostUsd });
    }
    if (input.policy.maxStepCostUsd != null && input.policy.maxStepCostUsd > 0) {
      checks.push({ scope: "step" as const, projected: next, limit: input.policy.maxStepCostUsd });
    }
    const stageBudget = input.spend.stage == null
      ? null
      : input.policy.stageBudgets?.find((policy) => policy.stage === input.spend.stage) ?? null;
    if (stageBudget != null && stageBudget.maxCostUsd > 0) {
      checks.push({ scope: "stage", projected: next, limit: stageBudget.maxCostUsd });
    }
    const violation = checks.find((check) => check.projected > check.limit) ?? null;
    const warningScopes = checks
      .filter((check) => {
        const warnAtRatio = check.scope === "stage" && stageBudget?.warnAtRatio != null
          ? stageBudget.warnAtRatio
          : input.policy.warnAtRatio;
        return check.projected >= check.limit * warnAtRatio;
      })
      .map((check) => check.scope);
    const remainingBudgetUsd = Math.max(
      0,
      Math.min(
        input.policy.maxTaskCostUsd - projectedTask,
        input.policy.maxDailyCostUsd - projectedDaily,
        input.policy.maxMonthlyCostUsd - projectedMonthly,
        stageBudget != null ? stageBudget.maxCostUsd - next : Number.POSITIVE_INFINITY,
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
        principal: input.emittedBy,
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

export class BudgetExecutionSessionManager {
  private readonly allocator: BudgetAllocator;
  private readonly sessions = new Map<string, BudgetExecutionSession>();

  public constructor(options: { readonly allocator?: BudgetAllocator } = {}) {
    this.allocator = options.allocator ?? new BudgetAllocator();
  }

  public reserveAndCreateSession(
    request: BudgetReservationRequest,
    amount: number,
  ): BudgetExecutionSession {
    const ledger = request.ledger ?? createBudgetLedger({
      tenantId: request.tenantId,
      harnessRunId: request.harnessRunId,
      currency: "USD",
      hardCap: request.policy.maxTaskCostUsd,
      softCap: Number((request.policy.maxTaskCostUsd * request.policy.warnAtRatio).toFixed(4)),
    });
    const reserved = this.allocator.reserve({
      ledger,
      amount,
      resourceKind: request.resourceKind ?? "token",
      expiresAt: request.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      expectedVersion: ledger.version,
      context: {
        tenantId: request.tenantId,
        traceId: request.traceId,
        emittedBy: request.emittedBy,
        principal: request.emittedBy,
      },
    });
    const session: BudgetExecutionSession = {
      sessionId: reserved.reservation.budgetReservationId,
      state: "reserved",
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      request,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  public markExecuting(sessionId: string): BudgetExecutionSession {
    const session = this.getRequiredSession(sessionId);
    const updated: BudgetExecutionSession = { ...session, state: "executing" };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  public async settle(sessionId: string, actualAmount: number): Promise<BudgetLedger> {
    const session = this.getRequiredSession(sessionId);
    const settled = await this.allocator.settle({
      ledger: session.ledger,
      reservation: session.reservation,
      actualAmount,
      expectedVersion: session.ledger.version, // R11-12: CAS atomic settle
      context: {
        principal: session.request.emittedBy,
        tenantId: session.request.tenantId,
        traceId: session.request.traceId,
        emittedBy: session.request.emittedBy,
      },
    });
    this.sessions.set(sessionId, {
      ...session,
      state: "settled",
      ledger: settled.ledger,
    });
    return settled.ledger;
  }

  public getSession(sessionId: string): BudgetExecutionSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  private getRequiredSession(sessionId: string): BudgetExecutionSession {
    const session = this.sessions.get(sessionId);
    if (session == null) {
      throw new Error(`budget.execution_session_not_found:${sessionId}`);
    }
    return session;
  }
}
