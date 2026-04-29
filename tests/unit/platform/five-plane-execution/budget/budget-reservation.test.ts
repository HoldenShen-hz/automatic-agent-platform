import assert from "node:assert/strict";
import test from "node:test";

import { BudgetAllocator } from "../../../../../src/platform/five-plane-execution/budget-allocator.js";
import { BudgetReservationSweeper } from "../../../../../src/platform/five-plane-execution/budget-reservation-sweeper.js";
import {
  createBudgetLedger,
  createBudgetSettlement,
  reserveBudgetHardCap,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { ValidationError, WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";

const TEST_TENANT = "test_tenant";
const TEST_HARNESS_RUN_ID = newId("hrun");
const TEST_LEDGER_ID = newId("bledger");

function createTestContext() {
  return {
    tenantId: TEST_TENANT,
    traceId: newId("trace"),
    emittedBy: "test",
    leaseId: newId("lease"),
    fencingToken: newId("fence"),
  };
}

function createTestLedger(overrides = {}) {
  return createBudgetLedger({
    budgetLedgerId: TEST_LEDGER_ID,
    tenantId: TEST_TENANT,
    harnessRunId: TEST_HARNESS_RUN_ID,
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
    ...overrides,
  });
}

test("reserve() creates budget reservation with correct state", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ version: 0 });
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  const result = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt,
    expectedVersion: 0,
    context: createTestContext(),
  });

  assert.equal(result.reservation.status, "reserved");
  assert.equal(result.reservation.amount, 100);
  assert.equal(result.reservation.resourceKind, "token");
  assert.equal(result.reservation.budgetLedgerId, TEST_LEDGER_ID);
  assert.equal(result.reservation.harnessRunId, TEST_HARNESS_RUN_ID);
  assert.ok(result.reservation.budgetReservationId);
  assert.ok(result.reservation.createdAt);
  assert.equal(result.reservation.expiresAt, expiresAt);
  assert.equal(result.ledger.version, 1);
  assert.equal(result.ledger.reservedAmount, 100);
});

test("reserve() fails when hard cap would be exceeded", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 100, version: 0 });

  assert.throws(
    () =>
      allocator.reserve({
        ledger,
        amount: 150,
        resourceKind: "token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expectedVersion: 0,
        context: createTestContext(),
      }),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "budget_reservation.hard_cap_exceeded",
  );
});

test("reserve() fails when version CAS check fails", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ version: 5 });

  assert.throws(
    () =>
      allocator.reserve({
        ledger,
        amount: 100,
        resourceKind: "token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expectedVersion: 3,
        context: createTestContext(),
      }),
    (err: unknown) =>
      err instanceof ValidationError && err.code === "budget_reservation.version_cas_failed",
  );
});

test("reserve() updates ledger status to hard_cap_reached when at capacity", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 100, version: 0 });

  const result = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: 0,
    context: createTestContext(),
  });

  assert.equal(result.ledger.status, "hard_cap_reached");
  assert.equal(result.ledger.reservedAmount, 100);
});

test("reserve() maintains open status when reservation does not reach hard cap", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 1000, version: 0 });

  const result = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: 0,
    context: createTestContext(),
  });

  assert.equal(result.ledger.status, "open");
  assert.equal(result.ledger.reservedAmount, 100);
});

test("reserve() accumulates multiple reservations correctly", () => {
  const allocator = new BudgetAllocator();
  let ledger = createTestLedger({ hardCap: 500, version: 0 });

  ledger = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  }).ledger;

  assert.equal(ledger.reservedAmount, 100);
  assert.equal(ledger.version, 1);

  const result2 = allocator.reserve({
    ledger,
    amount: 200,
    resourceKind: "compute",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  });

  assert.equal(result2.ledger.reservedAmount, 300);
  assert.equal(result2.ledger.version, 2);
  assert.equal(result2.reservation.amount, 200);
  assert.equal(result2.reservation.resourceKind, "compute");
});

test("settle() transitions reservation from reserved to settled", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 1000, version: 0 });

  const reserveResult = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  });

  const settleResult = allocator.settle({
    ledger: reserveResult.ledger,
    reservation: reserveResult.reservation,
    actualAmount: 95,
    context: createTestContext(),
  });

  assert.equal(settleResult.reservation.aggregate.status, "settled");
  assert.equal(settleResult.settlement.settlementKind, "final");
  assert.equal(settleResult.settlement.actualAmount, 95);
  assert.equal(settleResult.ledger.reservedAmount, 0);
  assert.equal(settleResult.ledger.settledAmount, 95);
  assert.equal(
    settleResult.ledger.releasedAmount,
    reserveResult.reservation.amount - 95,
  );
});

