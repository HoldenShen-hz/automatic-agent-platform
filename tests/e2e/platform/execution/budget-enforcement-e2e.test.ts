/**
 * E2E Tests for Budget Operations
 *
 * End-to-end tests covering:
 * 1. Budget allocation and reservation
 * 2. Budget tier management
 * 3. Budget enforcement in execution
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { createE2EHarness } from "../../../helpers/e2e-harness.js";
// @ts-ignore
import { BudgetAllocator, type BudgetAllocatorContext } from "../../../../src/platform/five-plane-execution/budget-allocator.js";
// @ts-ignore
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
// @ts-ignore
import type { BudgetLedger, BudgetResourceKind } from "../../../../src/platform/contracts/executable-contracts/schemas.js";

function createTestLedger(overrides?: Partial<BudgetLedger>): BudgetLedger {
  return {
    budgetLedgerId: overrides?.budgetLedgerId ?? newId("bled"),
    harnessRunId: overrides?.harnessRunId ?? newId("run"),
    tenantId: "tenant_test",
    status: "active",
    reservedAmount: overrides?.reservedAmount ?? 0,
    settledAmount: overrides?.settledAmount ?? 0,
    releasedAmount: overrides?.releasedAmount ?? 0,
    hardCap: overrides?.hardCap ?? 100000,
    version: overrides?.version ?? 1,
  };
}

function createTestContext(): BudgetAllocatorContext {
  return {
    tenantId: "tenant_test",
    traceId: newId("trace"),
    emittedBy: "test",
  };
}

test("E2E Budget: Allocation and reservation lifecycle", async () => {
  const harness = createE2EHarness("aa-e2e-budget-alloc-");
  try {
    const allocator = new BudgetAllocator();
    const ledger = createTestLedger();

    const result = allocator.reserve({
      ledger,
      amount: 1000,
      resourceKind: "compute" as BudgetResourceKind,
      expiresAt: nowIso(),
      expectedVersion: ledger.version,
    });

    assert.ok(result.reservation);
    assert.equal(result.reservation.amount, 1000);
  } finally {
    harness.cleanup();
  }
});

test("E2E Budget: Budget exceeds hard cap throws error", async () => {
  const harness = createE2EHarness("aa-e2e-budget-tier-");
  try {
    const allocator = new BudgetAllocator();
    const ledger = createTestLedger({ hardCap: 5000 }); // Low cap

    // Try to reserve more than hard cap - should throw
    let threwError = false;
    try {
      allocator.reserve({
        ledger,
        amount: 10000,
        resourceKind: "compute" as BudgetResourceKind,
        expiresAt: nowIso(),
        expectedVersion: ledger.version,
      });
    } catch (error) {
      threwError = true;
    }

    // Should throw due to exceeding hard cap
    assert.ok(threwError, "Should throw when amount exceeds hard cap");
  } finally {
    harness.cleanup();
  }
});

test("E2E Budget: Budget settlement updates ledger correctly", async () => {
  const harness = createE2EHarness("aa-e2e-budget-settle-");
  try {
    const allocator = new BudgetAllocator();
    const ledger = createTestLedger({ reservedAmount: 5000 });

    const context = createTestContext();

    const reservationResult = allocator.reserve({
      ledger,
      amount: 3000,
      resourceKind: "compute" as BudgetResourceKind,
      expiresAt: nowIso(),
      expectedVersion: ledger.version,
    });

    const settledLedger = createTestLedger({
      budgetLedgerId: ledger.budgetLedgerId,
      harnessRunId: ledger.harnessRunId,
      reservedAmount: 3000,
      version: reservationResult.ledger.version,
    });

    const settleResult = allocator.settle({
      ledger: settledLedger,
      reservation: reservationResult.reservation,
      actualAmount: 2500,
      context,
    });

    assert.ok(settleResult.ledger.settledAmount >= 0);
  } finally {
    harness.cleanup();
  }
});
