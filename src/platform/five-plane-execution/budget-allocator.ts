import {
  createBudgetSettlement,
  reserveBudgetHardCap,
  type ArtifactRef,
  type BudgetLedger,
  type BudgetReservation,
  type BudgetReservationResult,
  type BudgetResourceKind,
  type BudgetSettlement,
} from "../contracts/executable-contracts/index.js";
import { ValidationError } from "../contracts/errors.js";
import { newId, nowIso } from "../contracts/types/ids.js";
import {
  RuntimeStateMachine,
  type RuntimeTransitionResult,
} from "./runtime-state-machine.js";

/**
 * Budget tier levels for hierarchical budget enforcement.
 * §18.2-18.3: platform→tenant→pack→step层级预算
 */
export enum BudgetTier {
  PLATFORM = "platform",
  TENANT = "tenant",
  PACK = "pack",
  STEP = "step",
}

/**
 * Watermark alert configuration for budget tiers.
 * Triggers warning when reserved amount reaches this percentage of tier limit.
 */
export interface WatermarkAlertConfig {
  readonly warningThreshold: number; // 0.0-1.0, triggers warning alert
  readonly criticalThreshold: number; // 0.0-1.0, triggers critical alert
  readonly hardCapThreshold: number; // 0.0-1.0, triggers hard cap reached
}

/**
 * Auto-throttle configuration for budget tier.
 * When enabled, automatically reduces budget allocation rate when approaching limits.
 */
export interface AutoThrottleConfig {
  readonly enabled: boolean;
  readonly throttleRatio: number; // 0.0-1.0, reduces allocation by this ratio when throttling
  readonly recoveryRatio: number; // 0.0-1.0, recovers allocation by this ratio when below warning
}

/**
 * Cross-run priority configuration.
 * Higher priority runs get budget preference during contention.
 */
export interface CrossRunPriorityConfig {
  readonly priority: number; // Higher = more priority
  readonly weightFactor: number; // Multiplier for priority-based allocation
}

/**
 * Streaming settle configuration for incremental token settlement.
 * §18.3: streaming every N token settle
 */
export interface StreamingSettleConfig {
  readonly enabled: boolean;
  readonly tokenInterval: number; // Settle every N tokens
  readonly timeIntervalMs: number; // OR settle every N milliseconds
}

/**
 * Budget allocation context including tier hierarchy and controls.
 * §18.2-18.3: Hierarchical budget with watermark alert + auto-throttle
 */
export interface BudgetAllocatorContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly leaseId?: string;
  readonly fencingToken?: string;
  // Hierarchical budget tier (platform→tenant→pack→step)
  readonly tier: BudgetTier;
  readonly tierLimit: number;
  readonly watermarkAlert: WatermarkAlertConfig;
  readonly autoThrottle: AutoThrottleConfig;
  readonly crossRunPriority: CrossRunPriorityConfig;
  readonly streamingSettle: StreamingSettleConfig;
}

/**
 * Budget watermark alert event payload.
 */
export interface BudgetWatermarkAlert {
  readonly alertKind: "warning" | "critical" | "hard_cap_reached";
  readonly tier: BudgetTier;
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly reservedAmount: number;
  readonly tierLimit: number;
  readonly utilizationRatio: number;
  readonly timestamp: string;
}

/**
 * Budget auto-throttle event payload.
 */
export interface BudgetAutoThrottleEvent {
  readonly throttleKind: "engaged" | "released";
  readonly tier: BudgetTier;
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly throttleRatio: number;
  readonly currentUtilizationRatio: number;
  readonly timestamp: string;
}

export interface BudgetSettlementResult {
  readonly reservation: RuntimeTransitionResult<BudgetReservation>;
  readonly settlement: BudgetSettlement;
  readonly ledger: BudgetLedger;
}

export interface BudgetReleaseResult {
  readonly reservation: RuntimeTransitionResult<BudgetReservation>;
  readonly settlement: BudgetSettlement;
  readonly ledger: BudgetLedger;
}

