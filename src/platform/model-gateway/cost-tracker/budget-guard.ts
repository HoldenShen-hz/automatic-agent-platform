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
  type BudgetReservation,
  type BudgetReservationResult,
  type BudgetResourceKind,
} from "../../contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../execution/budget-allocator.js";

/**
 * Budget policy defining cost limits and warning thresholds.
 */
export interface BudgetPolicy {
  maxTaskCostUsd: number;
  maxPackCostUsd?: number;
  maxPlatformCostUsd?: number;
  maxDailyCostUsd: number;
  maxMonthlyCostUsd: number;
  maxModelTokens?: number;
  maxSteps?: number;
  maxDurationMs?: number;
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
        request,
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
      request,
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

    const settledLedger = this.sessionManager.settle(sessionId, actualAmount);

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

  public settle(sessionId: string, actualAmount: number): BudgetLedger {
    const session = this.getRequiredSession(sessionId);
    const settled = this.allocator.settle({
      ledger: session.ledger,
      reservation: session.reservation,
      actualAmount,
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
