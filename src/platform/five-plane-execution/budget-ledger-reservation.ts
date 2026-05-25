import {
  createBudgetLedger,
  type BudgetLedger,
  type BudgetReservationResult,
  type BudgetResourceKind,
} from "../contracts/executable-contracts/index.js";
import { ValidationError } from "../contracts/errors.js";
import { BudgetAllocator, type BudgetAllocatorContext } from "./budget-allocator.js";
import { BudgetRepository } from "../five-plane-state-evidence/truth/sqlite/repositories/budget-repository.js";
import type { SqliteConnection } from "../five-plane-state-evidence/truth/sqlite/query-helper.js";

export interface EnsureBudgetLedgerInput {
  readonly connection: SqliteConnection;
  readonly budgetLedgerId: string;
  readonly tenantId: string;
  readonly harnessRunId: string;
  readonly currency: string;
  readonly hardCap: number;
}

export interface ReserveBudgetLedgerInput {
  readonly connection: SqliteConnection;
  readonly budgetLedgerId: string;
  readonly amount: number;
  readonly resourceKind: BudgetResourceKind;
  readonly allocatorContext: BudgetAllocatorContext;
  readonly expiresAt?: string;
  readonly onMissingLedger?: () => void;
}

export function ensureBudgetLedger(input: EnsureBudgetLedgerInput): BudgetLedger {
  const repository = new BudgetRepository(input.connection);
  const existing = repository.getLedger(input.budgetLedgerId);
  if (existing != null) {
    return existing;
  }
  const ledger = createBudgetLedger({
    budgetLedgerId: input.budgetLedgerId,
    tenantId: input.tenantId,
    harnessRunId: input.harnessRunId,
    currency: input.currency,
    hardCap: input.hardCap,
  });
  repository.insertLedger(ledger);
  return ledger;
}

export function reserveBudgetLedger(input: ReserveBudgetLedgerInput): BudgetReservationResult {
  const repository = new BudgetRepository(input.connection);
  const ledger = repository.getLedger(input.budgetLedgerId);
  if (ledger == null) {
    input.onMissingLedger?.();
    throw new ValidationError(
      "budget_ledger.not_found",
      `budget_ledger.not_found: budget ledger ${input.budgetLedgerId} must exist before reservation.`,
    );
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
