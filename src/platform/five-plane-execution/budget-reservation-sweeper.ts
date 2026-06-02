import { ValidationError } from "../contracts/errors.js";

export interface BudgetReservationSweepRecord {
  readonly reservationId: string;
  readonly runId: string;
  readonly status: "reserved" | "settled" | "released";
  readonly expiresAt: string;
  readonly updatedAt: string;
}

export interface BudgetReservationSweepResult {
  readonly dbTime: string;
  readonly clockSkewSafetyMarginMs: number;
  readonly orphanedReservationCount: number;
  readonly releaseReservationIds: readonly string[];
  readonly metric: {
    readonly name: "harness.budget.orphaned_reservation_count";
    readonly value: number;
  };
}

export class BudgetReservationSweeper {
  public sweep(input: {
    readonly reservations: readonly BudgetReservationSweepRecord[];
    readonly activeRunIds: ReadonlySet<string>;
    readonly dbTime: string;
    readonly clockSkewSafetyMarginMs: number;
  }): BudgetReservationSweepResult {
    const dbNow = parseSweepDbTime(input.dbTime);
    const releaseReservationIds = input.reservations
      .filter((reservation) => reservation.status === "reserved")
      .filter((reservation) => !input.activeRunIds.has(reservation.runId))
      .filter((reservation) => {
        const expiresAt = Date.parse(reservation.expiresAt);
        return !Number.isFinite(expiresAt) || expiresAt + input.clockSkewSafetyMarginMs <= dbNow;
      })
      .map((reservation) => reservation.reservationId);

    return {
      dbTime: input.dbTime,
      clockSkewSafetyMarginMs: input.clockSkewSafetyMarginMs,
      orphanedReservationCount: releaseReservationIds.length,
      releaseReservationIds,
      metric: {
        name: "harness.budget.orphaned_reservation_count",
        value: releaseReservationIds.length,
      },
    };
  }
}

function parseSweepDbTime(dbTime: string): number {
  const parsed = Date.parse(dbTime);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(
      "budget_reservation.invalid_db_time",
      `budget_reservation.invalid_db_time: dbTime must be a valid timestamp, received ${dbTime}.`,
    );
  }
  return parsed;
}
