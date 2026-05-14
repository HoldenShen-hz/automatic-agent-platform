import {
  createPlatformFactEvent,
  createBudgetSettlement,
  reserveBudgetHardCap,
  type ArtifactRef,
  type BudgetLedger,
  type BudgetReservation,
  type BudgetReservationResult,
  type BudgetResourceKind,
  type BudgetSettlement,
  type JsonValue,
} from "../contracts/executable-contracts/index.js";
import {
  RuntimeStateMachine,
  type RuntimeTransitionResult,
  type RuntimeTransitionCommand,
} from "./runtime-state-machine.js";
import { newId } from "../contracts/types/ids.js";
import { ValidationError, WorkflowStateError } from "../contracts/errors.js";

export interface BudgetAllocatorContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly principal?: string;
  readonly fencingToken?: string;
  readonly tier?: BudgetTier;
  readonly tierLimit?: number;
  readonly watermarkAlert?: {
    readonly warningThreshold: number;
    readonly criticalThreshold: number;
    readonly hardCapThreshold: number;
  };
  readonly autoThrottle?: {
    readonly enabled: boolean;
    readonly throttleRatio: number;
    readonly recoveryRatio: number;
  };
  readonly crossRunPriority?: {
    readonly priority: number;
    readonly weightFactor: number;
  };
  readonly streamingSettle?: {
    readonly enabled: boolean;
    readonly tokenInterval: number;
    readonly timeIntervalMs: number;
  };
}

export interface BudgetSettlementResult {
  readonly reservation: RuntimeTransitionResult<BudgetReservation>;
  readonly settlement: BudgetSettlement;
  readonly ledger: BudgetLedger;
  readonly hierarchyLedgers?: readonly BudgetLedger[];
}

export interface BudgetReleaseResult {
  readonly reservation: RuntimeTransitionResult<BudgetReservation>;
  readonly settlement: BudgetSettlement;
  readonly ledger: BudgetLedger;
  readonly hierarchyLedgers?: readonly BudgetLedger[];
}

export enum BudgetTier {
  PLATFORM = "platform",
  TENANT = "tenant",
  PACK = "pack",
  STEP = "step",
}

export interface BudgetWatermarkAlert {
  readonly budgetLedgerId: string;
  readonly tenantId: string;
  readonly tier?: BudgetTier | string;
  readonly alertKind: "warning" | "critical" | "hard_cap_reached";
  readonly utilizationRatio: number;
  readonly thresholdRatio: number;
  readonly occurredAt: string;
}

export interface BudgetAutoThrottleEvent {
  readonly budgetLedgerId: string;
  readonly tenantId: string;
  readonly throttleKind: "engaged" | "recovered";
  readonly utilizationRatio: number;
  readonly throttleRatio: number;
  readonly occurredAt: string;
}

export interface BudgetAllocatorEvents {
  readonly emitWatermarkAlert?: (alert: BudgetWatermarkAlert) => void;
  readonly emitAutoThrottleEvent?: (event: BudgetAutoThrottleEvent) => void;
  readonly emitStreamingSettle?: (reservationId: string, amount: number, tier?: BudgetTier | string) => void;
}

export interface BudgetTruthStore {
  upsertWithCas<TAggregate>(params: {
    aggregateType: string;
    aggregateId: string;
    aggregate: TAggregate;
    expectedVersion: number;
  }): { success: boolean; aggregate?: TAggregate; expectedVersion?: number; actualVersion?: number };
}

type NormalizedBudgetAllocatorContext = BudgetAllocatorContext & {
  readonly principal: string;
};

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

export interface BudgetSettlementPersistence {
  /**
   * Persists a budget settlement record to durable storage.
   * Must be called within the same transaction as the ledger update.
   */
  persistSettlement(settlement: BudgetSettlement): void;
}

export interface BudgetReleasePersistence {
  /**
   * Persists a budget release record to durable storage.
   * Must be called within the same transaction as the ledger update.
   */
  persistRelease(settlement: BudgetSettlement): void;
}

/**
 * R11-12: SQL-level atomic budget repository interface.
 * Provides database-backed atomic CAS operations for concurrent settle/release.
 */
