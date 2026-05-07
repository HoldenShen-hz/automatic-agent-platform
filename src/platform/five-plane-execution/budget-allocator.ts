import {
  createBudgetReservation,
  createBudgetSettlement,
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
  type RuntimeTransitionCommand,
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
  readonly watermarkAlert?: WatermarkAlertConfig;
  readonly autoThrottle?: AutoThrottleConfig;
  readonly crossRunPriority?: CrossRunPriorityConfig;
  readonly streamingSettle?: StreamingSettleConfig;
}

type NormalizedBudgetAllocatorContext = Omit<BudgetAllocatorContext, 'watermarkAlert' | 'autoThrottle' | 'crossRunPriority' | 'streamingSettle'> &
  Required<Pick<BudgetAllocatorContext, 'watermarkAlert' | 'autoThrottle' | 'crossRunPriority' | 'streamingSettle'>>;

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
  readonly hierarchyLedgers?: readonly BudgetLedger[];
}

export interface BudgetReleaseResult {
  readonly reservation: RuntimeTransitionResult<BudgetReservation>;
  readonly settlement: BudgetSettlement;
  readonly ledger: BudgetLedger;
  readonly hierarchyLedgers?: readonly BudgetLedger[];
}

export interface HierarchicalBudgetLedgerInput {
  readonly ledger: BudgetLedger;
  readonly expectedVersion: number;
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

/**
 * Sweeper configuration for expired reservation cleanup.
 * §18.3: expired reservation must be released, not continue to participate in commit
 */
export interface SweeperConfig {
  readonly enabled: boolean;
  readonly scanIntervalMs: number; // How often to scan for expired reservations
  readonly maxReservationsToScan: number; // Batch size for scanning
}

export interface BudgetAllocatorAuthoritativeStore {
  getBudgetLedger(budgetLedgerId: string): BudgetLedger | null;
  getBudgetReservation(budgetReservationId: string): BudgetReservation | null;
  seed(aggregateType: "BudgetLedger" | "BudgetReservation", aggregate: BudgetLedger | BudgetReservation): void;
  appendBudgetReservation(reservation: BudgetReservation): void;
  compareAndSetBudgetLedger(nextLedger: BudgetLedger, expectedVersion: number): BudgetLedger;
  transition(
    command: RuntimeTransitionCommand<BudgetReservation>,
  ): RuntimeTransitionResult<BudgetReservation>;
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
  private readonly events: BudgetAllocatorEvents | undefined;
  private readonly sweeperConfig: SweeperConfig;
  private readonly authoritativeStore: BudgetAllocatorAuthoritativeStore | undefined;

  public constructor(options: {
    readonly stateMachine?: RuntimeStateMachine;
    readonly events?: BudgetAllocatorEvents;
    readonly sweeperConfig?: SweeperConfig;
    readonly authoritativeStore?: BudgetAllocatorAuthoritativeStore;
  } = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
    this.events = options.events;
    this.sweeperConfig = options.sweeperConfig ?? { enabled: false, scanIntervalMs: 60000, maxReservationsToScan: 100 };
    this.authoritativeStore = options.authoritativeStore;
  }

