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
import {
  RuntimeStateMachine,
  type RuntimeTransitionResult,
  type RuntimeTransitionCommand,
} from "./runtime-state-machine.js";
import { newId } from "../contracts/types/ids.js";
import { ValidationError } from "../contracts/errors.js";

export interface BudgetAllocatorContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly principal: string;
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

/** R11-06: Watermark alert configuration */
export interface WatermarkAlertConfig {
  readonly softCapPercent: number;    // Percentage of hard cap to trigger warning
  readonly hardCapPercent: number;    // Percentage of hard cap to trigger blocking
  readonly enabled: boolean;
}

/** R11-06: Watermark alert result */
export interface WatermarkAlert {
  readonly triggered: boolean;
  readonly level: "none" | "warning" | "critical";
  readonly message: string;
  readonly percentUsed: number;
}

/** R11-06: Cross-run priority configuration */
export interface CrossRunPriorityConfig {
  readonly enabled: boolean;
  readonly basePriority: number;
  readonly ageWeight: number;        // Weight for wait time in priority calculation
  readonly riskWeight: number;       // Weight for risk level in priority calculation
}

/** R11-06: Reservation expiry sweeper configuration */
export interface ReservationSweeperConfig {
  readonly enabled: boolean;
  readonly sweepIntervalMs: number;
  readonly clockSkewSafetyMarginMs: number;
  readonly maxExpiryAgeMs: number;    // Max age for orphaned reservation detection
}

/** R11-07: Streaming increment result for partial reservation updates */
export interface StreamingIncrementResult {
  readonly reservationId: string;
  readonly incrementalAmount: number;
  readonly totalReserved: number;
  readonly expiresAt: string;
}

const DEFAULT_WATERMARK_CONFIG: WatermarkAlertConfig = {
  softCapPercent: 0.8,   // 80% of hard cap
  hardCapPercent: 0.95,  // 95% of hard cap
  enabled: true,
};

const DEFAULT_CROSS_RUN_PRIORITY: CrossRunPriorityConfig = {
  enabled: false,
  basePriority: 0,
  ageWeight: 0.5,
  riskWeight: 0.5,
};

const DEFAULT_SWEEPER_CONFIG: ReservationSweeperConfig = {
  enabled: true,
  sweepIntervalMs: 60000,           // 1 minute
  clockSkewSafetyMarginMs: 5000,    // 5 seconds
  maxExpiryAgeMs: 300000,           // 5 minutes
};

export class BudgetAllocator {
  private readonly stateMachine: RuntimeStateMachine;
  private readonly watermarkConfig: WatermarkAlertConfig;
  private readonly crossRunPriorityConfig: CrossRunPriorityConfig;
  private readonly sweeperConfig: ReservationSweeperConfig;
  private activeReservations = new Map<string, BudgetReservation>();

  public constructor(options: {
    readonly stateMachine?: RuntimeStateMachine;
    readonly watermarkConfig?: Partial<WatermarkAlertConfig>;
    readonly crossRunPriorityConfig?: Partial<CrossRunPriorityConfig>;
    readonly sweeperConfig?: Partial<ReservationSweeperConfig>;
  } = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
    this.watermarkConfig = { ...DEFAULT_WATERMARK_CONFIG, ...options.watermarkConfig };
    this.crossRunPriorityConfig = { ...DEFAULT_CROSS_RUN_PRIORITY, ...options.crossRunPriorityConfig };
    this.sweeperConfig = { ...DEFAULT_SWEEPER_CONFIG, ...options.sweeperConfig };
  }

  /**
   * R11-06: Check watermark alerts for a ledger
   */
  public checkWatermarkAlert(ledger: BudgetLedger): WatermarkAlert {
    if (!this.watermarkConfig.enabled) {
      return { triggered: false, level: "none", message: "", percentUsed: 0 };
    }

    const usedAmount = ledger.reservedAmount + ledger.settledAmount;
    const percentUsed = ledger.hardCap > 0 ? usedAmount / ledger.hardCap : 0;

    if (percentUsed >= this.watermarkConfig.hardCapPercent) {
      return {
        triggered: true,
        level: "critical",
        message: `Budget hard cap ${(percentUsed * 100).toFixed(1)}% reached`,
        percentUsed,
      };
    }

    if (percentUsed >= this.watermarkConfig.softCapPercent) {
      return {
        triggered: true,
        level: "warning",
        message: `Budget soft cap ${(percentUsed * 100).toFixed(1)}% reached`,
        percentUsed,
      };
    }

    return { triggered: false, level: "none", message: "", percentUsed };
  }

