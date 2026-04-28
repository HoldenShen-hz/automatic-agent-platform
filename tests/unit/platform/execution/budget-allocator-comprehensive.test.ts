/**
 * Comprehensive unit tests for BudgetAllocator
 *
 * @see src/platform/execution/budget-allocator.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError, WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import {
  createBudgetLedger,
  type ArtifactRef,
  type BudgetResourceKind,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../../../src/platform/execution/budget-allocator.js";

function createTestLedger(overrides: Partial<Parameters<typeof createBudgetLedger>[0]> = {}): ReturnType<typeof createBudgetLedger> {
  return createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
    ...overrides,
  });
}

test("BudgetAllocator.reserve updates ledger reservedAmount and increments version", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ version: 0 });

  const result = allocator.reserve({
    ledger,
    amount: 30,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(result.ledger.reservedAmount, 30);
  assert.equal(result.ledger.version, 1);
  assert.equal(result.reservation.amount, 30);
  assert.equal(result.reservation.resourceKind, "tool");
});

test("BudgetAllocator.reserve rejects version mismatch", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ version: 5 });

  assert.throws(
    () =>
      allocator.reserve({
        ledger,
        amount: 30,
        resourceKind: "tool",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "budget_reservation.version_cas_failed",
  );
});

test("BudgetAllocator.reserve rejects when amount is not positive", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();

  assert.throws(
    () =>
      allocator.reserve({
        ledger,
        amount: 0,
        resourceKind: "tool",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "budget_reservation.amount_invalid",
  );

  assert.throws(
    () =>
      allocator.reserve({
        ledger,
        amount: -10,
        resourceKind: "tool",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "budget_reservation.amount_invalid",
  );
});

test("BudgetAllocator.reserve rejects when hard cap would be exceeded", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 100, reservedAmount: 60, settledAmount: 30 });

  // activeCommittedAmount = 60 + 30 - 0 = 90, requesting 20 would exceed 100
  assert.throws(
    () =>
      allocator.reserve({
        ledger,
        amount: 20,
        resourceKind: "tool",
        expiresAt: "2026-04-27T01:00:00.000Z",
        expectedVersion: 0,
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "budget_reservation.hard_cap_exceeded",
  );
});

test("BudgetAllocator.reserve allows reservation up to exact hard cap", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 100, reservedAmount: 60, settledAmount: 30, releasedAmount: 0 });

  // activeCommittedAmount = 60 + 30 - 0 = 90, requesting 10 reaches exactly 100
  const result = allocator.reserve({
    ledger,
    amount: 10,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(result.reservation.amount, 10);
  assert.equal(result.ledger.reservedAmount, 70);
});

test("BudgetAllocator.reserve sets ledger status to hard_cap_reached when cap is reached", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ hardCap: 100, reservedAmount: 50, settledAmount: 0, releasedAmount: 0, status: "open" });

  // activeCommittedAmount = 50 + 0 - 0 = 50, requesting 50 reaches exactly 100
  const result = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "token",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(result.ledger.status, "hard_cap_reached");
});

test("BudgetAllocator.reserve accepts all valid resource kinds", () => {
  const allocator = new BudgetAllocator();
  const resourceKinds: BudgetResourceKind[] = ["token", "tool", "api", "compute", "human", "side_effect", "other"];

  for (const resourceKind of resourceKinds) {
    const ledger = createTestLedger({ version: 0 });
    const result = allocator.reserve({
      ledger,
      amount: 10,
      resourceKind,
      expiresAt: "2026-04-27T01:00:00.000Z",
      expectedVersion: 0,
    });
    assert.equal(result.reservation.resourceKind, resourceKind, `Failed for resourceKind: ${resourceKind}`);
  }
});

test("BudgetAllocator.reserve with nodeRunId associates reservation with node", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();

  const result = allocator.reserve({
    ledger,
    amount: 25,
    resourceKind: "compute",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
    nodeRunId: "node-run-abc",
  });

  assert.equal(result.reservation.nodeRunId, "node-run-abc");
});

test("BudgetAllocator.settle transitions reservation to settled status", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const reserved = allocator.reserve({
    ledger,
    amount: 40,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 40,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(settled.reservation.aggregate.status, "settled");
});

test("BudgetAllocator.settle updates ledger accounting correctly with exact amount", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const reserved = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "api",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 50,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(settled.ledger.reservedAmount, 0);
  assert.equal(settled.ledger.settledAmount, 50);
  assert.equal(settled.ledger.releasedAmount, 0);
  assert.equal(settled.ledger.version, reserved.ledger.version + 1);
});

test("BudgetAllocator.settle releases unused budget when actualAmount is less", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const reserved = allocator.reserve({
    ledger,
    amount: 60,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 45,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(settled.ledger.settledAmount, 45);
  assert.equal(settled.ledger.releasedAmount, 15); // 60 - 45
});

test("BudgetAllocator.settle with evidence refs includes them in settlement", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const reserved = allocator.reserve({
    ledger,
    amount: 30,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  const evidenceRef: ArtifactRef = {
    artifactId: "artifact-1",
    uri: "memory://test/artifact-1",
    hash: "abc123",
  };

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 30,
    evidenceRefs: [evidenceRef],
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(settled.settlement.evidenceRefs.length, 1);
  assert.equal(settled.settlement.evidenceRefs[0]?.artifactId, "artifact-1");
});

test("BudgetAllocator.settle creates settlement with final kind", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const reserved = allocator.reserve({
    ledger,
    amount: 20,
    resourceKind: "compute",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 20,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(settled.settlement.settlementKind, "final");
});

test("BudgetAllocator multiple sequential reservations accumulate correctly", () => {
  const allocator = new BudgetAllocator();
  let ledger = createTestLedger({ version: 0 });

  const res1 = allocator.reserve({
    ledger,
    amount: 30,
    resourceKind: "token",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: ledger.version,
  });
  ledger = res1.ledger;

  const res2 = allocator.reserve({
    ledger,
    amount: 25,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: ledger.version,
  });
  ledger = res2.ledger;

  const res3 = allocator.reserve({
    ledger,
    amount: 20,
    resourceKind: "api",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: ledger.version,
  });

  assert.equal(res3.ledger.reservedAmount, 75); // 30 + 25 + 20
  assert.equal(res3.ledger.version, 3);
});

test("BudgetAllocator multiple settlements reduce reservedAmount correctly", () => {
  const allocator = new BudgetAllocator();
  let ledger = createTestLedger({ version: 0 });

  const res1 = allocator.reserve({
    ledger,
    amount: 30,
    resourceKind: "token",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: ledger.version,
  });
  ledger = res1.ledger;

  const res2 = allocator.reserve({
    ledger,
    amount: 30,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: ledger.version,
  });
  ledger = res2.ledger;

  // Settle first reservation
  const settled1 = allocator.settle({
    ledger,
    reservation: res1.reservation,
    actualAmount: 25,
    context: { tenantId: "tenant-1", traceId: "trace-1", emittedBy: "test" },
  });
  ledger = settled1.ledger;

  // Settle second reservation
  const settled2 = allocator.settle({
    ledger,
    reservation: res2.reservation,
    actualAmount: 30,
    context: { tenantId: "tenant-1", traceId: "trace-1", emittedBy: "test" },
  });

  assert.equal(settled2.ledger.reservedAmount, 0);
  assert.equal(settled2.ledger.settledAmount, 55); // 25 + 30
  assert.equal(settled2.ledger.releasedAmount, 5); // 30 - 25 released from first
});

test("BudgetAllocator.reserve with releasedAmount from previous settlements", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({
    hardCap: 100,
    reservedAmount: 30,
    settledAmount: 20,
    releasedAmount: 10,
    version: 1,
  });

  // activeCommittedAmount = 30 + 20 - 10 = 40
  // Can reserve up to 60 more
  const result = allocator.reserve({
    ledger,
    amount: 60,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 1,
  });

  assert.equal(result.ledger.reservedAmount, 90); // 30 + 60
  assert.equal(result.ledger.version, 2);
});

test("BudgetAllocator.settle emits platform event with correct structure", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const reserved = allocator.reserve({
    ledger,
    amount: 35,
    resourceKind: "side_effect",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 35,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test-emitter",
    },
  });

  assert.equal(settled.reservation.event.eventType, "platform.budget_reservation.status_changed");
  assert.equal(settled.reservation.event.aggregateType, "BudgetReservation");
  assert.ok(settled.reservation.event.payloadHash);
});

test("BudgetAllocator settle requires budget precondition hardCapSatisfied to be true", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger();
  const reserved = allocator.reserve({
    ledger,
    amount: 40,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  // The allocator recomputes the hard-cap precondition from ledger/reservation/actualAmount,
  // so a reservation settled exactly within the cap should satisfy the state-machine guard.
  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 40,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(settled.reservation.aggregate.status, "settled");
});

test("BudgetAllocator reserve and settle with different currency preserves currency", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ currency: "EUR" });

  const reserved = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "compute",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 50,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(settled.ledger.currency, "EUR");
});

test("BudgetAllocator reserve and settle with soft cap in ledger", () => {
  const allocator = new BudgetAllocator();
  const ledger = createTestLedger({ softCap: 80, status: "open" });

  const reserved = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
  });

  assert.equal(reserved.ledger.softCap, 80);
  // Status should still be open since 50 < softCap (80)
  assert.equal(reserved.ledger.status, "open");

  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 50,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
    },
  });

  assert.equal(settled.ledger.softCap, 80);
});