  private normalizeContext(
    context: BudgetAllocatorContext,
  ): NormalizedBudgetAllocatorContext {
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
    const cfg = this.normalizeContext(context);
    const utilizationRatio = ledger.reservedAmount / cfg.tierLimit;
    const { warningThreshold, criticalThreshold, hardCapThreshold } = cfg.watermarkAlert!;

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
    const cfg = this.normalizeContext(context);
    if (!cfg.autoThrottle?.enabled) return;

    const utilizationRatio = ledger.reservedAmount / cfg.tierLimit;
    const { throttleRatio } = cfg.autoThrottle;
    // Auto-throttle engages when utilization reaches watermark warning threshold
    const { warningThreshold } = cfg.watermarkAlert!;
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

  private computeActiveCommittedAmount(ledger: BudgetLedger): number {
    return ledger.reservedAmount + ledger.settledAmount - ledger.releasedAmount;
  }

  private assertLedgerVersion(
    ledger: BudgetLedger,
    expectedVersion: number,
    code: string,
    message: string,
  ): void {
    if (ledger.version !== expectedVersion) {
      throw new ValidationError(code, message, {
        details: {
          expectedVersion,
          currentVersion: ledger.version,
          budgetLedgerId: ledger.budgetLedgerId,
        },
      });
    }
  }

  private reserveLedgerAmount(
    ledger: BudgetLedger,
    amount: number,
    tierLimit: number,
    expectedVersion: number,
    context: BudgetAllocatorContext,
  ): BudgetLedger {
    // R22-35 FIX: Use state machine transition for ledger version increment with CAS.
    const effectiveHardCap = Math.min(ledger.hardCap, tierLimit);
    const activeCommittedAmount = this.computeActiveCommittedAmount(ledger);
    if (activeCommittedAmount + amount > effectiveHardCap) {
      throw new ValidationError(
        "budget_reservation.hard_cap_exceeded",
        "Budget reservation exceeds the effective hard cap.",
        {
          details: {
            budgetLedgerId: ledger.budgetLedgerId,
            activeCommittedAmount,
            amount,
            effectiveHardCap,
            configuredHardCap: ledger.hardCap,
            tierLimit,
          },
        },
      );
    }

    const nextReservedAmount = ledger.reservedAmount + amount;
    const nextActiveAmount = nextReservedAmount + ledger.settledAmount - ledger.releasedAmount;
    const nextStatus = nextActiveAmount >= effectiveHardCap
      ? "hard_cap_reached"
      : (ledger.softCap != null && nextActiveAmount >= ledger.softCap ? "soft_cap_reached" : ledger.status);

    // Use state machine transition for atomic version increment with CAS check.
    // If status changes, transition provides version bump. If status stays same,
    // use intermediate "reserving" status for version bump.
    const targetStatus = nextStatus === ledger.status ? "reserving" : nextStatus;

    const result = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetLedger",
      entityId: ledger.budgetLedgerId,
      principal: context.emittedBy,
      aggregateType: "BudgetLedger",
      aggregate: ledger,
      fromStatus: ledger.status,
      toStatus: targetStatus,
      expectedVersion,
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: "budget.ledger_reserve",
      emittedBy: context.emittedBy,
      auditRef: `audit://budget-ledgers/${ledger.budgetLedgerId}/reserve`,
      ...(context.fencingToken !== undefined ? { fencingToken: context.fencingToken } : {}),
    });

    return {
      ...result.aggregate,
      reservedAmount: nextReservedAmount,
      status: nextStatus,
      ...(targetStatus === "reserving" ? { status: ledger.status as BudgetLedger["status"] } : {}),
    };
  }