  /**
   * R11-06: Automatic throttling based on watermark level
   * Returns throttle ratio (0 = no throttle, 1 = full block)
   */
  public calculateThrottleRatio(ledger: BudgetLedger): number {
    if (!this.watermarkConfig.enabled) return 0;

    const alert = this.checkWatermarkAlert(ledger);

    if (alert.level === "critical") return 1.0;
    if (alert.level === "warning") return 0.5;
    return 0;
  }

  /**
   * R11-06: Calculate cross-run priority for a reservation
   * Higher priority = more likely to get budget allocation
   */
  public calculateCrossRunPriority(params: {
    readonly harnessRunId: string;
    readonly riskClass: "low" | "medium" | "high" | "critical";
    readonly waitingSinceMs: number;
    readonly basePriority?: number;
  }): number {
    if (!this.crossRunPriorityConfig.enabled) {
      return params.basePriority ?? this.crossRunPriorityConfig.basePriority;
    }

    const riskScore = this.riskClassToScore(params.riskClass);
    const ageScore = Math.min(params.waitingSinceMs / 300000, 1.0); // Normalize to 5 min max

    const priority = this.crossRunPriorityConfig.basePriority +
      (this.crossRunPriorityConfig.ageWeight * ageScore) +
      (this.crossRunPriorityConfig.riskWeight * riskScore);

    return priority;
  }

  private riskClassToScore(riskClass: string): number {
    switch (riskClass) {
      case "low": return 0.25;
      case "medium": return 0.5;
      case "high": return 0.75;
      case "critical": return 1.0;
      default: return 0.5;
    }
  }

  /**
   * R11-07: Reserve budget with automatic expiry sweeper tracking
   * R4-23 FIX: Now uses RuntimeStateMachine.transition() for proper state management
   */
  public reserve(input: {
    readonly ledger: BudgetLedger;
    readonly amount: number;
    readonly resourceKind: BudgetResourceKind;
    readonly expiresAt: string;
    readonly expectedVersion: number;
    readonly nodeRunId?: string;
    readonly streamingIncrement?: boolean;
    readonly context: BudgetAllocatorContext;
  }): BudgetReservationResult {
    const result = reserveBudgetHardCap(input);

    // R11-07: Track reservation for expiry sweeper
    this.activeReservations.set(result.reservation.budgetReservationId, result.reservation);

    return {
      ...result,
    };
  }

