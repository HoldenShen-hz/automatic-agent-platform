/**
 * Budget Reservation Sweeper Unit Tests
 *
 * Tests cleanup of orphaned and expired budget reservations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BudgetReservationSweeper, type BudgetReservationSweepRecord } from "../../../../src/platform/five-plane-execution/budget-reservation-sweeper.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

function createSweepRecord(overrides: Partial<BudgetReservationSweepRecord> = {}): BudgetReservationSweepRecord {
  const now = new Date();
  return {
    reservationId: "res-001",
    runId: "run-001",
    status: "reserved",
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function createActiveRunIds(ids: string[]): ReadonlySet<string> {
  return new Set(ids);
}

// ---------------------------------------------------------------------------
// Tests: sweep()
// ---------------------------------------------------------------------------

test("sweep() returns empty result when no reservations provided", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date().toISOString();

  const result = sweeper.sweep({
    reservations: [],
    activeRunIds: createActiveRunIds(["run-001"]),
    dbTime: now,
    clockSkewSafetyMarginMs: 1000,
  });

  assert.equal(result.orphanedReservationCount, 0);
  assert.equal(result.releaseReservationIds.length, 0);
  assert.equal(result.metric.value, 0);
});

test("sweep() identifies reservation from inactive run as orphaned", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();
  const expiredExpiresAt = new Date(now.getTime() - 60_000).toISOString(); // Expired 1 minute ago

  const record = createSweepRecord({
    reservationId: "res-orphaned",
    runId: "run-inactive",
    status: "reserved",
    expiresAt: expiredExpiresAt,
  });

  const result = sweeper.sweep({
    reservations: [record],
    activeRunIds: createActiveRunIds(["run-active"]), // run-inactive is NOT active
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000,
  });

  assert.equal(result.orphanedReservationCount, 1);
  assert.deepEqual(result.releaseReservationIds, ["res-orphaned"]);
});

test("sweep() does not flag reservation from active run", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();
  const expiredExpiresAt = new Date(now.getTime() - 60_000).toISOString();

  const record = createSweepRecord({
    reservationId: "res-active",
    runId: "run-active", // This run IS active
    status: "reserved",
    expiresAt: expiredExpiresAt,
  });

  const result = sweeper.sweep({
    reservations: [record],
    activeRunIds: createActiveRunIds(["run-active"]),
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000,
  });

  assert.equal(result.orphanedReservationCount, 0);
  assert.equal(result.releaseReservationIds.length, 0);
});

test("sweep() ignores non-reserved status reservations", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();
  const expiredExpiresAt = new Date(now.getTime() - 60_000).toISOString();

  const settledRecord = createSweepRecord({
    reservationId: "res-settled",
    runId: "run-inactive",
    status: "settled", // Not "reserved"
    expiresAt: expiredExpiresAt,
  });

  const releasedRecord = createSweepRecord({
    reservationId: "res-released",
    runId: "run-inactive",
    status: "released", // Not "reserved"
    expiresAt: expiredExpiresAt,
  });

  const result = sweeper.sweep({
    reservations: [settledRecord, releasedRecord],
    activeRunIds: createActiveRunIds([]),
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000,
  });

  assert.equal(result.orphanedReservationCount, 0);
});

test("sweep() handles invalid date format (NaN) by expiring immediately", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();

  const invalidDateRecord = createSweepRecord({
    reservationId: "res-invalid-date",
    runId: "run-inactive",
    status: "reserved",
    expiresAt: "invalid-date-string",
  });

  const result = sweeper.sweep({
    reservations: [invalidDateRecord],
    activeRunIds: createActiveRunIds([]),
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000,
  });

  // Invalid dates should be cleaned up (expired immediately)
  assert.equal(result.orphanedReservationCount, 1);
  assert.deepEqual(result.releaseReservationIds, ["res-invalid-date"]);
});

test("sweep() respects clock skew safety margin", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();
  // Reservation expires in 500ms, but clock skew margin is 1000ms
  // So it should NOT be considered expired yet
  const expiresSoon = new Date(now.getTime() - 500).toISOString();

  const record = createSweepRecord({
    reservationId: "res-not-yet-expired",
    runId: "run-inactive",
    status: "reserved",
    expiresAt: expiresSoon,
  });

  const result = sweeper.sweep({
    reservations: [record],
    activeRunIds: createActiveRunIds([]),
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000, // 1 second margin
  });

  assert.equal(result.orphanedReservationCount, 0);
});

test("sweep() returns correct metric", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();
  const expiredExpiresAt = new Date(now.getTime() - 60_000).toISOString();

  const record1 = createSweepRecord({
    reservationId: "res-1",
    runId: "run-inactive",
    status: "reserved",
    expiresAt: expiredExpiresAt,
  });

  const record2 = createSweepRecord({
    reservationId: "res-2",
    runId: "run-inactive",
    status: "reserved",
    expiresAt: expiredExpiresAt,
  });

  const result = sweeper.sweep({
    reservations: [record1, record2],
    activeRunIds: createActiveRunIds([]),
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000,
  });

  assert.equal(result.metric.name, "harness.budget.orphaned_reservation_count");
  assert.equal(result.metric.value, 2);
});

test("sweep() processes multiple reservations and returns correct dbTime", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();
  const expiredExpiresAt = new Date(now.getTime() - 60_000).toISOString();

  const reservations: BudgetReservationSweepRecord[] = [
    createSweepRecord({ reservationId: "res-1", runId: "run-1", expiresAt: expiredExpiresAt }),
    createSweepRecord({ reservationId: "res-2", runId: "run-2", expiresAt: expiredExpiresAt }),
    createSweepRecord({ reservationId: "res-3", runId: "run-3", status: "settled", expiresAt: expiredExpiresAt }), // Should be ignored
  ];

  const result = sweeper.sweep({
    reservations,
    activeRunIds: createActiveRunIds([]),
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 500,
  });

  assert.equal(result.orphanedReservationCount, 2);
  assert.equal(result.dbTime, now.toISOString());
  assert.equal(result.clockSkewSafetyMarginMs, 500);
});

test("sweep() handles empty active run ids set", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();
  const expiredExpiresAt = new Date(now.getTime() - 60_000).toISOString();

  const record = createSweepRecord({
    reservationId: "res-all-inactive",
    runId: "run-any",
    status: "reserved",
    expiresAt: expiredExpiresAt,
  });

  const result = sweeper.sweep({
    reservations: [record],
    activeRunIds: createActiveRunIds([]), // No active runs
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000,
  });

  assert.equal(result.orphanedReservationCount, 1);
});

test("sweep() returns deterministic results for same input", () => {
  const sweeper = new BudgetReservationSweeper();
  const now = new Date();
  const expiredExpiresAt = new Date(now.getTime() - 60_000).toISOString();

  const record = createSweepRecord({
    reservationId: "res-deterministic",
    runId: "run-inactive",
    status: "reserved",
    expiresAt: expiredExpiresAt,
  });

  const result1 = sweeper.sweep({
    reservations: [record],
    activeRunIds: createActiveRunIds([]),
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000,
  });

  const result2 = sweeper.sweep({
    reservations: [record],
    activeRunIds: createActiveRunIds([]),
    dbTime: now.toISOString(),
    clockSkewSafetyMarginMs: 1000,
  });

  assert.deepEqual(result1.releaseReservationIds, result2.releaseReservationIds);
  assert.equal(result1.orphanedReservationCount, result2.orphanedReservationCount);
});