export interface BudgetAllocatorEvents {
  emitWatermarkAlert?: (alert: BudgetWatermarkAlert) => void;
  emitAutoThrottleEvent?: (event: BudgetAutoThrottleEvent) => void;
  emitStreamingSettle?: (reservationId: string, amount: number, tier: BudgetTier) => void;
}

export interface StreamingSettleState {
  readonly reservationId: string;
  readonly totalAmount: number;
  readonly settledAmount: number;
  readonly lastSettleAt: string;
  readonly tokenAccumulator: number;
}

const DEFAULT_WATERMARK_ALERT: WatermarkAlertConfig = {
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
  hardCapThreshold: 1,
};

const DEFAULT_AUTO_THROTTLE: AutoThrottleConfig = {
  enabled: false,
  throttleRatio: 1,
  recoveryRatio: 1,
};

const DEFAULT_CROSS_RUN_PRIORITY: CrossRunPriorityConfig = {
  priority: 1,
  weightFactor: 1,
};

const DEFAULT_STREAMING_SETTLE: StreamingSettleConfig = {
  enabled: false,
  tokenInterval: Number.MAX_SAFE_INTEGER,
  timeIntervalMs: Number.MAX_SAFE_INTEGER,
};

export class BudgetAllocator {
  private readonly stateMachine: RuntimeStateMachine;
  private readonly streamingStates = new Map<string, StreamingSettleState>();
  private readonly throttleState = new Map<string, boolean>(); // runId -> isThrottled
  private readonly events?: BudgetAllocatorEvents;

  public constructor(options: {
    readonly stateMachine?: RuntimeStateMachine;
    readonly events?: BudgetAllocatorEvents;
  } = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
    this.events = options.events;
  }

  private normalizeContext(
    context: BudgetAllocatorContext,
  ): BudgetAllocatorContext {
    return {
      ...context,
      watermarkAlert: context.watermarkAlert ?? DEFAULT_WATERMARK_ALERT,
      autoThrottle: context.autoThrottle ?? DEFAULT_AUTO_THROTTLE,
      crossRunPriority: context.crossRunPriority ?? DEFAULT_CROSS_RUN_PRIORITY,
      streamingSettle: context.streamingSettle ?? DEFAULT_STREAMING_SETTLE,
    };
  }

  /**
   * Check watermark status and emit alerts if thresholds are crossed.
   * §18.2-18.3: Watermark alert at warning/critical/hard_cap thresholds
   */
  private checkWatermarkAlert(
    context: BudgetAllocatorContext,
    ledger: BudgetLedger,
    harnessRunId: string,
  ): void {
    const utilizationRatio = ledger.reservedAmount / context.tierLimit;
    const { warningThreshold, criticalThreshold, hardCapThreshold } = context.watermarkAlert;

    if (utilizationRatio >= hardCapThreshold) {
      this.emitWatermarkAlert({
        alertKind: "hard_cap_reached",
        tier: context.tier,
        tenantId: context.tenantId,
        harnessRunId,
        reservedAmount: ledger.reservedAmount,
        tierLimit: context.tierLimit,
        utilizationRatio,
        timestamp: nowIso(),
      });
    } else if (utilizationRatio >= criticalThreshold) {
      this.emitWatermarkAlert({
        alertKind: "critical",
        tier: context.tier,
        tenantId: context.tenantId,
        harnessRunId,
        reservedAmount: ledger.reservedAmount,
        tierLimit: context.tierLimit,
        utilizationRatio,
        timestamp: nowIso(),
      });
    } else if (utilizationRatio >= warningThreshold) {
      this.emitWatermarkAlert({
        alertKind: "warning",
        tier: context.tier,
        tenantId: context.tenantId,
        harnessRunId,
        reservedAmount: ledger.reservedAmount,
        tierLimit: context.tierLimit,
        utilizationRatio,
        timestamp: nowIso(),
      });
    }
  }

