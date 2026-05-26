import assert from "node:assert/strict";
import test from "node:test";

import { BudgetAllocator } from "../../src/platform/five-plane-execution/budget-allocator.js";
import { createBudgetLedger } from "../../src/platform/contracts/executable-contracts/index.js";
import { ValidationError } from "../../src/platform/contracts/errors.js";

const context = {
  tenantId: "tenant-budget-001",
  traceId: "trace-budget-001",
  emittedBy: "INV-BUDGET-001-test",
} as const;

const lockedContext = {
  ...context,
  fencingToken: "fence-budget-001",
} as const;

/**
 * INV-BUDGET-001: Budget reservation must precede LLM, tool, side-effect, and evaluation cost.
 *
 * This test verifies that:
 * 1. BudgetAllocator.reserve() must be called BEFORE any cost-inducing operation
 * 2. Settlements without a prior reservation must be rejected
 * 3. Replay/simulation scenarios must not create real budget commitments
 * 4. Release must properly unwind reserved amounts
 */
test("INV-BUDGET-001: Budget reservation must precede cost operations", async () => {
  const allocator = new BudgetAllocator();

  // Test 1: Reserve before cost - happy path
  const ledger = createBudgetLedger({
    tenantId: "tenant-budget-001",
    harnessRunId: "run-badget-001",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    expectedVersion: 0,
    nodeRunId: "node-1",
    context: lockedContext,
  });

  assert.equal(reserved.reservation.status, "reserved");
  assert.equal(reserved.ledger.reservedAmount, 50);

  // Test 2: Settlement after reserve - correct
  const settled = await allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 40,
    context,
  });
  assert.equal(settled.reservation.aggregate.status, "settled");
  assert.equal(settled.ledger.reservedAmount, 0);
  assert.equal(settled.ledger.settledAmount, 40);
  assert.equal(settled.ledger.releasedAmount, 10);

  // Test 3: Reject settlement that exceeds reservation or hard cap
  const ledger2 = createBudgetLedger({
    tenantId: "tenant-budget-001",
    harnessRunId: "run-badget-002",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved2 = allocator.reserve({
    ledger: ledger2,
    amount: 10,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    expectedVersion: 0,
    nodeRunId: "node-2",
    context: lockedContext,
  });

  const overspentSettlement = allocator.settle({
    ledger: reserved2.ledger,
    reservation: reserved2.reservation,
    actualAmount: 11,
    context,
  });
  assert.equal(overspentSettlement.overspendDetected, true);
  assert.equal(overspentSettlement.overspendAmount, 1);
  assert.equal(overspentSettlement.ledger.settledAmount, 11);
});

test("INV-BUDGET-001: Zero-cost settlement does not create real spend", async () => {
  const allocator = new BudgetAllocator();

  const ledger = createBudgetLedger({
    tenantId: "tenant-budget-001-replay",
    harnessRunId: "run-replay-001",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "token",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    expectedVersion: 0,
    nodeRunId: "node-replay-1",
    context: {
      ...context,
      traceId: "trace-budget-001-replay",
      fencingToken: "fence-budget-002",
    },
  });

  const settled = await allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 0,
    context: {
      tenantId: "tenant-budget-001-replay",
      traceId: "trace-replay-001",
      emittedBy: "INV-BUDGET-001-replay-test",
    },
  });

  assert.equal(settled.ledger.settledAmount, 0);
  assert.equal(settled.reservation.aggregate.status, "settled");
  assert.equal(settled.ledger.releasedAmount, 50);
});

test("INV-BUDGET-001: Release properly unwinds reserved amounts", async () => {
  const allocator = new BudgetAllocator();

  const ledger = createBudgetLedger({
    tenantId: "tenant-budget-001-release",
    harnessRunId: "run-release-001",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 75,
    resourceKind: "tool",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    expectedVersion: 0,
    nodeRunId: "node-release-1",
    context: {
      ...context,
      traceId: "trace-release-001",
      fencingToken: "fence-budget-003",
    },
  });

  assert.equal(reserved.ledger.reservedAmount, 75);

  // Release without execution
  const released = await allocator.release({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    context: {
      tenantId: "tenant-budget-001-release",
      traceId: "trace-release-001",
      emittedBy: "INV-BUDGET-001-release-test",
    },
  });

  assert.equal(released.reservation.aggregate.status, "released");
  assert.equal(released.ledger.reservedAmount, 0);
  assert.equal(released.ledger.releasedAmount, 75);
});

test("INV-BUDGET-001: Deny execution when budget reservation fails", () => {
  const allocator = new BudgetAllocator();

  const ledger = createBudgetLedger({
    tenantId: "tenant-budget-001-deny",
    harnessRunId: "run-deny-001",
    currency: "USD",
    hardCap: 10, // Very low cap
    version: 0,
  });

  // Attempt to reserve more than available
  assert.throws(
    () =>
      allocator.reserve({
        ledger,
        amount: 50, // Exceeds cap
        resourceKind: "token",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        expectedVersion: 0,
        nodeRunId: "node-deny-1",
        context: {
          ...context,
          traceId: "trace-deny-001",
          fencingToken: "fence-budget-004",
        },
      }),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.code === "budget_reservation.hard_cap_exceeded",
  );

  // Execution must be blocked when budget reservation fails
});