test("settle() with actual amount less than reserved amount releases difference", () => {
  const allocator = new BudgetAllocator();
  let ledger = createTestLedger({ hardCap: 1000, version: 0 });

  ledger = allocator
    .reserve({
      ledger,
      amount: 100,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expectedVersion: ledger.version,
      context: createTestContext(),
    })
    .ledger;

  const settleResult = allocator.settle({
    ledger,
    reservation: allocator
      .reserve({
        ledger,
        amount: 100,
        resourceKind: "token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expectedVersion: ledger.version,
        context: createTestContext(),
      })
      .reservation,
    actualAmount: 50,
    context: createTestContext(),
  });

  assert.equal(settleResult.ledger.releasedAmount, 50);
  assert.equal(settleResult.ledger.settledAmount, 50);
});

test("settle() fails when actual amount exceeds reserved amount", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 1000, version: 0 });

  const reserveResult = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  });

  assert.throws(
    () =>
      allocator.settle({
        ledger: reserveResult.ledger,
        reservation: reserveResult.reservation,
        actualAmount: 150,
        context: createTestContext(),
      }),
    (err: unknown) => err instanceof WorkflowStateError,
  );
});

test("settle() with evidence refs preserves them in settlement", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 1000, version: 0 });

  const reserveResult = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  });

  const evidenceRefs = [
    { artifactId: newId("art"), uri: "s3://bucket/path", hash: "abc123" },
  ];

  const settleResult = allocator.settle({
    ledger: reserveResult.ledger,
    reservation: reserveResult.reservation,
    actualAmount: 95,
    evidenceRefs,
    context: createTestContext(),
  });

  assert.equal(settleResult.settlement.evidenceRefs.length, 1);
  assert.equal(settleResult.settlement.evidenceRefs[0].artifactId, evidenceRefs[0].artifactId);
});

test("release() transitions reservation from reserved to released", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 1000, version: 0 });

  const reserveResult = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  });

  const releaseResult = allocator.release({
    ledger: reserveResult.ledger,
    reservation: reserveResult.reservation,
    context: createTestContext(),
  });

  assert.equal(releaseResult.reservation.aggregate.status, "released");
  assert.equal(releaseResult.settlement.settlementKind, "release_unused");
  assert.equal(releaseResult.settlement.actualAmount, 0);
  assert.equal(releaseResult.ledger.reservedAmount, 0);
  assert.equal(releaseResult.ledger.releasedAmount, 100);
});

test("release() with custom reason code", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 1000, version: 0 });

  const reserveResult = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  });

  const releaseResult = allocator.release({
    ledger: reserveResult.ledger,
    reservation: reserveResult.reservation,
    reasonCode: "budget.timeout",
    context: createTestContext(),
  });

  assert.equal(releaseResult.reservation.aggregate.status, "released");
  assert.equal(releaseResult.ledger.releasedAmount, 100);
});

test("BudgetReservationSweeper releases expired orphaned reservations", () => {
  const sweeper = new BudgetReservationSweeper();
  const dbTime = new Date().toISOString();
  const expiredTime = new Date(Date.now() - 120_000).toISOString();
  const clockSkewSafetyMarginMs = 30_000;

  const reservations = [
    {
      reservationId: newId("resv"),
      runId: TEST_HARNESS_RUN_ID,
      status: "reserved" as const,
      expiresAt: expiredTime,
      updatedAt: expiredTime,
    },
  ];

  const activeRunIds = new Set<string>();

  const result = sweeper.sweep({
    reservations,
    activeRunIds,
    dbTime,
    clockSkewSafetyMarginMs,
  });

  assert.equal(result.orphanedReservationCount, 1);
  assert.equal(result.releaseReservationIds.length, 1);
});

test("BudgetReservationSweeper does not release reservations for active runs", () => {
  const sweeper = new BudgetReservationSweeper();
  const dbTime = new Date().toISOString();
  const expiredTime = new Date(Date.now() - 120_000).toISOString();
  const clockSkewSafetyMarginMs = 30_000;

  const reservations = [
    {
      reservationId: newId("resv"),
      runId: TEST_HARNESS_RUN_ID,
      status: "reserved" as const,
      expiresAt: expiredTime,
      updatedAt: expiredTime,
    },
  ];

  const activeRunIds = new Set([TEST_HARNESS_RUN_ID]);

  const result = sweeper.sweep({
    reservations,
    activeRunIds,
    dbTime,
    clockSkewSafetyMarginMs,
  });

  assert.equal(result.orphanedReservationCount, 0);
  assert.equal(result.releaseReservationIds.length, 0);
});