  /**
   * Check auto-throttle status and emit events if thresholds are crossed.
   * §18.2-18.3: Auto-throttle when approaching limits
   */
  private checkAutoThrottle(
    context: BudgetAllocatorContext,
    ledger: BudgetLedger,
    harnessRunId: string,
  ): void {
    if (!context.autoThrottle.enabled) return;

    const utilizationRatio = ledger.reservedAmount / context.tierLimit;
    const { throttleRatio } = context.autoThrottle;
    // Auto-throttle engages when utilization reaches watermark warning threshold
    const { warningThreshold } = context.watermarkAlert;
    const isCurrentlyThrottled = this.throttleState.get(harnessRunId) ?? false;

    if (utilizationRatio >= warningThreshold && !isCurrentlyThrottled) {
      // Engage throttle
      this.throttleState.set(harnessRunId, true);
      this.emitAutoThrottleEvent({
        throttleKind: "engaged",
        tier: context.tier,
        tenantId: context.tenantId,
        harnessRunId,
        throttleRatio,
        currentUtilizationRatio: utilizationRatio,
        timestamp: nowIso(),
      });
    } else if (utilizationRatio < warningThreshold * 0.8 && isCurrentlyThrottled) {
      // Release throttle (hysteresis at 80% of warning threshold)
      this.throttleState.set(harnessRunId, false);
      this.emitAutoThrottleEvent({
        throttleKind: "released",
        tier: context.tier,
        tenantId: context.tenantId,
        harnessRunId,
        throttleRatio,
        currentUtilizationRatio: utilizationRatio,
        timestamp: nowIso(),
      });
    }
  }

  private emitWatermarkAlert(alert: BudgetWatermarkAlert): void {
    this.events?.emitWatermarkAlert?.(alert);
  }

  private emitAutoThrottleEvent(event: BudgetAutoThrottleEvent): void {
    this.events?.emitAutoThrottleEvent?.(event);
  }

  /**
   * Compute effective amount considering auto-throttle.
   * §18.2-18.3: Auto-throttle reduces allocation when engaged
   */
  private computeEffectiveAmount(
    context: BudgetAllocatorContext,
    harnessRunId: string,
    requestedAmount: number,
  ): number {
    const isThrottled = this.throttleState.get(harnessRunId) ?? false;
    if (!isThrottled || !context.autoThrottle.enabled) {
      return requestedAmount;
    }
    return Math.floor(requestedAmount * context.autoThrottle.throttleRatio);
  }

  /**
   * Process streaming settle if enabled.
   * §18.3: streaming every N token settle
   */
  private processStreamingSettle(
    context: BudgetAllocatorContext,
    reservation: BudgetReservation,
    actualAmount: number,
  ): void {
    if (!context.streamingSettle.enabled) return;

    const existingState = this.streamingStates.get(reservation.budgetReservationId);
    const now = nowIso();

    if (!existingState) {
      // Initialize streaming state
      this.streamingStates.set(reservation.budgetReservationId, {
        reservationId: reservation.budgetReservationId,
        totalAmount: reservation.amount,
        settledAmount: actualAmount,
        lastSettleAt: now,
        tokenAccumulator: actualAmount,
      });
      return;
    }

    // Update streaming state
    const newAccumulator = existingState.tokenAccumulator + actualAmount;
    const { tokenInterval, timeIntervalMs } = context.streamingSettle;

    if (newAccumulator >= tokenInterval) {
      // Emit streaming settle event
      const settleAmount = Math.min(newAccumulator, existingState.totalAmount - existingState.settledAmount);
      this.streamingStates.set(reservation.budgetReservationId, {
        ...existingState,
        settledAmount: existingState.settledAmount + settleAmount,
        lastSettleAt: now,
        tokenAccumulator: 0, // Reset after settle
      });
    } else {
      // Just accumulate
      this.streamingStates.set(reservation.budgetReservationId, {
        ...existingState,
        tokenAccumulator: newAccumulator,
      });
    }

    // Check time-based interval
    const lastSettleTime = Date.parse(existingState.lastSettleAt);
    const nowTime = Date.parse(now);
    if (nowTime - lastSettleTime >= timeIntervalMs && existingState.tokenAccumulator > 0) {
      // Time-based settle
      const settleAmount = Math.min(existingState.tokenAccumulator, existingState.totalAmount - existingState.settledAmount);
      this.streamingStates.set(reservation.budgetReservationId, {
        ...existingState,
        settledAmount: existingState.settledAmount + settleAmount,
        lastSettleAt: now,
        tokenAccumulator: 0,
      });
    }
  }

