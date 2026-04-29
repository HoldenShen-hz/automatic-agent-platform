import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import { createBudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../../../src/platform/execution/budget-allocator.js";

const DEFAULT_CONTEXT = {
  tenantId: "tenant-1",
  traceId: "trace-1",
  emittedBy: "budget-allocator",
} as const;

const LOCKED_CONTEXT = {
  ...DEFAULT_CONTEXT,
  leaseId: "lease-budget-1",
  fencingToken: "fence-budget-1",
} as const;

test("BudgetAllocator reserves against hard cap and settles reservation with ledger accounting", () => {
  const allocator = new BudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 60,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
    nodeRunId: "node-run-1",
    context: LOCKED_CONTEXT,
  });
  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 50,
    context: {
      ...DEFAULT_CONTEXT,
    },
  });

  assert.equal(reserved.ledger.reservedAmount, 60);
  assert.equal(settled.reservation.aggregate.status, "settled");
  assert.equal(settled.ledger.settledAmount, 50);
  assert.equal(settled.ledger.releasedAmount, 10);
});

test("BudgetAllocator rejects settlement that exceeds the hard cap or reservation", () => {
  const allocator = new BudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    settledAmount: 90,
    version: 0,
  });
  const reserved = allocator.reserve({
    ledger,
    amount: 10,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
    nodeRunId: "node-run-1",
    context: LOCKED_CONTEXT,
  });

  assert.throws(
    () =>
      allocator.settle({
        ledger: reserved.ledger,
        reservation: reserved.reservation,
        actualAmount: 11,
        context: {
          ...DEFAULT_CONTEXT,
        },
      }),
    (error: unknown) =>
      error instanceof WorkflowStateError &&
      error.code === "runtime_state_machine.budget_hard_cap_not_satisfied",
  );
});

test("BudgetAllocator can release a reservation when execution never starts", () => {
  const allocator = new BudgetAllocator();
  const ledger = createBudgetLedger({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    currency: "USD",
    hardCap: 100,
    version: 0,
  });

  const reserved = allocator.reserve({
    ledger,
    amount: 25,
    resourceKind: "tool",
    expiresAt: "2026-04-27T01:00:00.000Z",
    expectedVersion: 0,
    context: DEFAULT_CONTEXT,
  });
  const released = allocator.release({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    context: {
      ...DEFAULT_CONTEXT,
    },
  });

  assert.equal(released.reservation.aggregate.status, "released");
  assert.equal(released.ledger.reservedAmount, 0);
  assert.equal(released.ledger.releasedAmount, 25);
});
