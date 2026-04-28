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
import { newId } from "../contracts/types/ids.js";
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
    readonly context: BudgetAllocatorContext;
  }): BudgetReservationResult {
    // Validate CAS against expected version before proceeding
    if (input.ledger.version !== input.expectedVersion) {
      throw new ValidationError(
        "budget_reservation.version_cas_failed",
        "Budget reservation requires the current ledger version.",
        { details: { expectedVersion: input.expectedVersion, currentVersion: input.ledger.version } },
      );
    }

    // Compute new ledger state (deterministic, same as reserveBudgetHardCap)
    const activeCommittedAmount = input.ledger.reservedAmount + input.ledger.settledAmount - input.ledger.releasedAmount;
    const newStatus = activeCommittedAmount + input.amount >= input.ledger.hardCap ? "hard_cap_reached" : input.ledger.status;

    // Route through state machine for proper CAS + event emission per §25.9
    const ledgerTransition = this.stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetLedger",
      entityId: input.ledger.budgetLedgerId,
      principal: input.context.emittedBy,
      aggregateType: "BudgetLedger",
      aggregate: input.ledger,
      fromStatus: input.ledger.status,
      toStatus: newStatus,
      tenantId: input.context.tenantId,
      traceId: input.context.traceId,
      reasonCode: "budget.reserved",
      emittedBy: input.context.emittedBy,
      auditRef: `audit://budget-ledgers/${input.ledger.budgetLedgerId}/reserve`,
    });

    // Create reservation through state machine for event emission
    const reservationResult = reserveBudgetHardCap({
      ledger: ledgerTransition.aggregate,
      amount: input.amount,
      resourceKind: input.resourceKind,
      expiresAt: input.expiresAt,
      expectedVersion: ledgerTransition.aggregate.version,
      nodeRunId: input.nodeRunId,
    });

    return reservationResult;
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
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      principal: input.context.emittedBy,
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
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: input.reservation.budgetReservationId,
      principal: input.context.emittedBy,
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
