import assert from "node:assert/strict";
import test from "node:test";

import { createBudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { BudgetAllocator } from "../../../../src/platform/execution/budget-allocator.js";

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
  });
  const settled = allocator.settle({
    ledger: reserved.ledger,
    reservation: reserved.reservation,
    actualAmount: 50,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "budget-allocator",
    },
  });

  assert.equal(reserved.ledger.reservedAmount, 60);
  assert.equal(settled.reservation.aggregate.status, "settled");
  assert.equal(settled.ledger.settledAmount, 50);
  assert.equal(settled.ledger.releasedAmount, 10);
});
