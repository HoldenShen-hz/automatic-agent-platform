/**
 * BudgetRepository - Data access for budget_ledgers, budget_reservations, and budget_settlements tables.
 *
 * Provides SQL-level atomic CAS (Compare-and-Swap) operations for concurrent settle/release
 * operations to prevent balance inconsistency. Uses row-level locking via UPDATE ... WHERE
 * with version checks to ensure atomicity.
 *
 * R11-12 FIX: Budget ledger updates must use SQL-level CAS to prevent race conditions
 * when multiple concurrent operations try to settle/release the same ledger.
 */

import type { BudgetLedger, BudgetReservation, BudgetSettlement } from "../sqlite-repository-contracts.js";
import type { SqliteConnection } from "../query-helper.js";
import { queryAll, queryOne } from "../query-helper.js";

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
  version: number;
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

export class BudgetRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * Get a budget ledger by ID.
   */
  public getLedger(budgetLedgerId: string): BudgetLedger | null {
    const row = queryOne<BudgetLedgerRow>(
      this.conn,
      `SELECT
        budget_ledger_id AS budgetLedgerId,
        tenant_id AS tenantId,
        harness_run_id AS harnessRunId,
        currency,
        hard_cap AS hardCap,
        reserved_amount AS reservedAmount,
        settled_amount AS settledAmount,
        released_amount AS releasedAmount,
        status,
        version
       FROM budget_ledgers
       WHERE budget_ledger_id = ?`,
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
  public getReservation(budgetReservationId: string): BudgetReservation | null {
    const row = queryOne<BudgetReservationRow>(
      this.conn,
      `SELECT
        budget_reservation_id AS budgetReservationId,
        budget_ledger_id AS budgetLedgerId,
        harness_run_id AS harnessRunId,
        node_run_id AS nodeRunId,
        amount,
        resource_kind AS resourceKind,
        status,
        expires_at AS expiresAt,
        created_at AS createdAt,
        0 AS version
       FROM budget_reservations
       WHERE budget_reservation_id = ?`,
      budgetReservationId,
    );
    if (!row) return null;
    return {
      budgetReservationId: row.budgetReservationId,
      budgetLedgerId: row.budgetLedgerId,
      harnessRunId: row.harnessRunId,
      amount: row.amount,
      resourceKind: row.resourceKind as BudgetReservation["resourceKind"],
      status: row.status as BudgetReservation["status"],
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      version: row.version,
      ...(row.nodeRunId != null ? { nodeRunId: row.nodeRunId } : {}),
    };
  }

  public updateLedgerWithReservation(
    ledger: BudgetLedger,
    reservation: BudgetReservation,
    expectedVersion: number,
  ): CasUpdateResult {
    const result = this.conn.prepare(
      `UPDATE budget_ledgers
       SET reserved_amount = ?,
           status = ?,
           version = ?
       WHERE budget_ledger_id = ?
         AND version = ?`,
    ).run(
      ledger.reservedAmount,
      ledger.status,
      ledger.version,
      ledger.budgetLedgerId,
      expectedVersion,
    );

    if (result.changes === 0) {
      return { success: false, rowsAffected: 0 };
    }

    this.insertReservation(reservation);

    return {
      success: true,
      rowsAffected: Number(result.changes),
      ledger: {
        ...ledger,
      },
    };
  }

  /**
   * R11-12: CAS atomic settle - updates ledger with version check.
   *
   * Uses SQL-level atomicity: UPDATE ... WHERE version = expectedVersion
   * If another concurrent operation modified the ledger first, the version
   * will not match and the update fails (returns success: false).
   *
   * @param ledger - Current ledger state
   * @param reservation - Reservation being settled
   * @param actualAmount - Actual amount consumed
   * @param expectedVersion - Expected ledger version for CAS
   * @param settlement - Settlement record to insert
   * @returns CasUpdateResult with success=true and updated ledger if CAS succeeded
   */
  public updateLedgerWithSettle(
    ledger: BudgetLedger,
    reservation: BudgetReservation,
    actualAmount: number,
    expectedVersion: number,
    settlement: BudgetSettlement,
  ): CasUpdateResult {
    // Compute new amounts
    const newReservedAmount = Math.max(0, ledger.reservedAmount - reservation.amount);
    const newSettledAmount = ledger.settledAmount + actualAmount;
    const newReleasedAmount = ledger.releasedAmount + Math.max(0, reservation.amount - actualAmount);
    const newVersion = ledger.version + 1;

    // First, persist the settlement record
    this.conn.prepare(
      `INSERT INTO budget_settlements (budget_settlement_id, budget_reservation_id, actual_amount, settlement_kind, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      settlement.budgetSettlementId,
      settlement.budgetReservationId,
      settlement.actualAmount,
      settlement.settlementKind,
      settlement.createdAt,
    );

    // Then atomically update the ledger with CAS version check
    const result = this.conn.prepare(
      `UPDATE budget_ledgers
       SET reserved_amount = ?,
           settled_amount = ?,
           released_amount = ?,
           version = ?
       WHERE budget_ledger_id = ?
         AND version = ?`,
    ).run(
      newReservedAmount,
      newSettledAmount,
      newReleasedAmount,
      newVersion,
      ledger.budgetLedgerId,
      expectedVersion,
    );

    if (result.changes === 0) {
      // Version mismatch - concurrent modification detected
      return { success: false, rowsAffected: 0 };
    }

    return {
      success: true,
      rowsAffected: Number(result.changes),
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
   * R11-12: CAS atomic release - updates ledger with version check.
   *
   * Uses SQL-level atomicity: UPDATE ... WHERE version = expectedVersion
   * If another concurrent operation modified the ledger first, the version
   * will not match and the update fails (returns success: false).
   *
   * @param ledger - Current ledger state
   * @param reservation - Reservation being released
   * @param expectedVersion - Expected ledger version for CAS
   * @param settlement - Release settlement record to insert (settlementKind = 'release_unused')
   * @returns CasUpdateResult with success=true and updated ledger if CAS succeeded
   */
  public updateLedgerWithRelease(
    ledger: BudgetLedger,
    reservation: BudgetReservation,
    expectedVersion: number,
    settlement: BudgetSettlement,
  ): CasUpdateResult {
    // Compute new amounts
    const newReservedAmount = Math.max(0, ledger.reservedAmount - reservation.amount);
    const newReleasedAmount = ledger.releasedAmount + reservation.amount;
    const newVersion = ledger.version + 1;

    // First, persist the settlement record
    this.conn.prepare(
      `INSERT INTO budget_settlements (budget_settlement_id, budget_reservation_id, actual_amount, settlement_kind, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      settlement.budgetSettlementId,
      settlement.budgetReservationId,
      settlement.actualAmount,
      settlement.settlementKind,
      settlement.createdAt,
    );

    // Then atomically update the ledger with CAS version check
    const result = this.conn.prepare(
      `UPDATE budget_ledgers
       SET reserved_amount = ?,
           released_amount = ?,
           version = ?
       WHERE budget_ledger_id = ?
         AND version = ?`,
    ).run(
      newReservedAmount,
      newReleasedAmount,
      newVersion,
      ledger.budgetLedgerId,
      expectedVersion,
    );

    if (result.changes === 0) {
      // Version mismatch - concurrent modification detected
      return { success: false, rowsAffected: 0 };
    }

    return {
      success: true,
      rowsAffected: Number(result.changes),
      ledger: {
        ...ledger,
        reservedAmount: newReservedAmount,
        releasedAmount: newReleasedAmount,
        version: newVersion,
      },
    };
  }

  /**
   * Insert a new budget ledger.
   */
  public insertLedger(ledger: BudgetLedger): void {
    this.conn.prepare(
      `INSERT INTO budget_ledgers (
        budget_ledger_id, tenant_id, harness_run_id, currency,
        hard_cap, reserved_amount, settled_amount, released_amount,
        status, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
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
  public insertReservation(reservation: BudgetReservation): void {
    this.conn.prepare(
      `INSERT INTO budget_reservations (
        budget_reservation_id, budget_ledger_id, harness_run_id, node_run_id,
        amount, resource_kind, status, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
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

  /**
   * List all settlements for a reservation.
   */
  public listSettlementsByReservation(budgetReservationId: string): BudgetSettlementRow[] {
    return queryAll<BudgetSettlementRow>(
      this.conn,
      `SELECT
        budget_settlement_id AS budgetSettlementId,
        budget_reservation_id AS budgetReservationId,
        actual_amount AS actualAmount,
        settlement_kind AS settlementKind,
        created_at AS createdAt
       FROM budget_settlements
       WHERE budget_reservation_id = ?
       ORDER BY created_at ASC`,
      budgetReservationId,
    );
  }
}