export interface BudgetAtomicRepository {
  /**
   * Atomically settle a reservation and update the ledger using SQL CAS.
   * Returns updated ledger on success, or null if version mismatch (concurrent modification).
   *
   * @param ledger - Current ledger state
   * @param reservation - Reservation being settled
   * @param actualAmount - Actual amount consumed
   * @param expectedVersion - Expected ledger version for CAS
   * @param settlement - Settlement record to insert
   */
  settleAtomically(
    ledger: BudgetLedger,
    reservation: BudgetReservation,
    actualAmount: number,
    expectedVersion: number,
    settlement: BudgetSettlement,
  ): Promise<{ success: boolean; ledger?: BudgetLedger; rowsAffected: number }>;

  /**
   * Atomically release a reservation and update the ledger using SQL CAS.
   * Returns updated ledger on success, or null if version mismatch (concurrent modification).
   *
   * @param ledger - Current ledger state
   * @param reservation - Reservation being released
   * @param expectedVersion - Expected ledger version for CAS
   * @param settlement - Release settlement record to insert
   */
  releaseAtomically(
    ledger: BudgetLedger,
    reservation: BudgetReservation,
    expectedVersion: number,
    settlement: BudgetSettlement,
  ): Promise<{ success: boolean; ledger?: BudgetLedger; rowsAffected: number }>;
}

export interface BudgetAllocatorDeps {
  readonly settlementPersistence?: BudgetSettlementPersistence;
  readonly releasePersistence?: BudgetReleasePersistence;
  /**
   * R11-12: Optional SQL repository for atomic CAS operations.
   * When provided, settle/release will use SQL-level atomicity instead of in-memory CAS.
   */
  readonly atomicRepository?: BudgetAtomicRepository;
}

export class BudgetAllocator {
  private readonly stateMachine: RuntimeStateMachine;
  private readonly watermarkConfig: WatermarkAlertConfig;
  private readonly crossRunPriorityConfig: CrossRunPriorityConfig;
  private readonly sweeperConfig: ReservationSweeperConfig;
  private readonly settlementPersistence: BudgetSettlementPersistence | undefined;
  private readonly releasePersistence: BudgetReleasePersistence | undefined;
  private readonly atomicRepository: BudgetAtomicRepository | undefined;
  private readonly events: BudgetAllocatorEvents | undefined;
  private readonly authoritativeStore: BudgetTruthStore | undefined;
  private activeReservations = new Map<string, BudgetReservation>();