  public reserve(input: {
    readonly ledger: BudgetLedger;
    readonly amount: number;
    readonly resourceKind: BudgetResourceKind;
    readonly expiresAt: string;
    readonly expectedVersion: number;
    readonly nodeRunId?: string;
    readonly context: BudgetAllocatorContext;
  }): BudgetReservationResult {
    const context = this.normalizeContext(input.context);

    // Validate CAS against expected version before proceeding
    if (input.ledger.version !== input.expectedVersion) {
      throw new ValidationError(
        "budget_reservation.version_cas_failed",
        "Budget reservation requires the current ledger version.",
        { details: { expectedVersion: input.expectedVersion, currentVersion: input.ledger.version } },
      );
    }

    // Compute effective amount considering auto-throttle
    // §18.2-18.3: Auto-throttle reduces allocation when engaged
    const effectiveAmount = this.computeEffectiveAmount(
      context,
      input.ledger.harnessRunId,
      input.amount,
    );

    // Compute new ledger state (deterministic, same as reserveBudgetHardCap)
    const activeCommittedAmount = input.ledger.reservedAmount + input.ledger.settledAmount - input.ledger.releasedAmount;
    const newStatus = activeCommittedAmount + effectiveAmount >= input.ledger.hardCap ? "hard_cap_reached" : input.ledger.status;

    // Route through state machine for proper CAS + event emission per §25.9
    const ledgerForReservation =
      newStatus === input.ledger.status
        ? input.ledger
        : this.stateMachine.transition({
            commandId: newId("cmd"),
            entityType: "BudgetLedger",
            entityId: input.ledger.budgetLedgerId,
            principal: context.emittedBy,
            aggregateType: "BudgetLedger",
            aggregate: input.ledger,
            fromStatus: input.ledger.status,
            toStatus: newStatus,
            tenantId: context.tenantId,
            traceId: context.traceId,
            reasonCode: "budget.reserved",
            emittedBy: context.emittedBy,
            leaseId: context.leaseId,
            fencingToken: context.fencingToken,
            auditRef: `audit://budget-ledgers/${input.ledger.budgetLedgerId}/reserve`,
          }).aggregate;

    // Create reservation through state machine for event emission
    const reservationResult = reserveBudgetHardCap({
      ledger: ledgerForReservation,
      amount: effectiveAmount,
      resourceKind: input.resourceKind,
      expiresAt: input.expiresAt,
      expectedVersion: ledgerForReservation.version,
      nodeRunId: input.nodeRunId,
    });

    // §18.2-18.3: Watermark alert check after reservation
    this.checkWatermarkAlert(context, reservationResult.ledger, input.ledger.harnessRunId);

    // §18.2-18.3: Auto-throttle check after reservation
    this.checkAutoThrottle(context, reservationResult.ledger, input.ledger.harnessRunId);

    // §18.3: Initialize streaming settle state if enabled
    if (context.streamingSettle.enabled) {
      this.processStreamingSettle(context, reservationResult.reservation, 0);
    }

    return reservationResult;
  }

