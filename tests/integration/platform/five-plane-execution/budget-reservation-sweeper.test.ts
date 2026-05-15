/**
 * Integration Test: Budget Reservation Sweeper
 *
 * Tests TTL-based cleanup of expired budget reservations.
 * Validates R9-08 lease TTL bounds enforcement.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { BudgetReservationSweeper, BudgetReservationSweepRecord } from "../../../../src/platform/five-plane-execution/budget-reservation-sweeper.js";

function makeReservation(overrides: Partial<BudgetReservationSweepRecord> = {}): BudgetReservationSweepRecord {
  const now = new Date().toISOString();
  return {
    reservationId: "res-default",
    runId: "run-default",
    status: "reserved",
    expiresAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("integration: BudgetReservationSweeper expires reservations past their TTL", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-expired-");
  try {
    const sweeper = new BudgetReservationSweeper();

    // Create a reservation that expired 1 hour ago
    const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString();
    const reservations = [
      makeReservation({
        reservationId: "res-expired-001",
        runId: "run-orphaned",
        expiresAt: expiredAt,
        status: "reserved",
      }),
    ];

    const result = sweeper.sweep({
      reservations,
      activeRunIds: new Set(), // No active runs
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 0,
    });

    assert.equal(result.orphanedReservationCount, 1);
    assert.ok(result.releaseReservationIds.includes("res-expired-001"));
    assert.equal(result.metric.name, "harness.budget.orphaned_reservation_count");
    assert.equal(result.metric.value, 1);
  } finally {
    ctx.cleanup();
  }
});

test("integration: BudgetReservationSweeper does not expire active reservations", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-active-");
  try {
    const sweeper = new BudgetReservationSweeper();

    // Create a reservation that expired but the run is still active
    const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString();
    const reservations = [
      makeReservation({
        reservationId: "res-active-001",
        runId: "run-still-active",
        expiresAt: expiredAt,
        status: "reserved",
      }),
    ];

    const result = sweeper.sweep({
      reservations,
      activeRunIds: new Set(["run-still-active"]), // Run is still active
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 0,
    });

    assert.equal(result.orphanedReservationCount, 0);
    assert.ok(!result.releaseReservationIds.includes("res-active-001"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: BudgetReservationSweeper ignores settled reservations", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-settled-");
  try {
    const sweeper = new BudgetReservationSweeper();

    const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString();
    const reservations = [
      makeReservation({
        reservationId: "res-settled-001",
        runId: "run-orphaned",
        expiresAt: expiredAt,
        status: "settled", // Already settled, should be ignored
      }),
    ];

    const result = sweeper.sweep({
      reservations,
      activeRunIds: new Set(),
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 0,
    });

    assert.equal(result.orphanedReservationCount, 0);
    assert.ok(!result.releaseReservationIds.includes("res-settled-001"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: BudgetReservationSweeper ignores released reservations", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-released-");
  try {
    const sweeper = new BudgetReservationSweeper();

    const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString();
    const reservations = [
      makeReservation({
        reservationId: "res-released-001",
        runId: "run-orphaned",
        expiresAt: expiredAt,
        status: "released", // Already released, should be ignored
      }),
    ];

    const result = sweeper.sweep({
      reservations,
      activeRunIds: new Set(),
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 0,
    });

    assert.equal(result.orphanedReservationCount, 0);
    assert.ok(!result.releaseReservationIds.includes("res-released-001"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: BudgetReservationSweeper applies clock skew safety margin", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-clock-skew-");
  try {
    const sweeper = new BudgetReservationSweeper();

    // Reservation expired only 500ms ago
    const justExpiredAt = new Date(Date.now() - 500).toISOString();
    const reservations = [
      makeReservation({
        reservationId: "res-just-expired",
        runId: "run-orphaned",
        expiresAt: justExpiredAt,
        status: "reserved",
      }),
    ];

    // With 0ms margin, should be expired
    const resultNoMargin = sweeper.sweep({
      reservations,
      activeRunIds: new Set(),
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 0,
    });
    assert.equal(resultNoMargin.orphanedReservationCount, 1);

    // With 10s margin, should NOT be expired yet
    const resultWithMargin = sweeper.sweep({
      reservations,
      activeRunIds: new Set(),
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 10_000,
    });
    assert.equal(resultWithMargin.orphanedReservationCount, 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: BudgetReservationSweeper handles high volume of reservations efficiently", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-high-volume-");
  try {
    const sweeper = new BudgetReservationSweeper();

    const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString();
    const activeAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // Create 1000 reservations - half expired, half active
    const reservations: BudgetReservationSweepRecord[] = [];
    const expiredIds: string[] = [];
    const activeIds: string[] = [];

    for (let i = 0; i < 500; i++) {
      const id = `res-expired-${i}`;
      expiredIds.push(id);
      reservations.push(
        makeReservation({
          reservationId: id,
          runId: `run-orphaned-${i}`,
          expiresAt: expiredAt,
          status: "reserved",
        })
      );
    }

    for (let i = 0; i < 500; i++) {
      const id = `res-active-${i}`;
      activeIds.push(id);
      reservations.push(
        makeReservation({
          reservationId: id,
          runId: `run-active-${i}`,
          expiresAt: activeAt,
          status: "reserved",
        })
      );
    }

    const start = Date.now();
    const result = sweeper.sweep({
      reservations,
      activeRunIds: new Set(activeIds),
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 0,
    });
    const elapsed = Date.now() - start;

    // All expired orphaned reservations should be identified
    assert.equal(result.orphanedReservationCount, 500);
    assert.equal(result.releaseReservationIds.length, 500);

    // Performance: should complete in under 100ms for 1000 reservations
    assert.ok(elapsed < 100, `Sweep took ${elapsed}ms, expected < 100ms`);
  } finally {
    ctx.cleanup();
  }
});

test("integration: BudgetReservationSweeper TTL enforcement matches R9-08 lease TTL bounds", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-r9-08-");
  try {
    const sweeper = new BudgetReservationSweeper();

    // R9-08: Lease TTL bounds - test boundary conditions
    // Reservation at exact TTL boundary
    const dbTime = "2026-05-15T10:00:01.000Z";
    const exactlyAtTTL = "2026-05-15T10:00:01.000Z";
    // Reservation just before TTL boundary
    const justWithinTTL = "2026-05-15T10:00:01.001Z";
    // Reservation just past TTL boundary
    const justPastTTL = "2026-05-15T10:00:00.999Z";

    const reservations = [
      makeReservation({
        reservationId: "res-exactly-at-ttl",
        runId: "run-orphaned-1",
        expiresAt: exactlyAtTTL,
        status: "reserved",
      }),
      makeReservation({
        reservationId: "res-just-within-ttl",
        runId: "run-orphaned-2",
        expiresAt: justWithinTTL,
        status: "reserved",
      }),
      makeReservation({
        reservationId: "res-just-past-ttl",
        runId: "run-orphaned-3",
        expiresAt: justPastTTL,
        status: "reserved",
      }),
    ];

    const result = sweeper.sweep({
      reservations,
      activeRunIds: new Set(),
      dbTime,
      clockSkewSafetyMarginMs: 0,
    });

    // Just-past-TTL should be expired
    assert.ok(
      result.releaseReservationIds.includes("res-just-past-ttl"),
      "Reservation past TTL should be expired"
    );

    // Exactly-at-TTL is expired; just-within-TTL should NOT be expired.
    assert.ok(
      result.releaseReservationIds.includes("res-exactly-at-ttl"),
      "Reservation at exact TTL boundary should be expired"
    );
    assert.ok(
      !result.releaseReservationIds.includes("res-just-within-ttl"),
      "Reservation within TTL bounds should not be expired"
    );
  } finally {
    ctx.cleanup();
  }
});

test("integration: BudgetReservationSweeper handles mixed reservation states", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-mixed-");
  try {
    const sweeper = new BudgetReservationSweeper();

    const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString();
    const futureAt = new Date(Date.now() + 3600 * 1000).toISOString();

    const reservations = [
      // Expired reserved - should be released
      makeReservation({
        reservationId: "res-1",
        runId: "run-orphaned-1",
        expiresAt: expiredAt,
        status: "reserved",
      }),
      // Active reserved - should NOT be released
      makeReservation({
        reservationId: "res-2",
        runId: "run-active-1",
        expiresAt: expiredAt,
        status: "reserved",
      }),
      // Expired settled - should NOT be released
      makeReservation({
        reservationId: "res-3",
        runId: "run-orphaned-2",
        expiresAt: expiredAt,
        status: "settled",
      }),
      // Future reserved - should NOT be released
      makeReservation({
        reservationId: "res-4",
        runId: "run-orphaned-3",
        expiresAt: futureAt,
        status: "reserved",
      }),
      // Expired released - should NOT be released
      makeReservation({
        reservationId: "res-5",
        runId: "run-orphaned-4",
        expiresAt: expiredAt,
        status: "released",
      }),
    ];

    const result = sweeper.sweep({
      reservations,
      activeRunIds: new Set(["run-active-1"]),
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 0,
    });

    // Only res-1 should be released (expired, reserved, no active run)
    assert.equal(result.orphanedReservationCount, 1);
    assert.deepStrictEqual(result.releaseReservationIds, ["res-1"]);
  } finally {
    ctx.cleanup();
  }
});

test("integration: BudgetReservationSweeper returns correct metric", () => {
  const ctx = createIntegrationContext("aa-budget-sweep-metric-");
  try {
    const sweeper = new BudgetReservationSweeper();

    const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString();
    const reservations = [
      makeReservation({
        reservationId: "res-metric-1",
        runId: "run-orphaned-1",
        expiresAt: expiredAt,
        status: "reserved",
      }),
      makeReservation({
        reservationId: "res-metric-2",
        runId: "run-orphaned-2",
        expiresAt: expiredAt,
        status: "reserved",
      }),
    ];

    const result = sweeper.sweep({
      reservations,
      activeRunIds: new Set(),
      dbTime: new Date().toISOString(),
      clockSkewSafetyMarginMs: 0,
    });

    assert.equal(result.metric.name, "harness.budget.orphaned_reservation_count");
    assert.equal(result.metric.value, 2);
    assert.equal(result.metric.value, result.orphanedReservationCount);
  } finally {
    ctx.cleanup();
  }
});