test("BudgetReservationSweeper does not release non-reserved reservations", () => {
  const sweeper = new BudgetReservationSweeper();
  const dbTime = new Date().toISOString();
  const expiredTime = new Date(Date.now() - 120_000).toISOString();
  const clockSkewSafetyMarginMs = 30_000;

  const reservations = [
    {
      reservationId: newId("resv"),
      runId: TEST_HARNESS_RUN_ID,
      status: "settled" as const,
      expiresAt: expiredTime,
      updatedAt: expiredTime,
    },
    {
      reservationId: newId("resv2"),
      runId: TEST_HARNESS_RUN_ID,
      status: "released" as const,
      expiresAt: expiredTime,
      updatedAt: expiredTime,
    },
  ];

  const activeRunIds = new Set<string>();

  const result = sweeper.sweep({
    reservations,
    activeRunIds,
    dbTime,
    clockSkewSafetyMarginMs,
  });

  assert.equal(result.orphanedReservationCount, 0);
  assert.equal(result.releaseReservationIds.length, 0);
});

test("BudgetReservationSweeper accounts for clock skew safety margin", () => {
  const sweeper = new BudgetReservationSweeper();
  const clockSkewSafetyMarginMs = 30_000;
  const expiresAtTime = Date.now() + 10_000;
  // dbTime must be far enough in the future that expiresAtTime + clockSkewSafetyMarginMs <= dbTime
  const dbTime = new Date(expiresAtTime + clockSkewSafetyMarginMs + 10_000).toISOString();

  const reservations = [
    {
      reservationId: newId("resv"),
      runId: TEST_HARNESS_RUN_ID,
      status: "reserved" as const,
      expiresAt: new Date(expiresAtTime).toISOString(),
      updatedAt: new Date(expiresAtTime).toISOString(),
    },
  ];

  const activeRunIds = new Set<string>();

  const result = sweeper.sweep({
    reservations,
    activeRunIds,
    dbTime,
    clockSkewSafetyMarginMs,
  });

  assert.equal(result.orphanedReservationCount, 1);
  assert.equal(
    result.releaseReservationIds[0],
    reservations[0].reservationId,
  );
});

test("BudgetReservationSweeper does not release unexpired reservations", () => {
  const sweeper = new BudgetReservationSweeper();
  const futureTime = new Date(Date.now() + 120_000).toISOString();
  const dbTime = new Date().toISOString();
  const clockSkewSafetyMarginMs = 30_000;

  const reservations = [
    {
      reservationId: newId("resv"),
      runId: TEST_HARNESS_RUN_ID,
      status: "reserved" as const,
      expiresAt: futureTime,
      updatedAt: new Date().toISOString(),
    },
  ];

  const activeRunIds = new Set<string>();

  const result = sweeper.sweep({
    reservations,
    activeRunIds,
    dbTime,
    clockSkewSafetyMarginMs,
  });

  assert.equal(result.orphanedReservationCount, 0);
  assert.equal(result.releaseReservationIds.length, 0);
});

test("reserve() with different resource kinds creates separate reservations", () => {
  const allocator = new BudgetAllocator();
  let ledger = createTestLedger({ hardCap: 10000, version: 0 });

  ledger = allocator
    .reserve({
      ledger,
      amount: 100,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expectedVersion: ledger.version,
      context: createTestContext(),
    })
    .ledger;

  const result2 = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "compute",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  });

  assert.equal(result2.reservation.resourceKind, "compute");
  assert.equal(result2.ledger.reservedAmount, 150);
});

test("reserve() with nodeRunId associates reservation with node", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ version: 0 });
  const nodeRunId = newId("nrun");

  const result = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    nodeRunId,
    context: createTestContext(),
  });

  assert.equal(result.reservation.nodeRunId, nodeRunId);
});

test("settle() increments ledger version", () => {
  const allocator = new BudgetAllocator();
  let ledger = createTestLedger({ hardCap: 1000, version: 0 });

  ledger = allocator
    .reserve({
      ledger,
      amount: 100,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      expectedVersion: ledger.version,
      context: createTestContext(),
    })
    .ledger;

  const settleResult = allocator.settle({
    ledger,
    reservation: allocator
      .reserve({
        ledger,
        amount: 100,
        resourceKind: "token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expectedVersion: ledger.version,
        context: createTestContext(),
      })
      .reservation,
    actualAmount: 95,
    context: createTestContext(),
  });

  assert.equal(settleResult.ledger.version, ledger.version + 1);
});

test("release() increments ledger version", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 1000, version: 0 });

  const reserveResult = allocator.reserve({
    ledger,
    amount: 100,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expectedVersion: ledger.version,
    context: createTestContext(),
  });

  const releaseResult = allocator.release({
    ledger: reserveResult.ledger,
    reservation: reserveResult.reservation,
    context: createTestContext(),
  });

  assert.equal(releaseResult.ledger.version, reserveResult.ledger.version + 1);
});
