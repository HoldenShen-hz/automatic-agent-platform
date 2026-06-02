import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { createBudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import {
  BudgetAllocator,
  BudgetTier,
  type BudgetAllocatorContext,
} from "../../../../src/platform/five-plane-execution/budget-allocator.js";

const TENANT_ID = "tenant-test";
const HARNESS_RUN_ID = newId("hrun");
const LEDGER_ID = newId("bledger");

function createContext(overrides: Partial<BudgetAllocatorContext> = {}): BudgetAllocatorContext {
  return {
    tenantId: TENANT_ID,
    traceId: newId("trace"),
    emittedBy: "test",
    principal: "tester",
    fencingToken: "fence-1",
    tier: BudgetTier.STEP,
    tierLimit: 1_000,
    ...overrides,
  };
}

function createLedger(overrides: Record<string, unknown> = {}) {
  return createBudgetLedger({
    budgetLedgerId: LEDGER_ID,
    tenantId: TENANT_ID,
    harnessRunId: HARNESS_RUN_ID,
    currency: "USD",
    hardCap: 1_000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
    ...overrides,
  });
}

function reserveOnce(allocator: BudgetAllocator, amount = 100) {
  const ledger = createLedger();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const reserved = allocator.reserve({
    ledger,
    amount,
    resourceKind: "token",
    expiresAt,
    expectedVersion: ledger.version,
    context: createContext(),
  });
  return { ledger, expiresAt, reserved };
}

test("checkWatermarkAlert and calculateThrottleRatio use canonical thresholds", () => {
  const allocator = new BudgetAllocator({
    watermarkConfig: { softCapPercent: 0.8, hardCapPercent: 0.95, enabled: true },
  });

  const warning = allocator.checkWatermarkAlert(createLedger({ reservedAmount: 800 }));
  const critical = allocator.checkWatermarkAlert(createLedger({ reservedAmount: 960 }));

  assert.equal(warning.level, "warning");
  assert.equal(critical.level, "critical");
  assert.equal(allocator.calculateThrottleRatio(createLedger({ reservedAmount: 960 })), 1);
});

test("reserve creates an active reservation and bumps ledger version", () => {
  const allocator = new BudgetAllocator();
  const { expiresAt, reserved } = reserveOnce(allocator, 120);

  assert.equal(reserved.reservation.status, "reserved");
  assert.equal(reserved.reservation.amount, 120);
  assert.equal(reserved.reservation.expiresAt, expiresAt);
  assert.equal(reserved.ledger.reservedAmount, 120);
  assert.equal(reserved.ledger.version, 1);
  assert.equal(allocator.getActiveReservations().length, 1);
});

test("reserve rejects requests that exceed the tier limit", () => {
  const allocator = new BudgetAllocator();

  assert.throws(
    () => allocator.reserve({
      ledger: createLedger({ hardCap: 100 }),
      amount: 150,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expectedVersion: 0,
      context: createContext({ tierLimit: 100 }),
    }),
    (error: unknown) => error instanceof ValidationError && error.code === "budget_reservation.hard_cap_exceeded",
  );
});

test("streamingIncrement updates both reservation and ledger totals", () => {
  const allocator = new BudgetAllocator();
  const { reserved } = reserveOnce(allocator, 100);

  const incremented = allocator.streamingIncrement({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    additionalAmount: 25,
    context: createContext(),
  });

  assert.equal(incremented.totalReserved, 125);
  assert.equal(incremented.ledger.reservedAmount, 125);
  assert.equal(incremented.reservation.amount, 125);
});

test("settle finalizes reservation, updates ledger, and clears active tracking", async () => {
  const allocator = new BudgetAllocator();
  const { reserved } = reserveOnce(allocator, 100);

  const settled = await Promise.resolve(allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 60,
    context: createContext(),
  }));

  assert.equal(settled.reservation.aggregate.status, "settled");
  assert.equal(settled.settlement.actualAmount, 60);
  assert.equal(settled.ledger.reservedAmount, 0);
  assert.equal(settled.ledger.settledAmount, 60);
  assert.equal(settled.ledger.releasedAmount, 40);
  assert.equal(allocator.getActiveReservations().length, 0);
});

