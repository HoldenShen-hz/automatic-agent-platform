import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { createBudgetLedger } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";
import { BudgetAllocator } from "../../../../../src/platform/five-plane-execution/budget-allocator.js";
import { BudgetReservationSweeper } from "../../../../../src/platform/five-plane-execution/budget-reservation-sweeper.js";

function createLedger(overrides: Record<string, unknown> = {}) {
  return createBudgetLedger({
    budgetLedgerId: newId("bledger"),
    tenantId: "tenant-test",
    harnessRunId: newId("hrun"),
    currency: "USD",
    hardCap: 200,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
    ...overrides,
  });
}

function createContext() {
  return {
    tenantId: "tenant-test",
    traceId: newId("trace"),
    emittedBy: "test",
    fencingToken: "fence-1",
  };
}

test("BudgetReservationSweeper reports orphaned expired reservations", () => {
  const sweeper = new BudgetReservationSweeper();
  const result = sweeper.sweep({
    reservations: [
      {
        reservationId: "res-1",
        runId: "run-inactive",
        status: "reserved",
        expiresAt: new Date(Date.now() - 10_000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        reservationId: "res-2",
        runId: "run-active",
        status: "reserved",
        expiresAt: new Date(Date.now() - 10_000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    activeRunIds: new Set(["run-active"]),
    dbTime: new Date().toISOString(),
    clockSkewSafetyMarginMs: 0,
  });

  assert.deepEqual(result.releaseReservationIds, ["res-1"]);
  assert.equal(result.orphanedReservationCount, 1);
  assert.equal(result.metric.value, 1);
});

test("BudgetReservationSweeper keeps unexpired or non-reserved records untouched", () => {
  const sweeper = new BudgetReservationSweeper();
  const result = sweeper.sweep({
    reservations: [
      {
        reservationId: "res-1",
        runId: "run-inactive",
        status: "settled",
        expiresAt: new Date(Date.now() - 10_000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        reservationId: "res-2",
        runId: "run-inactive",
        status: "reserved",
        expiresAt: new Date(Date.now() + 10_000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    activeRunIds: new Set<string>(),
    dbTime: new Date().toISOString(),
    clockSkewSafetyMarginMs: 0,
  });

  assert.deepEqual(result.releaseReservationIds, []);
  assert.equal(result.orphanedReservationCount, 0);
});

test("BudgetAllocator reserve enforces CAS version checks", () => {
  const allocator = new BudgetAllocator();
  const ledger = createLedger({ version: 3 });

  assert.throws(
    () => allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expectedVersion: 1,
      context: createContext(),
    }),
    (error: unknown) => error instanceof ValidationError && error.code === "budget_ledger.version_cas_failed",
  );
});

test("BudgetAllocator reserve and release maintain ledger conservation", async () => {
  const allocator = new BudgetAllocator();
  const reserved = allocator.reserve({
    ledger: createLedger(),
    amount: 80,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: 0,
    context: createContext(),
  });

  const released = await Promise.resolve(allocator.release({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    context: createContext(),
  }));

  assert.equal(released.ledger.reservedAmount, 0);
  assert.equal(released.ledger.settledAmount, 0);
  assert.equal(released.ledger.releasedAmount, 80);
});