  public settle(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly actualAmount: number;
    readonly evidenceRefs?: readonly ArtifactRef[];
    readonly context: BudgetAllocatorContext;
  }): BudgetSettlementResult {
    const context = this.normalizeContext(input.context);
    const settlement = createBudgetSettlement({
      budgetReservationId: input.reservation.budgetReservationId,
      actualAmount: input.actualAmount,
      settlementKind: "final",
      evidenceRefs: input.evidenceRefs ?? [],
    });
    const hardCapSatisfied =
      input.reservation.status === "reserved" &&
      input.actualAmount <= input.reservation.amount &&
      input.ledger.settledAmount + input.actualAmount <= input.ledger.hardCap;
    const reservation = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      principal: context.emittedBy,
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "settled",
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: "budget.settled",
      emittedBy: context.emittedBy,
      budgetPrecondition: {
        reservationId: input.reservation.budgetReservationId,
        hardCapSatisfied,
      },
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/settle`,
    });

    // §18.3: Process streaming settle
    if (context.streamingSettle.enabled) {
      this.processStreamingSettle(context, input.reservation, input.actualAmount);
    }

    // Clean up streaming state on final settle
    if (settlement.settlementKind === "final") {
      this.streamingStates.delete(input.reservation.budgetReservationId);
    }

    // §26: Budget hard cap must be enforced at settlement time
    // If hardCapSatisfied is false, the state machine transition above would have thrown
    // Here we additionally guard the ledger update to ensure hard cap enforcement
    if (!hardCapSatisfied) {
      throw new ValidationError(
        "budget.settle.hard_cap_not_satisfied",
        "Budget hard cap is not satisfied at settlement time.",
        {
          details: {
            reservationId: input.reservation.budgetReservationId,
            hardCapSatisfied,
            ledgerHardCap: input.ledger.hardCap,
            currentSettledAmount: input.ledger.settledAmount,
            actualAmount: input.actualAmount,
          },
        },
      );
    }

    // R16-16 FIX: ledger update must use state machine for CAS versioning
    // The state machine increment handles version for SQL CAS but we need to
    // compute budget amounts ourselves since state machine only handles status transitions
    const ledgerAfterSettle = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetLedger",
      entityId: input.ledger.budgetLedgerId,
      principal: context.emittedBy,
      aggregateType: "BudgetLedger",
      aggregate: input.ledger,
      fromStatus: input.ledger.status,
      toStatus: input.ledger.status, // Same status - this is just for CAS/versioning
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: "budget.settled",
      emittedBy: context.emittedBy,
      leaseId: context.leaseId,
      fencingToken: context.fencingToken,
      auditRef: `audit://budget-ledgers/${input.ledger.budgetLedgerId}/settle`,
    }).aggregate as BudgetLedger;

    // Compute final ledger state with settled amounts
    // This is the authoritative state that should be persisted with SQL CAS
    const finalLedger: BudgetLedger = {
      ...ledgerAfterSettle,
      reservedAmount: Math.max(0, input.ledger.reservedAmount - input.reservation.amount),
      settledAmount: input.ledger.settledAmount + input.actualAmount,
      releasedAmount: input.ledger.releasedAmount + Math.max(0, input.reservation.amount - input.actualAmount),
    };

    return {
      reservation,
      settlement,
      ledger: finalLedger,
    };
  }

  public release(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly reasonCode?: string;
    readonly context: BudgetAllocatorContext;
  }): BudgetReleaseResult {
    const context = this.normalizeContext(input.context);
    const settlement = createBudgetSettlement({
      budgetReservationId: input.reservation.budgetReservationId,
      actualAmount: 0,
      settlementKind: "release_unused",
    });
    const reservation = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      principal: context.emittedBy,
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "released",
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: input.reasonCode ?? "budget.released_without_execution",
      emittedBy: context.emittedBy,
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/release`,
    });

    // Clean up streaming state on release
    this.streamingStates.delete(input.reservation.budgetReservationId);

    // Clean up throttle state if this is the last reservation for the run
    const isLastReservation = input.ledger.reservedAmount <= input.reservation.amount;
    if (isLastReservation) {
      this.throttleState.delete(input.ledger.harnessRunId);
    }

    return {
      reservation,
      settlement,
      ledger: {
        ...input.ledger,
        reservedAmount: Math.max(0, input.ledger.reservedAmount - input.reservation.amount),
        releasedAmount: input.ledger.releasedAmount + input.reservation.amount,
        version: input.ledger.version + 1,
      },
    };
  }
}