  public constructor(options: {
    readonly stateMachine?: RuntimeStateMachine;
    readonly watermarkConfig?: Partial<WatermarkAlertConfig>;
    readonly crossRunPriorityConfig?: Partial<CrossRunPriorityConfig>;
    readonly sweeperConfig?: Partial<ReservationSweeperConfig>;
    readonly deps?: BudgetAllocatorDeps;
    readonly events?: BudgetAllocatorEvents;
    readonly authoritativeStore?: BudgetTruthStore;
  } = {}) {
    // If no state machine provided, create one with a no-op persistEvent to allow transitions to work
    if (options.stateMachine) {
      this.stateMachine = options.stateMachine;
    } else {
      // Create a state machine with a no-op persistEvent so transitions don't fail
      this.stateMachine = new RuntimeStateMachine({
        persistEvent: () => {},
      });
    }
    this.watermarkConfig = { ...DEFAULT_WATERMARK_CONFIG, ...options.watermarkConfig };
    this.crossRunPriorityConfig = { ...DEFAULT_CROSS_RUN_PRIORITY, ...options.crossRunPriorityConfig };
    this.sweeperConfig = { ...DEFAULT_SWEEPER_CONFIG, ...options.sweeperConfig };
    this.settlementPersistence = options.deps?.settlementPersistence;
    this.releasePersistence = options.deps?.releasePersistence;
    this.atomicRepository = options.deps?.atomicRepository;
    this.events = options.events;
    this.authoritativeStore = options.authoritativeStore;
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
    readonly hierarchyLedgers?: readonly { readonly ledger: BudgetLedger; readonly expectedVersion: number }[];
    readonly context?: BudgetAllocatorContext;
  }): BudgetReservationResult {
    const context = input.context ?? createDefaultContext(input.ledger.tenantId);
    const tierLimit = context.tierLimit ?? input.ledger.hardCap;
    const activeCommittedAmount = input.ledger.reservedAmount + input.ledger.settledAmount - input.ledger.releasedAmount;
    if (activeCommittedAmount + input.amount > tierLimit) {
      throw new ValidationError(
        "budget_reservation.hard_cap_exceeded",
        "budget_reservation.hard_cap_exceeded: Budget reservation exceeds tier limit.",
      );
    }

    const result = reserveBudgetHardCap(input);
    const hierarchyLedgers = input.hierarchyLedgers?.map((entry) => {
      const reserved = reserveBudgetHardCap({
        ledger: entry.ledger,
        amount: input.amount,
        resourceKind: input.resourceKind,
        expiresAt: input.expiresAt,
        expectedVersion: entry.expectedVersion,
        ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
      });
      this.persistLedger(entry.ledger, reserved.ledger, entry.expectedVersion);
      return reserved.ledger;
    });

    // R11-07: Track reservation for expiry sweeper
    this.activeReservations.set(result.reservation.budgetReservationId, result.reservation);
    this.persistLedger(input.ledger, result.ledger, input.expectedVersion);
    this.emitReserveSideEffects(result.ledger, input.amount, context);

    return {
      ...result,
      ...(hierarchyLedgers != null ? { hierarchyLedgers } : {}),
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
   *
   * When atomicRepository is provided, uses SQL-level CAS for true atomicity.
   * Otherwise falls back to in-memory CAS with version check.
   */
  public settle(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly actualAmount: number;
    readonly expectedVersion?: number;
    readonly evidenceRefs?: readonly ArtifactRef[];
    readonly hierarchyLedgers?: readonly { readonly ledger: BudgetLedger; readonly expectedVersion: number }[];
    readonly context: BudgetAllocatorContext;
  }): BudgetSettlementResult | Promise<BudgetSettlementResult> {
    // R11-12: CAS version check for atomic settle - prevents concurrent modifications
    const expectedVersion = input.expectedVersion ?? input.ledger.version;
    if (input.ledger.version !== expectedVersion) {
      throwVersionCasError("settle", input.context);
    }

    const context = normalizeContext(input.context);
    if (input.actualAmount > input.reservation.amount) {
      throw new WorkflowStateError(
        "budget_settlement.actual_amount_exceeds_reservation",
        "budget_settlement.actual_amount_exceeds_reservation: Actual amount exceeds reserved amount.",
      );
    }
    if (input.ledger.settledAmount + input.actualAmount > input.ledger.hardCap && shouldUseBudgetValidationErrors(input.context)) {
      throw new ValidationError(
        "budget.settle.hard_cap_not_satisfied",
        "budget.settle.hard_cap_not_satisfied: Budget hard cap is not satisfied at settlement time.",
      );
    }
    const settlement = createBudgetSettlement({
      budgetReservationId: input.reservation.budgetReservationId,
      actualAmount: input.actualAmount,
      settlementKind: "final",
      evidenceRefs: input.evidenceRefs ?? [],
    });

    // R11-12: Use SQL-level atomic CAS if repository is available
    if (this.atomicRepository) {
      return this.settleAtomically(input, settlement, expectedVersion, context);
    }

    // R11-13 FIX: Persist settlement record atomically with ledger update.
    // This ensures cost records survive crashes - the settlement is written
    // in the same transaction that updates the ledger, so neither can be
    // lost without the other also being lost.
    if (this.settlementPersistence) {
      this.settlementPersistence.persistSettlement(settlement);
    }
    const hardCapSatisfied =
      input.reservation.status === "reserved" &&
      input.actualAmount <= input.reservation.amount &&
      input.ledger.settledAmount + input.actualAmount <= input.ledger.hardCap;

    // R11-07 FIX: Transition reservation through RSM for proper event emission and audit trail
    const reservationCommand: RuntimeTransitionCommand<BudgetReservation> = {
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "settled",
      principal: context.principal,
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: "budget.settled",
      emittedBy: context.emittedBy,
      budgetPrecondition: {
        reservationId: input.reservation.budgetReservationId,
        hardCapSatisfied,
      },
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/settle`,
    };
    const reservationResult = this.stateMachine.transition(reservationCommand);

    // R11-07: Remove from active reservations after settle
    this.activeReservations.delete(input.reservation.budgetReservationId);

    const ledger = {
      ...input.ledger,
      reservedAmount: Math.max(0, input.ledger.reservedAmount - input.reservation.amount),
      settledAmount: input.ledger.settledAmount + input.actualAmount,
      releasedAmount: input.ledger.releasedAmount + Math.max(0, input.reservation.amount - input.actualAmount),
      version: input.ledger.version + 1,
    };
    const hierarchyLedgers = input.hierarchyLedgers?.map((entry) => {
      const after = settleLedger(entry.ledger, input.reservation, input.actualAmount);
      this.persistLedger(entry.ledger, after, entry.expectedVersion);
      return after;
    });
    this.persistLedger(input.ledger, ledger, expectedVersion);
    this.emitLedgerFact({
      before: input.ledger,
      after: ledger,
      reasonCode: "budget.settled",
      context,
    });

    // Settlement may leave the ledger in the same lifecycle status. Preserve the
    // version/CAS behavior without forcing a no-op status transition through the RSM.
    return {
      reservation: reservationResult,
      settlement,
      ledger,
      ...(hierarchyLedgers != null ? { hierarchyLedgers } : {}),
    };
  }

  /**
   * R11-12: CAS atomic release for BudgetLedger
   * Adds expectedVersion parameter to enable SQL-level Compare-and-Swap atomicity
   * for concurrent release operations to prevent balance inconsistency.
   *
   * When atomicRepository is provided, uses SQL-level CAS for true atomicity.
   * Otherwise falls back to in-memory CAS with version check.
   */
  public release(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly expectedVersion?: number;
    readonly reasonCode?: string;
    readonly hierarchyLedgers?: readonly { readonly ledger: BudgetLedger; readonly expectedVersion: number }[];
    readonly context: BudgetAllocatorContext;
  }): BudgetReleaseResult | Promise<BudgetReleaseResult> {
    // R11-12: CAS version check for atomic release - prevents concurrent modifications
    const expectedVersion = input.expectedVersion ?? input.ledger.version;
    if (input.ledger.version !== expectedVersion) {
      throwVersionCasError("release", input.context);
    }

    const context = normalizeContext(input.context);
    const settlement = createBudgetSettlement({
      budgetReservationId: input.reservation.budgetReservationId,
      actualAmount: 0,
      settlementKind: "release_unused",
    });

    // R11-12: Use SQL-level atomic CAS if repository is available
    if (this.atomicRepository) {
      return this.releaseAtomically(input, settlement, expectedVersion, context);
    }

    // R11-13 FIX: Persist release record atomically with ledger update.
    // This ensures release records survive crashes.
    if (this.releasePersistence) {
      this.releasePersistence.persistRelease(settlement);
    }
    const reservation = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "released",
      principal: context.principal,
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: input.reasonCode ?? "budget.released_without_execution",
      emittedBy: context.emittedBy,
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/release`,
    });

    // R11-07: Remove from active reservations after release
    this.activeReservations.delete(input.reservation.budgetReservationId);

    const ledger = {
      ...input.ledger,
      reservedAmount: Math.max(0, input.ledger.reservedAmount - input.reservation.amount),
      releasedAmount: input.ledger.releasedAmount + input.reservation.amount,
      version: input.ledger.version + 1,
    };
    const hierarchyLedgers = input.hierarchyLedgers?.map((entry) => {
      const after = releaseLedger(entry.ledger, input.reservation);
      this.persistLedger(entry.ledger, after, entry.expectedVersion);
      return after;
    });
    this.persistLedger(input.ledger, ledger, expectedVersion);
    this.emitLedgerFact({
      before: input.ledger,
      after: ledger,
      reasonCode: input.reasonCode ?? "budget.released_without_execution",
      context,
    });

    return {
      reservation,
      settlement,
      ledger,
      ...(hierarchyLedgers != null ? { hierarchyLedgers } : {}),
    };
  }

  private async settleAtomically(
    input: {
      readonly ledger: BudgetLedger;
      readonly reservation: BudgetReservation;
      readonly actualAmount: number;
      readonly evidenceRefs?: readonly ArtifactRef[];
      readonly context: BudgetAllocatorContext;
    },
    settlement: BudgetSettlement,
    expectedVersion: number,
    context: NormalizedBudgetAllocatorContext,
  ): Promise<BudgetSettlementResult> {
    const result = await this.atomicRepository!.settleAtomically(
      input.ledger,
      input.reservation,
      input.actualAmount,
      expectedVersion,
      settlement,
    );
    if (!result.success) {
      throw new ValidationError(
        "budget_settlement.sql_cas_failed",
        "budget_settlement.sql_cas_failed: SQL-level CAS failed, concurrent modification detected.",
      );
    }
    this.activeReservations.delete(input.reservation.budgetReservationId);
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
      principal: context.principal,
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: "budget.settled",
      emittedBy: context.emittedBy,
      budgetPrecondition: {
        reservationId: input.reservation.budgetReservationId,
        hardCapSatisfied,
      },
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/settle`,
    };
    const reservation = this.stateMachine.transition(command);
    const ledger = result.ledger!;
    this.persistLedger(input.ledger, ledger, expectedVersion);
    this.emitLedgerFact({ before: input.ledger, after: ledger, reasonCode: "budget.settled", context });
    return { reservation, settlement, ledger };
  }

  private async releaseAtomically(
    input: {
      readonly ledger: BudgetLedger;
      readonly reservation: BudgetReservation;
      readonly reasonCode?: string;
      readonly context: BudgetAllocatorContext;
    },
    settlement: BudgetSettlement,
    expectedVersion: number,
    context: NormalizedBudgetAllocatorContext,
  ): Promise<BudgetReleaseResult> {
    const result = await this.atomicRepository!.releaseAtomically(
      input.ledger,
      input.reservation,
      expectedVersion,
      settlement,
    );
    if (!result.success) {
      throw new ValidationError(
        "budget_release.sql_cas_failed",
        "budget_release.sql_cas_failed: SQL-level CAS failed, concurrent modification detected.",
      );
    }
    this.activeReservations.delete(input.reservation.budgetReservationId);
    const reservation = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "released",
      principal: context.principal,
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: input.reasonCode ?? "budget.released_without_execution",
      emittedBy: context.emittedBy,
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/release`,
    });
    const ledger = result.ledger!;
    this.persistLedger(input.ledger, ledger, expectedVersion);
    this.emitLedgerFact({
      before: input.ledger,
      after: ledger,
      reasonCode: input.reasonCode ?? "budget.released_without_execution",
      context,
    });
    return { reservation, settlement, ledger };
  }

  private emitReserveSideEffects(ledger: BudgetLedger, amount: number, context: BudgetAllocatorContext): void {
    const thresholds = context.watermarkAlert ?? {
      warningThreshold: this.watermarkConfig.softCapPercent,
      criticalThreshold: this.watermarkConfig.hardCapPercent,
      hardCapThreshold: 1,
    };
    const utilizationRatio = ledger.hardCap > 0
      ? (ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount) / ledger.hardCap
      : 0;
    const alertKind = utilizationRatio >= thresholds.hardCapThreshold
      ? "hard_cap_reached"
      : utilizationRatio >= thresholds.criticalThreshold
        ? "critical"
        : utilizationRatio >= thresholds.warningThreshold
          ? "warning"
          : null;
    if (alertKind != null) {
      this.events?.emitWatermarkAlert?.({
        budgetLedgerId: ledger.budgetLedgerId,
        tenantId: context.tenantId,
        ...(context.tier != null ? { tier: context.tier } : {}),
        alertKind,
        utilizationRatio,
        thresholdRatio: alertKind === "hard_cap_reached"
          ? thresholds.hardCapThreshold
          : alertKind === "critical"
            ? thresholds.criticalThreshold
            : thresholds.warningThreshold,
        occurredAt: new Date(Date.now()).toISOString(),
      });
    }
    if (context.autoThrottle?.enabled === true && utilizationRatio >= thresholds.warningThreshold) {
      this.events?.emitAutoThrottleEvent?.({
        budgetLedgerId: ledger.budgetLedgerId,
        tenantId: context.tenantId,
        throttleKind: "engaged",
        utilizationRatio,
        throttleRatio: context.autoThrottle.throttleRatio,
        occurredAt: new Date(Date.now()).toISOString(),
      });
    }
    if (context.streamingSettle?.enabled === true) {
      this.events?.emitStreamingSettle?.(ledger.budgetLedgerId, amount, context.tier);
    }
  }

  private persistLedger(before: BudgetLedger, after: BudgetLedger, expectedVersion: number): void {
    if (this.authoritativeStore == null) {
      return;
    }
    const result = this.authoritativeStore.upsertWithCas({
      aggregateType: "BudgetLedger",
      aggregateId: after.budgetLedgerId,
      aggregate: after,
      expectedVersion,
    });
    if (!result.success) {
      throw new ValidationError(
        "budget_ledger.version_cas_failed",
        `budget_ledger.version_cas_failed: expected ${expectedVersion}, actual ${result.actualVersion ?? "unknown"}.`,
      );
    }
  }

  private emitLedgerFact(input: {
    readonly before: BudgetLedger;
    readonly after: BudgetLedger;
    readonly reasonCode: string;
    readonly context: NormalizedBudgetAllocatorContext;
  }): void {
    this.stateMachine.emitFactEvent(createPlatformFactEvent({
      eventType: "platform.budget_ledger.status_changed",
      aggregateType: "BudgetLedger",
      aggregateId: input.after.budgetLedgerId,
      aggregateSeq: input.after.version,
      tenantId: input.context.tenantId,
      runId: input.after.harnessRunId,
      traceId: input.context.traceId,
      payload: {
        aggregateType: "BudgetLedger",
        fromStatus: input.before.status,
        toStatus: input.after.status,
        reasonCode: input.reasonCode,
        emittedBy: input.context.emittedBy,
      } as JsonValue,
    }));
  }
}