  /**
   * R11-07: Streaming increment for partial reservation updates
   * Allows incremental reservation amount increases without full re-reserve
   */
  public streamingIncrement(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly additionalAmount: number;
    readonly context: BudgetAllocatorContext;
  }): StreamingIncrementResult {
    if (input.additionalAmount <= 0) {
      throw new Error("streaming_increment.invalid_amount: Additional amount must be positive");
    }

    const newExpiresAt = new Date(Date.now() + 60000).toISOString(); // Extend by 1 minute

    // R11-07: Update tracked reservation
    const updatedReservation: BudgetReservation = {
      ...input.reservation,
      amount: input.reservation.amount + input.additionalAmount,
      expiresAt: newExpiresAt,
    };
    this.activeReservations.set(input.reservation.budgetReservationId, updatedReservation);

    return {
      reservationId: input.reservation.budgetReservationId,
      incrementalAmount: input.additionalAmount,
      totalReserved: updatedReservation.amount,
      expiresAt: newExpiresAt,
    };
  }

  /**
   * R11-07: Sweep expired reservations and release orphaned ones
   */
  public sweepExpiredReservations(params: {
    readonly activeRunIds: ReadonlySet<string>;
    readonly dbTime: string;
  }): {
    readonly releasedReservationIds: readonly string[];
    readonly expiredReservationIds: readonly string[];
    readonly orphanedCount: number;
  } {
    const dbNow = Date.parse(params.dbTime);
    const releasedIds: string[] = [];
    const expiredIds: string[] = [];

    for (const [reservationId, reservation] of this.activeReservations) {
      const reservationExpiry = Date.parse(reservation.expiresAt);

      // Check if expired (past expiry time with safety margin)
      if (reservationExpiry + this.sweeperConfig.clockSkewSafetyMarginMs <= dbNow) {
        expiredIds.push(reservationId);
        releasedIds.push(reservationId);
        this.activeReservations.delete(reservationId);
        continue;
      }

      // R11-07: Check if orphaned (reservation run is no longer active)
      if (reservation.status === "reserved" && !params.activeRunIds.has(reservation.harnessRunId)) {
        const reservationAge = dbNow - Date.parse(reservation.createdAt);
        if (reservationAge > this.sweeperConfig.maxExpiryAgeMs) {
          releasedIds.push(reservationId);
          this.activeReservations.delete(reservationId);
        }
      }
    }

    return {
      releasedReservationIds: releasedIds,
      expiredReservationIds: expiredIds,
      orphanedCount: releasedIds.length,
    };
  }

  /**
   * R11-07: Get all tracked active reservations
   */
  public getActiveReservations(): readonly BudgetReservation[] {
    return [...this.activeReservations.values()];
  }

  /**
   * R11-12: CAS atomic settle for BudgetLedger
   * Adds expectedVersion parameter to enable SQL-level Compare-and-Swap atomicity
   * for concurrent settle operations to prevent balance inconsistency.
   */
  public settle(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly actualAmount: number;
    readonly expectedVersion: number;
    readonly evidenceRefs?: readonly ArtifactRef[];
    readonly context: BudgetAllocatorContext;
  }): BudgetSettlementResult {
    // R11-12: CAS version check for atomic settle - prevents concurrent modifications
    if (input.ledger.version !== input.expectedVersion) {
      throw new ValidationError(
        "budget_settlement.version_cas_failed",
        "budget_settlement.version_cas_failed: Concurrent settle detected, ledger version mismatch.",
      );
    }

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
    const command: RuntimeTransitionCommand<BudgetReservation> = {
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "settled",
      principal: input.context.principal,
      tenantId: input.context.tenantId,
      traceId: input.context.traceId,
      reasonCode: "budget.settled",
      emittedBy: input.context.emittedBy,
      budgetPrecondition: {
        reservationId: input.reservation.budgetReservationId,
        hardCapSatisfied,
      },
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/settle`,
    };
    const reservation = this.stateMachine.transition(command);

    // R11-07: Remove from active reservations after settle
    this.activeReservations.delete(input.reservation.budgetReservationId);

    return {
      reservation,
      settlement,
      ledger: {
        ...input.ledger,
        reservedAmount: Math.max(0, input.ledger.reservedAmount - input.reservation.amount),
        settledAmount: input.ledger.settledAmount + input.actualAmount,
        releasedAmount: input.ledger.releasedAmount + Math.max(0, input.reservation.amount - input.actualAmount),
        version: input.ledger.version + 1,
      },
    };
  }

  /**
   * R11-12: CAS atomic release for BudgetLedger
   * Adds expectedVersion parameter to enable SQL-level Compare-and-Swap atomicity
   * for concurrent release operations to prevent balance inconsistency.
   */
  public release(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly expectedVersion: number;
    readonly reasonCode?: string;
    readonly context: BudgetAllocatorContext;
  }): BudgetReleaseResult {
    // R11-12: CAS version check for atomic release - prevents concurrent modifications
    if (input.ledger.version !== input.expectedVersion) {
      throw new ValidationError(
        "budget_release.version_cas_failed",
        "budget_release.version_cas_failed: Concurrent release detected, ledger version mismatch.",
      );
    }

    const settlement = createBudgetSettlement({
      budgetReservationId: input.reservation.budgetReservationId,
      actualAmount: 0,
      settlementKind: "release_unused",
    });
    const reservation = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "released",
      principal: input.context.principal,
      tenantId: input.context.tenantId,
      traceId: input.context.traceId,
      reasonCode: input.reasonCode ?? "budget.released_without_execution",
      emittedBy: input.context.emittedBy,
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/release`,
    });

    // R11-07: Remove from active reservations after release
    this.activeReservations.delete(input.reservation.budgetReservationId);

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