test("settle marks overspend when actual amounts exceed the reservation", async () => {
  const allocator = new BudgetAllocator();
  const { reserved } = reserveOnce(allocator, 100);

  const settled = await Promise.resolve(allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 101,
    context: createContext(),
  }));

  assert.equal(settled.overspendDetected, true);
  assert.equal(settled.overspendAmount, 1);
  assert.equal(settled.ledger.settledAmount, 101);
  assert.equal(settled.ledger.releasedAmount, 0);
});

test("release converts an unused reservation into released budget", async () => {
  const allocator = new BudgetAllocator();
  const { reserved } = reserveOnce(allocator, 90);

  const released = await Promise.resolve(allocator.release({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    context: createContext(),
  }));

  assert.equal(released.reservation.aggregate.status, "released");
  assert.equal(released.ledger.reservedAmount, 0);
  assert.equal(released.ledger.releasedAmount, 90);
  assert.equal(allocator.getActiveReservations().length, 0);
});

test("settle rejects stale in-memory ledger snapshots after a prior settlement", async () => {
  const allocator = new BudgetAllocator();
  const { reserved } = reserveOnce(allocator, 100);

  await Promise.resolve(allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 60,
    context: createContext(),
  }));

  assert.throws(
    () => allocator.settle({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      actualAmount: 55,
      context: createContext(),
    }),
    (error: unknown) => error instanceof ValidationError && error.code === "budget_ledger.version_cas_failed",
  );
});

test("sweepExpiredReservations releases orphaned reserved entries", () => {
  const allocator = new BudgetAllocator({
    sweeperConfig: { enabled: true, clockSkewSafetyMarginMs: 0 },
  });
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const reserved = allocator.reserve({
    ledger: createLedger(),
    amount: 50,
    resourceKind: "token",
    expiresAt: expiredAt,
    expectedVersion: 0,
    context: createContext(),
  });

  const result = allocator.sweepExpiredReservations({
    activeRunIds: new Set<string>(),
    dbTime: new Date().toISOString(),
  });

  assert.deepEqual(result.releasedReservationIds, [reserved.reservation.budgetReservationId]);
  assert.equal(result.orphanedCount, 1);
  assert.equal(allocator.getActiveReservations().length, 0);
});

test("reserve rolls back in-memory version tracking when a later hierarchy persist fails", () => {
  const allocator = new BudgetAllocator();
  const primaryLedger = createLedger({ budgetLedgerId: newId("bledger-primary") });
  const hierarchyLedger = createLedger({ budgetLedgerId: newId("bledger-hierarchy") });
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const originalPersistLedger = (allocator as any).persistLedger.bind(allocator) as (
    before: unknown,
    after: unknown,
    expectedVersion: number,
  ) => void;
  let persistCalls = 0;

  (allocator as any).persistLedger = (before: unknown, after: unknown, expectedVersion: number) => {
    originalPersistLedger(before, after, expectedVersion);
    persistCalls += 1;
    if (persistCalls === 2) {
      throw new Error("forced persist failure");
    }
  };

  assert.throws(
    () => allocator.reserve({
      ledger: primaryLedger,
      amount: 50,
      resourceKind: "token",
      expiresAt,
      expectedVersion: 0,
      context: createContext(),
      hierarchyLedgers: [
        {
          ledger: hierarchyLedger,
          expectedVersion: 0,
        },
      ],
    }),
    (error: unknown) => error instanceof Error && error.message === "forced persist failure",
  );

  const retried = allocator.reserve({
    ledger: primaryLedger,
    amount: 50,
    resourceKind: "token",
    expiresAt,
    expectedVersion: 0,
    context: createContext(),
  });

  assert.equal(retried.ledger.reservedAmount, 50);
  assert.equal(allocator.getActiveReservations().length, 1);
});

test("sweepExpiredReservations rejects invalid dbTime instead of expiring reservations", () => {
  const allocator = new BudgetAllocator({
    sweeperConfig: { enabled: true, clockSkewSafetyMarginMs: 0 },
  });

  allocator.reserve({
    ledger: createLedger({ budgetLedgerId: newId("bledger-sweep") }),
    amount: 25,
    resourceKind: "token",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    expectedVersion: 0,
    context: createContext(),
  });

  assert.throws(
    () => allocator.sweepExpiredReservations({
      activeRunIds: new Set<string>(),
      dbTime: "not-a-timestamp",
    }),
    (error: unknown) => error instanceof ValidationError && error.code === "budget_reservation.invalid_db_time",
  );
  assert.equal(allocator.getActiveReservations().length, 1);
});