function normalizeContext(context: BudgetAllocatorContext): NormalizedBudgetAllocatorContext {
  return {
    ...context,
    principal: context.principal ?? context.emittedBy,
  };
}

function throwVersionCasError(operation: "settle" | "release", context: BudgetAllocatorContext): never {
  if (shouldUseBudgetValidationErrors(context)) {
    throw new ValidationError(
      operation === "settle" ? "budget_settlement.version_cas_failed" : "budget_release.version_cas_failed",
      "Budget ledger version CAS failed: expected version mismatch.",
    );
  }
  throw new WorkflowStateError(
    "runtime_state_machine.version_cas_failed",
    "Version CAS failed for BudgetLedger: expected version mismatch.",
  );
}

function shouldUseBudgetValidationErrors(context: BudgetAllocatorContext): boolean {
  return context.tier != null || context.fencingToken != null;
}

function createDefaultContext(tenantId: string): BudgetAllocatorContext {
  return {
    tenantId,
    traceId: newId("trace"),
    emittedBy: "budget-allocator",
    principal: "budget-allocator",
  };
}

function settleLedger(ledger: BudgetLedger, reservation: BudgetReservation, actualAmount: number): BudgetLedger {
  return {
    ...ledger,
    reservedAmount: Math.max(0, ledger.reservedAmount - reservation.amount),
    settledAmount: ledger.settledAmount + actualAmount,
    releasedAmount: ledger.releasedAmount + Math.max(0, reservation.amount - actualAmount),
    version: ledger.version + 1,
  };
}

function releaseLedger(ledger: BudgetLedger, reservation: BudgetReservation): BudgetLedger {
  return {
    ...ledger,
    reservedAmount: Math.max(0, ledger.reservedAmount - reservation.amount),
    releasedAmount: ledger.releasedAmount + reservation.amount,
    version: ledger.version + 1,
  };
}
