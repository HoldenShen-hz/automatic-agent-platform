import type {
  BudgetLedger,
  BudgetReservation,
  BudgetSettlement,
} from "../contracts/executable-contracts/index.js";
import type { RuntimeTransitionResult } from "./runtime-state-machine.js";

export interface BudgetAllocatorContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly emittedBy: string;
  readonly principal?: string;
  readonly fencingToken?: string;
  readonly tier?: BudgetTier;
  readonly tierLimit?: number;
  readonly tierLimitCurrency?: string;
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

export type NormalizedBudgetAllocatorContext = BudgetAllocatorContext & {
  readonly principal: string;
};

export interface WatermarkAlertConfig {
  readonly softCapPercent: number;
  readonly hardCapPercent: number;
  readonly enabled: boolean;
}

export interface WatermarkAlert {
  readonly triggered: boolean;
  readonly level: "none" | "warning" | "critical";
  readonly message: string;
  readonly percentUsed: number;
}

export interface CrossRunPriorityConfig {
  readonly enabled: boolean;
  readonly basePriority: number;
  readonly ageWeight: number;
  readonly riskWeight: number;
}

export interface ReservationSweeperConfig {
  readonly enabled: boolean;
  readonly sweepIntervalMs: number;
  readonly clockSkewSafetyMarginMs: number;
  readonly maxExpiryAgeMs: number;
}

export interface StreamingIncrementResult {
  readonly reservationId: string;
  readonly incrementalAmount: number;
  readonly totalReserved: number;
  readonly expiresAt: string;
  readonly ledger: BudgetLedger;
  readonly reservation: BudgetReservation;
}

export interface BudgetSettlementPersistence {
  persistSettlement(settlement: BudgetSettlement): void;
}

export interface BudgetReleasePersistence {
  persistRelease(settlement: BudgetSettlement): void;
}

export interface BudgetAtomicRepository {
  settleAtomically(
    ledger: BudgetLedger,
    reservation: BudgetReservation,
    actualAmount: number,
    expectedVersion: number,
    settlement: BudgetSettlement,
  ): Promise<{ success: boolean; ledger?: BudgetLedger; rowsAffected: number }>;

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
  readonly atomicRepository?: BudgetAtomicRepository;
}
