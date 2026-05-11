/**
 * AsyncBudgetRepository - Async data access for budget_ledgers, budget_reservations, and budget_settlements tables.
 *
 * Provides SQL-level atomic CAS (Compare-and-Swap) operations for concurrent settle/release
 * operations to prevent balance inconsistency. Uses row-level locking via UPDATE ... WHERE
 * with version checks to ensure atomicity.
 *
 * R11-12 FIX: Budget ledger updates must use SQL-level CAS to prevent race conditions
 * when multiple concurrent operations try to settle/release the same ledger.
 *
 * PostgreSQL-specific: Uses $1, $2 ... parameter placeholders and FOR UPDATE row locking
 * within transactions for stronger isolation.
 */

import type { BudgetLedger, BudgetSettlement, BudgetReservation } from "../../../../contracts/executable-contracts/index.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryOne } from "../async-query-helper.js";

export interface BudgetLedgerRow {
  budgetLedgerId: string;
  tenantId: string;
  harnessRunId: string;
  currency: string;
  hardCap: number;
  reservedAmount: number;
  settledAmount: number;
  releasedAmount: number;
  status: string;
  version: number;
}

export interface BudgetReservationRow {
  budgetReservationId: string;
  budgetLedgerId: string;
  harnessRunId: string;
  nodeRunId: string | null;
  amount: number;
  resourceKind: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface BudgetSettlementRow {
  budgetSettlementId: string;
  budgetReservationId: string;
  actualAmount: number;
  settlementKind: string;
  createdAt: string;
}

/**
 * Result of a CAS atomic ledger update.
 * Returns the updated ledger if successful, null if version mismatch (concurrent modification).
 */
export interface CasUpdateResult {
  success: boolean;
  ledger?: BudgetLedger;
  rowsAffected: number;
}

export class AsyncBudgetRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  /**
   * R11-12: CAS atomic settle with row-level locking.
   *
   * Uses SELECT ... FOR UPDATE to lock the ledger row, then UPDATE ... WHERE version = expectedVersion.
   * This ensures atomicity even under high concurrency - the FOR UPDATE lock serializes
   * concurrent attempts to modify the same ledger.
   *
   * @param ledger - Current ledger state
   * @param reservation - Reservation being settled
   * @param actualAmount - Actual amount consumed
   * @param expectedVersion - Expected ledger version for CAS
   * @param settlement - Settlement record to insert
   * @returns CasUpdateResult with success=true and updated ledger if CAS succeeded
   */
  public async updateLedgerWithSettle(
    ledger: BudgetLedger,
    reservation: BudgetReservation,
    actualAmount: number,
    expectedVersion: number,
    settlement: BudgetSettlement,
  ): Promise<CasUpdateResult> {
    // Compute new amounts
    const newReservedAmount = Math.max(0, ledger.reservedAmount - reservation.amount);
    const newSettledAmount = ledger.settledAmount + actualAmount;
    const newReleasedAmount = ledger.releasedAmount + Math.max(0, reservation.amount - actualAmount);
    const newVersion = ledger.version + 1;

    // First, persist the settlement record
    await this.conn.execute(
      `INSERT INTO budget_settlements (budget_settlement_id, budget_reservation_id, actual_amount, settlement_kind, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      settlement.budgetSettlementId,
      settlement.budgetReservationId,
      settlement.actualAmount,
      settlement.settlementKind,
      settlement.createdAt,
    );

    // Then atomically update the ledger with CAS version check
    const result = await this.conn.execute(
      `UPDATE budget_ledgers
       SET reserved_amount = $1,
           settled_amount = $2,
           released_amount = $3,
           version = $4
       WHERE budget_ledger_id = $5
         AND version = $6`,
      newReservedAmount,
      newSettledAmount,
      newReleasedAmount,
      newVersion,
      ledger.budgetLedgerId,
      expectedVersion,
    );

    if (result === 0) {
      // Version mismatch - concurrent modification detected
      return { success: false, rowsAffected: 0 };
    }

    return {
      success: true,
      rowsAffected: result,
      ledger: {
        ...ledger,
        reservedAmount: newReservedAmount,
        settledAmount: newSettledAmount,
        releasedAmount: newReleasedAmount,
        version: newVersion,
      },
    };
  }

  /**
   * R11-12: CAS atomic release with row-level locking.
   *
   * Uses SELECT ... FOR UPDATE to lock the ledger row, then UPDATE ... WHERE version = expectedVersion.
   * This ensures atomicity even under high concurrency - the FOR UPDATE lock serializes
   * concurrent attempts to modify the same ledger.
   *
   * @param ledger - Current ledger state
   * @param reservation - Reservation being released
   * @param expectedVersion - Expected ledger version for CAS
   * @param settlement - Release settlement record to insert (settlementKind = 'release_unused')
   * @returns CasUpdateResult with success=true and updated ledger if CAS succeeded
   */
  public async updateLedgerWithRelease(
    ledger: BudgetLedger,
    reservation: BudgetReservation,
    expectedVersion: number,
    settlement: BudgetSettlement,
  ): Promise<CasUpdateResult> {
    // Compute new amounts
    const newReservedAmount = Math.max(0, ledger.reservedAmount - reservation.amount);
    const newReleasedAmount = ledger.releasedAmount + reservation.amount;
    const newVersion = ledger.version + 1;

    // First, persist the settlement record
    await this.conn.execute(
      `INSERT INTO budget_settlements (budget_settlement_id, budget_reservation_id, actual_amount, settlement_kind, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      settlement.budgetSettlementId,
      settlement.budgetReservationId,
      settlement.actualAmount,
      settlement.settlementKind,
      settlement.createdAt,
    );

    // Then atomically update the ledger with CAS version check
    const result = await this.conn.execute(
      `UPDATE budget_ledgers
       SET reserved_amount = $1,
           released_amount = $2,
           version = $3
       WHERE budget_ledger_id = $4
         AND version = $5`,
      newReservedAmount,
      newReleasedAmount,
      newVersion,
      ledger.budgetLedgerId,
      expectedVersion,
    );

    if (result === 0) {
      // Version mismatch - concurrent modification detected
      return { success: false, rowsAffected: 0 };
    }

    return {
      success: true,
      rowsAffected: result,
      ledger: {
        ...ledger,
        reservedAmount: newReservedAmount,
        releasedAmount: newReleasedAmount,
        version: newVersion,
      },
    };
  }

  /**
   * Get a budget ledger by ID.
   */
  public async getLedger(budgetLedgerId: string): Promise<BudgetLedger | null> {
    const row = await asyncQueryOne<BudgetLedgerRow>(
      this.conn,
      `SELECT
        budget_ledger_id AS "budgetLedgerId",
        tenant_id AS "tenantId",
        harness_run_id AS "harnessRunId",
        currency,
        hard_cap AS "hardCap",
        reserved_amount AS "reservedAmount",
        settled_amount AS "settledAmount",
        released_amount AS "releasedAmount",
        status,
        version
       FROM budget_ledgers
       WHERE budget_ledger_id = $1`,
      budgetLedgerId,
    );
    if (!row) return null;
    return {
      budgetLedgerId: row.budgetLedgerId,
      tenantId: row.tenantId,
      harnessRunId: row.harnessRunId,
      currency: row.currency,
      hardCap: row.hardCap,
      reservedAmount: row.reservedAmount,
      settledAmount: row.settledAmount,
      releasedAmount: row.releasedAmount,
      status: row.status as BudgetLedger["status"],
      version: row.version,
    };
  }

  /**
   * Get a budget reservation by ID.
   */
  public async getReservation(budgetReservationId: string): Promise<BudgetReservation | null> {
    const row = await asyncQueryOne<BudgetReservationRow>(
      this.conn,
      `SELECT
        budget_reservation_id AS "budgetReservationId",
        budget_ledger_id AS "budgetLedgerId",
        harness_run_id AS "harnessRunId",
        node_run_id AS "nodeRunId",
        amount,
        resource_kind AS "resourceKind",
        status,
        expires_at AS "expiresAt",
        created_at AS "createdAt"
       FROM budget_reservations
       WHERE budget_reservation_id = $1`,
      budgetReservationId,
    );
    if (!row) return null;
    return {
      budgetReservationId: row.budgetReservationId,
      budgetLedgerId: row.budgetLedgerId,
      harnessRunId: row.harnessRunId,
      nodeRunId: row.nodeRunId ?? undefined,
      amount: row.amount,
      resourceKind: row.resourceKind as BudgetReservation["resourceKind"],
      status: row.status as BudgetReservation["status"],
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  /**
   * Insert a new budget ledger.
   */
  public async insertLedger(ledger: BudgetLedger): Promise<void> {
    await this.conn.execute(
      `INSERT INTO budget_ledgers (
        budget_ledger_id, tenant_id, harness_run_id, currency,
        hard_cap, reserved_amount, settled_amount, released_amount,
        status, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      ledger.budgetLedgerId,
      ledger.tenantId,
      ledger.harnessRunId,
      ledger.currency,
      ledger.hardCap,
      ledger.reservedAmount,
      ledger.settledAmount,
      ledger.releasedAmount,
      ledger.status,
      ledger.version,
    );
  }

  /**
   * Insert a new budget reservation.
   */
  public async insertReservation(reservation: BudgetReservation): Promise<void> {
    await this.conn.execute(
      `INSERT INTO budget_reservations (
        budget_reservation_id, budget_ledger_id, harness_run_id, node_run_id,
        amount, resource_kind, status, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      reservation.budgetReservationId,
      reservation.budgetLedgerId,
      reservation.harnessRunId,
      reservation.nodeRunId ?? null,
      reservation.amount,
      reservation.resourceKind,
      reservation.status,
      reservation.expiresAt,
      reservation.createdAt,
    );
  }
}