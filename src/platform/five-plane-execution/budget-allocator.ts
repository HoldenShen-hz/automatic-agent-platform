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
} from "./runtime-state-machine.js";

export interface BudgetAllocatorContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly emittedBy: string;
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

export class BudgetAllocator {
  private readonly stateMachine: RuntimeStateMachine;

  public constructor(options: { readonly stateMachine?: RuntimeStateMachine } = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
  }

  public reserve(input: {
    readonly ledger: BudgetLedger;
    readonly amount: number;
    readonly resourceKind: BudgetResourceKind;
    readonly expiresAt: string;
    readonly expectedVersion: number;
    readonly nodeRunId?: string;
  }): BudgetReservationResult {
    return reserveBudgetHardCap(input);
  }

  public settle(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly actualAmount: number;
    readonly evidenceRefs?: readonly ArtifactRef[];
    readonly context: BudgetAllocatorContext;
  }): BudgetSettlementResult {
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
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "settled",
      tenantId: input.context.tenantId,
      traceId: input.context.traceId,
      reasonCode: "budget.settled",
      emittedBy: input.context.emittedBy,
      budgetPrecondition: {
        reservationId: input.reservation.budgetReservationId,
        hardCapSatisfied,
      },
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/settle`,
    });
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

  public release(input: {
    readonly ledger: BudgetLedger;
    readonly reservation: BudgetReservation;
    readonly reasonCode?: string;
    readonly context: BudgetAllocatorContext;
  }): BudgetReleaseResult {
    const settlement = createBudgetSettlement({
      budgetReservationId: input.reservation.budgetReservationId,
      actualAmount: 0,
      settlementKind: "release_unused",
    });
    const reservation = this.stateMachine.transition({
      aggregateType: "BudgetReservation",
      aggregate: input.reservation,
      fromStatus: input.reservation.status,
      toStatus: "released",
      tenantId: input.context.tenantId,
      traceId: input.context.traceId,
      reasonCode: input.reasonCode ?? "budget.released_without_execution",
      emittedBy: input.context.emittedBy,
      auditRef: `audit://budget-reservations/${input.reservation.budgetReservationId}/release`,
    });
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
