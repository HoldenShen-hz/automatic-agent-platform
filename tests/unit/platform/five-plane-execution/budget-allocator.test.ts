import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError, WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
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

test("settle rejects actual amounts larger than the reservation", async () => {
  const allocator = new BudgetAllocator();
  const { reserved } = reserveOnce(allocator, 100);

  await assert.rejects(
    async () => Promise.resolve(allocator.settle({
      ledger: reserved.ledger,
      reservation: reserved.reservation,
      actualAmount: 101,
      context: createContext(),
    })),
    (error: unknown) => error instanceof WorkflowStateError && error.code === "budget_settlement.actual_amount_exceeds_reservation",
  );
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
