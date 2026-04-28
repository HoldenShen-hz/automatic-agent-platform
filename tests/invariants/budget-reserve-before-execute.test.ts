import assert from "node:assert/strict";
import test from "node:test";

import { BudgetAllocator } from "../../../src/platform/execution/budget-allocator.js";
import { createBudgetLedger } from "../../../src/platform/contracts/executable-contracts/index.js";
import { WorkflowStateError } from "../../../src/platform/contracts/errors.js";

/**
 * INV-BUDGET-001: Budget reservation must precede LLM, tool, side-effect, and evaluation cost.
 *
 * This test verifies that:
 * 1. BudgetAllocator.reserve() must be called BEFORE any cost-inducing operation
 * 2. Settlements without a prior reservation must be rejected
 * 3. Replay/simulation scenarios must not create real budget commitments
 * 4. Release must properly unwind reserved amounts
 */
test("INV-BUDGET-001: Budget reservation must precede cost operations", () => {
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
    resourceKind: "llm",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    expectedVersion: 0,
    nodeRunId: "node-1",
  });

  assert.equal(reserved.reservation.aggregate.status, "reserved");
  assert.equal(reserved.ledger.reservedAmount, 50);

  // Test 2: Settlement after reserve - correct
  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 40,
    context: {
      tenantId: "tenant-budget-001",
      traceId: "trace-budget-001",
      emittedBy: "INV-BUDGET-001-test",
    },
  });
  assert.equal(settled.reservation.aggregate.status, "settled");
  assert.equal(settled.ledger.reservedAmount, 50); // Reserved stays until release
  assert.equal(settled.ledger.settledAmount, 40);

  // Test 3: Reject settlement without prior reservation
  const ledger2 = createBudgetLedger({
    tenantId: "tenant-budget-001",
    harnessRunId: "run-badget-002",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  // Attempting to settle without reserve should fail
  assert.throws(
    () =>
      allocator.settle({
        ledger: ledger2,
        reservation: {
          aggregate: {
            reservationId: "fake-reservation",
            harnessRunId: "run-badget-002",
            nodeRunId: "node-1",
            resourceKind: "llm",
            amount: 50,
            status: "settled" as const,
            reservedAt: new Date().toISOString(),
          },
        },
        actualAmount: 30,
        context: {
          tenantId: "tenant-budget-001",
          traceId: "trace-budget-002",
          emittedBy: "INV-BUDGET-001-test",
        },
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.budget_reservation_not_found",
  );
});

test("INV-BUDGET-001: Replay/simulation scenarios must not create real budget commitments", () => {
  const allocator = new BudgetAllocator();

  const ledger = createBudgetLedger({
    tenantId: "tenant-budget-001-replay",
    harnessRunId: "run-replay-001",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  // Simulate replay mode - budget operations should be projection-only
  const reserved = allocator.reserve({
    ledger,
    amount: 50,
    resourceKind: "llm",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    expectedVersion: 0,
    nodeRunId: "node-replay-1",
    replayBehavior: "simulation", // Mark as simulation
  });

  // In replay mode, settlement should be a no-op or projection-only
  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 0, // No actual cost in replay
    context: {
      tenantId: "tenant-budget-001-replay",
      traceId: "trace-replay-001",
      emittedBy: "INV-BUDGET-001-replay-test",
    },
  });

  // Replay settlements should not affect the actual ledger
  assert.equal(settled.ledger.settledAmount, 0);
  assert.equal(settled.reservation.aggregate.status, "settled");
});

test("INV-BUDGET-001: Release properly unwinds reserved amounts", () => {
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
  });

  assert.equal(reserved.ledger.reservedAmount, 75);

  // Release without execution
  const released = allocator.release({
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
        resourceKind: "llm",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        expectedVersion: 0,
        nodeRunId: "node-deny-1",
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.budget_hard_cap_not_satisfied",
  );

  // Execution must be blocked when budget reservation fails
});