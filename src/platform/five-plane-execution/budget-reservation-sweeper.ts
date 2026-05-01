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
    const dbNow = Date.parse(input.dbTime);
    const releaseReservationIds = input.reservations
      .filter((reservation) => reservation.status === "reserved")
      .filter((reservation) => !input.activeRunIds.has(reservation.runId))
      .filter((reservation) => {
        const expiresAtMs = Date.parse(reservation.expiresAt);
        // R16-16 FIX: Handle NaN from invalid date format - expire immediately
        if (Number.isNaN(expiresAtMs)) {
          return true; // Invalid dates should be cleaned up
        }
        return expiresAtMs + input.clockSkewSafetyMarginMs <= dbNow;
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