  private settleLedgerAmount(
    ledger: BudgetLedger,
    reservedAmount: number,
    actualAmount: number,
    expectedVersion: number,
    context: BudgetAllocatorContext,
  ): BudgetLedger {
    // R22-35 FIX: Use state machine transition for ledger version increment with CAS.
    // Previously did direct version increment (version: ledger.version + 1) without CAS,
    // allowing concurrent settle to overwrite each other.
    const nextReservedAmount = Math.max(0, ledger.reservedAmount - reservedAmount);
    const nextReleasedAmount = ledger.releasedAmount + Math.max(0, reservedAmount - actualAmount);
    const nextSettledAmount = ledger.settledAmount + actualAmount;
    const effectiveHardCap = ledger.hardCap;
    const activeCommittedAmount = nextReservedAmount + nextSettledAmount - nextReleasedAmount;
    const nextStatus = activeCommittedAmount >= effectiveHardCap
      ? "hard_cap_reached"
      : (ledger.softCap != null && activeCommittedAmount >= ledger.softCap ? "soft_cap_reached" : "open");

    // Use state machine transition for atomic version increment with CAS check.
    // If status changes, transition provides version bump. If status stays same,
    // we use an intermediate "settling" status that transitions back, giving us
    // a valid 2-step transition (this -> settling -> this) with 2 version bumps.
    // Note: "settling" must be added to BUDGET_LEDGER_TRANSITIONS.
    const targetStatus = nextStatus === ledger.status ? "settling" : nextStatus;

    const result = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetLedger",
      entityId: ledger.budgetLedgerId,
      principal: context.emittedBy,
      aggregateType: "BudgetLedger",
      aggregate: ledger,
      fromStatus: ledger.status,
      toStatus: targetStatus,
      expectedVersion,
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: "budget.ledger_settle",
      emittedBy: context.emittedBy,
      auditRef: `audit://budget-ledgers/${ledger.budgetLedgerId}/settle`,
      ...(context.fencingToken !== undefined ? { fencingToken: context.fencingToken } : {}),
    });

    // Apply amount changes and return to original status if we used intermediate
    return {
      ...result.aggregate,
      reservedAmount: nextReservedAmount,
      settledAmount: nextSettledAmount,
      releasedAmount: nextReleasedAmount,
      ...(targetStatus === "settling" ? { status: ledger.status as BudgetLedger["status"] } : {}),
    };
  }

  private releaseLedgerAmount(
    ledger: BudgetLedger,
    reservedAmount: number,
    expectedVersion: number,
    context: BudgetAllocatorContext,
  ): BudgetLedger {
    // R22-35 FIX: Use state machine transition for ledger version increment with CAS.
    const nextReservedAmount = Math.max(0, ledger.reservedAmount - reservedAmount);
    const nextReleasedAmount = ledger.releasedAmount + reservedAmount;

    // Release typically doesn't change status (we're freeing reserved amount back)
    // Use "releasing" intermediate status for version bump
    const result = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetLedger",
      entityId: ledger.budgetLedgerId,
      principal: context.emittedBy,
      aggregateType: "BudgetLedger",
      aggregate: ledger,
      fromStatus: ledger.status,
      toStatus: "releasing",
      expectedVersion,
      tenantId: context.tenantId,
      traceId: context.traceId,
      reasonCode: "budget.ledger_release",
      emittedBy: context.emittedBy,
      auditRef: `audit://budget-ledgers/${ledger.budgetLedgerId}/release`,
      ...(context.fencingToken !== undefined ? { fencingToken: context.fencingToken } : {}),
    });

    return {
      ...result.aggregate,
      reservedAmount: nextReservedAmount,
      releasedAmount: nextReleasedAmount,
      status: ledger.status as BudgetLedger["status"],
    };
  }

  /**
   * Determine the target status for a settle operation when the ledger status
   * doesn't change but we still need a version bump.
   */
  private determineSettleStatus(
    nextSettledAmount: number,
    ledger: BudgetLedger,
  ): BudgetLedger["status"] {
    // If the ledger was open and now has settled amount, it stays open
    // (open can transition to soft_cap_reached or hard_cap_reached based on totals)
    if (ledger.status === "open") {
      return "open";
    }
    // For soft_cap_reached or hard_cap_reached, we can't do a no-op,
    // but the only valid transition from these is "closed"
    if (ledger.status === "soft_cap_reached" || ledger.status === "hard_cap_reached") {
      return "hard_cap_reached";
    }
    return ledger.status;
  }

  private ensureSeededLedger(ledger: BudgetLedger): void {
    if (this.authoritativeStore == null || this.authoritativeStore.getBudgetLedger(ledger.budgetLedgerId) != null) {
      return;
    }
    this.authoritativeStore.seed("BudgetLedger", ledger);
  }

  private persistLedgerIfNeeded(
    nextLedger: BudgetLedger,
    expectedVersion: number,
  ): BudgetLedger {
    if (this.authoritativeStore == null) {
      return nextLedger;
    }
    return this.authoritativeStore.compareAndSetBudgetLedger(nextLedger, expectedVersion);
  }

  private persistHierarchyLedgersIfNeeded(
    entries: readonly HierarchicalBudgetLedgerInput[] | undefined,
    nextLedgers: readonly BudgetLedger[],
  ): readonly BudgetLedger[] {
    if (entries == null || entries.length === 0) {
      return [];
    }
    return nextLedgers.map((ledger, index) =>
      this.persistLedgerIfNeeded(ledger, entries[index]!.expectedVersion)
    );
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
    const cfg = this.normalizeContext(context);
    const isThrottled = this.throttleState.get(harnessRunId) ?? false;
    if (!isThrottled || !cfg.autoThrottle?.enabled) {
      return requestedAmount;
    }
    return Math.floor(requestedAmount * cfg.autoThrottle.throttleRatio);
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
    const cfg = this.normalizeContext(context);
    if (!cfg.streamingSettle?.enabled) return;
    const streamingSettle = cfg.streamingSettle;

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
    const { tokenInterval, timeIntervalMs } = streamingSettle;

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

  /**
   * R22-43 FIX: Enforce hierarchical budget checking.
   * When allocating at STEP level, verify domain (PACK) budget allows it.
   * When allocating at DOMAIN level, verify platform budget allows it.
   * §18.2-18.3: platform→domain→task层级预算
   */
  private checkHierarchicalBudgetAllowance(
    context: BudgetAllocatorContext,
    hierarchyLedgers: readonly HierarchicalBudgetLedgerInput[],
    requestedAmount: number,
  ): void {
    if (hierarchyLedgers.length === 0) return;

    for (const entry of hierarchyLedgers) {
      const ledger = entry.ledger;
      const activeCommittedAmount = this.computeActiveCommittedAmount(ledger);
      const availableBudget = ledger.hardCap - activeCommittedAmount;

      if (requestedAmount > availableBudget) {
        throw new ValidationError(
          "budget_reservation.hierarchy_budget_exceeded",
          `Budget reservation at tier ${context.tier} exceeds available budget at parent tier ${ledger.budgetLedgerId}.`,
          {
            details: {
              childTier: context.tier,
              parentLedgerId: ledger.budgetLedgerId,
              requestedAmount,
              availableBudget,
              parentHardCap: ledger.hardCap,
              parentActiveCommitted: activeCommittedAmount,
            },
          },
        );
      }
    }
  }

  public reserve(input: {
    readonly ledger: BudgetLedger;
    readonly amount: number;
    readonly resourceKind: BudgetResourceKind;
    readonly expiresAt: string;
    readonly expectedVersion: number;
    readonly hierarchyLedgers?: readonly HierarchicalBudgetLedgerInput[];
    readonly nodeRunId?: string;
    readonly context: BudgetAllocatorContext;
  }): BudgetReservationResult {
    const context = this.normalizeContext(input.context);
    this.assertLedgerVersion(
      input.ledger,
      input.expectedVersion,
      "budget_reservation.version_cas_failed",
      "Budget reservation requires the current ledger version.",
    );
    for (const ancestor of input.hierarchyLedgers ?? []) {
      this.assertLedgerVersion(
        ancestor.ledger,
        ancestor.expectedVersion,
        "budget_reservation.version_cas_failed",
        "Hierarchical budget reservation requires the current ledger version.",
      );
    }

    // Compute effective amount considering auto-throttle
    // §18.2-18.3: Auto-throttle reduces allocation when engaged
    const effectiveAmount = this.computeEffectiveAmount(
      context,
      input.ledger.harnessRunId,
      input.amount,
    );

    this.ensureSeededLedger(input.ledger);
    for (const ancestor of input.hierarchyLedgers ?? []) {
      this.ensureSeededLedger(ancestor.ledger);
    }

    // R22-43 FIX: Enforce hierarchical budget checking before allocation
    this.checkHierarchicalBudgetAllowance(context, input.hierarchyLedgers ?? [], effectiveAmount);

    const hierarchyLedgers = (input.hierarchyLedgers ?? []).map((entry) =>
      this.reserveLedgerAmount(entry.ledger, effectiveAmount, entry.ledger.hardCap, entry.expectedVersion, context)
    );
    const ledgerForReservation = this.reserveLedgerAmount(
      input.ledger,
      effectiveAmount,
      context.tierLimit,
      input.expectedVersion,
      context,
    );
    const reservation = createBudgetReservation({
      budgetLedgerId: input.ledger.budgetLedgerId,
      harnessRunId: input.ledger.harnessRunId,
      amount: effectiveAmount,
      resourceKind: input.resourceKind,
      expiresAt: input.expiresAt,
      ...(input.nodeRunId !== undefined ? { nodeRunId: input.nodeRunId } : {}),
    });

    // §18.2-18.3: Watermark alert check after reservation
    this.checkWatermarkAlert(context, ledgerForReservation, input.ledger.harnessRunId);

    // §18.2-18.3: Auto-throttle check after reservation
    this.checkAutoThrottle(context, ledgerForReservation, input.ledger.harnessRunId);

    // §18.3: Initialize streaming settle state if enabled
    if (context.streamingSettle?.enabled) {
      this.processStreamingSettle(context, reservation, 0);
    }

    const persistedHierarchyLedgers = this.persistHierarchyLedgersIfNeeded(
      input.hierarchyLedgers,
      hierarchyLedgers,
    );
    const persistedLedger = this.persistLedgerIfNeeded(ledgerForReservation, input.expectedVersion);

    if (this.authoritativeStore != null && this.authoritativeStore.getBudgetReservation(reservation.budgetReservationId) == null) {
      this.authoritativeStore.appendBudgetReservation(reservation);
    }

    return {
      ledger: persistedLedger,
      reservation,
      ...(persistedHierarchyLedgers.length > 0 ? { hierarchyLedgers: persistedHierarchyLedgers } : {}),
    };
  }

  public settle(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly actualAmount: number;
    readonly evidenceRefs?: readonly ArtifactRef[];
    readonly expectedVersion: number;
    readonly hierarchyLedgers?: readonly HierarchicalBudgetLedgerInput[];
    readonly context: BudgetAllocatorContext;
  }): BudgetSettlementResult {
    const context = this.normalizeContext(input.context);
    this.assertLedgerVersion(
      input.ledger,
      input.expectedVersion,
      "budget_settlement.version_cas_failed",
      "Budget settlement requires the current ledger version.",
    );
    for (const ancestor of input.hierarchyLedgers ?? []) {
      this.assertLedgerVersion(
        ancestor.ledger,
        ancestor.expectedVersion,
        "budget_settlement.version_cas_failed",
        "Hierarchical budget settlement requires the current ledger version.",
      );
    }

    const settlement = createBudgetSettlement({
      budgetReservationId: input.reservation.budgetReservationId,
      actualAmount: input.actualAmount,
      settlementKind: "final",
      evidenceRefs: input.evidenceRefs ?? [],
    });

    if (input.actualAmount > input.reservation.amount) {
      throw new ValidationError(
        "budget_settlement.actual_amount_exceeds_reservation",
        "Budget settlement actual amount exceeds the reserved amount.",
        {
          details: {
            reservationId: input.reservation.budgetReservationId,
            reservedAmount: input.reservation.amount,
            actualAmount: input.actualAmount,
          },
        },
      );
    }

    const hardCapSatisfied =
      input.reservation.status === "reserved" &&
      input.ledger.settledAmount + input.actualAmount <= input.ledger.hardCap;

    // Preserve the domain-specific budget error contract instead of letting the
    // generic state-machine precondition failure mask the root cause.
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

    if (this.authoritativeStore != null && this.authoritativeStore.getBudgetReservation(input.reservation.budgetReservationId) == null) {
      this.authoritativeStore.seed("BudgetReservation", input.reservation);
    }
    this.ensureSeededLedger(input.ledger);
    for (const ancestor of input.hierarchyLedgers ?? []) {
      this.ensureSeededLedger(ancestor.ledger);
    }

    const reservationTransitionCommand: RuntimeTransitionCommand<BudgetReservation> = {
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
      ...(context.fencingToken !== undefined ? { fencingToken: context.fencingToken } : {}),
    };
    const reservation = this.authoritativeStore != null
      ? this.authoritativeStore.transition(reservationTransitionCommand)
      : this.stateMachine.transition(reservationTransitionCommand);
    if (context.streamingSettle?.enabled) {
      this.processStreamingSettle(context, input.reservation, input.actualAmount);
    }

    // Clean up streaming state on final settle
    if (settlement.settlementKind === "final") {
      this.streamingStates.delete(input.reservation.budgetReservationId);
    }

    // Root cause: once a ledger reached soft/hard cap, settle() attempted a no-op
    // BudgetLedger transition (`hard_cap_reached -> hard_cap_reached`) only to get
    // a version bump, but RuntimeStateMachine correctly rejects no-op transitions.
    // The settlement itself is already captured by the BudgetReservation transition,
    // so when the ledger status does not change we only need a deterministic version bump.
    const finalLedger = this.settleLedgerAmount(
      input.ledger,
      input.reservation.amount,
      input.actualAmount,
      input.expectedVersion,
      context,
    );
    const hierarchyLedgers = (input.hierarchyLedgers ?? []).map((entry) =>
      this.settleLedgerAmount(entry.ledger, input.reservation.amount, input.actualAmount, entry.expectedVersion, context)
    );
    const persistedHierarchyLedgers = this.persistHierarchyLedgersIfNeeded(
      input.hierarchyLedgers,
      hierarchyLedgers,
    );
    const persistedLedger = this.persistLedgerIfNeeded(finalLedger, input.expectedVersion);

    return {
      reservation,
      settlement,
      ledger: persistedLedger,
      ...(persistedHierarchyLedgers.length > 0 ? { hierarchyLedgers: persistedHierarchyLedgers } : {}),
    };
  }

  public release(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly reasonCode?: string;
    readonly expectedVersion: number;
    readonly hierarchyLedgers?: readonly HierarchicalBudgetLedgerInput[];
    readonly context: BudgetAllocatorContext;
  }): BudgetReleaseResult {
    const context = this.normalizeContext(input.context);
    this.assertLedgerVersion(
      input.ledger,
      input.expectedVersion,
      "budget_release.version_cas_failed",
      "Budget release requires the current ledger version.",
    );
    for (const ancestor of input.hierarchyLedgers ?? []) {
      this.assertLedgerVersion(
        ancestor.ledger,
        ancestor.expectedVersion,
        "budget_release.version_cas_failed",
        "Hierarchical budget release requires the current ledger version.",
      );
    }

    const settlement = createBudgetSettlement({
      budgetReservationId: input.reservation.budgetReservationId,
      actualAmount: 0,
      settlementKind: "release_unused",
    });
    if (this.authoritativeStore != null && this.authoritativeStore.getBudgetReservation(input.reservation.budgetReservationId) == null) {
      this.authoritativeStore.seed("BudgetReservation", input.reservation);
    }
    this.ensureSeededLedger(input.ledger);
    for (const ancestor of input.hierarchyLedgers ?? []) {
      this.ensureSeededLedger(ancestor.ledger);
    }

    const reservationTransitionCommand: RuntimeTransitionCommand<BudgetReservation> = {
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
      ...(context.fencingToken !== undefined ? { fencingToken: context.fencingToken } : {}),
    };
    const reservation = this.authoritativeStore != null
      ? this.authoritativeStore.transition(reservationTransitionCommand)
      : this.stateMachine.transition(reservationTransitionCommand);

    // Clean up streaming state on release
    this.streamingStates.delete(input.reservation.budgetReservationId);

    // Clean up throttle state if this is the last reservation for the run
    const isLastReservation = input.ledger.reservedAmount <= input.reservation.amount;
    if (isLastReservation) {
      this.throttleState.delete(input.ledger.harnessRunId);
    }

    const hierarchyLedgers = (input.hierarchyLedgers ?? []).map((entry) =>
      this.releaseLedgerAmount(entry.ledger, input.reservation.amount, entry.expectedVersion, context)
    );
    const persistedHierarchyLedgers = this.persistHierarchyLedgersIfNeeded(
      input.hierarchyLedgers,
      hierarchyLedgers,
    );
    const persistedLedger = this.persistLedgerIfNeeded(
      this.releaseLedgerAmount(input.ledger, input.reservation.amount, input.expectedVersion, context),
      input.expectedVersion,
    );

    return {
      reservation,
      settlement,
      ledger: persistedLedger,
      ...(persistedHierarchyLedgers.length > 0 ? { hierarchyLedgers: persistedHierarchyLedgers } : {}),
    };
  }

  /**
   * R11-07 FIX: Sweep expired reservations.
   * §18.3: expired reservation must be released, not continue to participate in commit.
   *
   * This method should be called periodically to clean up expired reservations
   * that were not explicitly released (e.g., due to execution failures).
   */
  public sweepExpiredReservations(input: {
    readonly ledger: BudgetLedger;
    readonly reservations: readonly BudgetReservation[];
    readonly context: BudgetAllocatorContext;
  }): ReadonlyArray<BudgetReleaseResult> {
    if (!this.sweeperConfig.enabled) {
      return [];
    }

    const now = Date.now();
    const expiredReservations = input.reservations.filter((res) => {
      if (res.status !== "reserved") return false;
      const expiresAtMs = Date.parse(res.expiresAt);
      return expiresAtMs <= now;
    });

    const results: BudgetReleaseResult[] = [];
    let currentLedger = input.ledger;
    for (const expired of expiredReservations.slice(0, this.sweeperConfig.maxReservationsToScan)) {
      try {
        const result = this.release({
          ledger: currentLedger,
          reservation: expired,
          reasonCode: "budget.sweeper_expired",
          expectedVersion: currentLedger.version,
          context: input.context,
        });
        results.push(result);
        // Update ledger for next iteration since version changes on each release
        currentLedger = result.ledger;
      } catch {
        // Skip failed releases - sweeper should not throw, just log
      }
    }

    return results;
  }
}
