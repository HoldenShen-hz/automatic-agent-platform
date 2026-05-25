import type { BudgetReservationResult, BudgetResourceKind } from "../contracts/executable-contracts/index.js";
import { ValidationError } from "../contracts/errors.js";
import { BudgetAllocator, type BudgetAllocatorContext } from "./budget-allocator.js";
import { BudgetRepository } from "../five-plane-state-evidence/truth/sqlite/repositories/budget-repository.js";
import type { SqliteConnection } from "../five-plane-state-evidence/truth/sqlite/query-helper.js";

export interface ReserveBudgetLedgerInput {
  readonly connection: SqliteConnection;
  readonly budgetLedgerId: string;
  readonly amount: number;
  readonly resourceKind: BudgetResourceKind;
  readonly allocatorContext: BudgetAllocatorContext;
  readonly expiresAt?: string;
  readonly onMissingLedger?: () => void;
}

export function reserveBudgetLedger(input: ReserveBudgetLedgerInput): BudgetReservationResult | null {
  const repository = new BudgetRepository(input.connection);
  const ledger = repository.getLedger(input.budgetLedgerId);
  if (ledger == null) {
    input.onMissingLedger?.();
    return null;
  }

  const allocator = new BudgetAllocator();
  const result = allocator.reserve({
    ledger,
    amount: input.amount,
    resourceKind: input.resourceKind,
    expiresAt: input.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    expectedVersion: ledger.version,
    context: {
      ...input.allocatorContext,
      tenantId: ledger.tenantId,
    },
  });

  const persistResult = repository.updateLedgerWithReservation(
    result.ledger,
    result.reservation,
    ledger.version,
  );
  if (!persistResult.success) {
    throw new ValidationError(
      "budget_reservation.sql_cas_failed",
      "budget_reservation.sql_cas_failed: concurrent reserve detected for budget ledger.",
    );
  }

  return result;
}
