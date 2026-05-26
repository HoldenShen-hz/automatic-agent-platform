import assert from "node:assert/strict";
import test from "node:test";

import { BudgetAllocator } from "../../../../src/platform/five-plane-execution/budget-allocator.js";
import { BudgetRecommendationRegistry } from "../../../../src/ops-maturity/cost-optimizer/budget-recommendation-registry.js";
import type { BudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";

function createLedger(): BudgetLedger {
  return {
    budgetLedgerId: "ledger-1",
    tenantId: "tenant-1",
    resourceKind: "api",
    currency: "USD",
    hardCap: 100,
    softCap: null,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    periodStart: "2026-05-26T00:00:00.000Z",
    periodEnd: "2026-05-27T00:00:00.000Z",
    version: 1,
    status: "active",
    lastAlertedAt: null,
    metadataJson: null,
    createdAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
  };
}

test("BudgetAllocator applies recommendation-derived cap when present", () => {
  const allocator = new BudgetAllocator();
  const registry = new BudgetRecommendationRegistry();
  registry.onRecommendations([{
    recommendationId: "rec-1",
    subjectId: "workflow-1",
    estimatedSavingsUsd: 25,
    riskLevel: "medium",
    action: "right_size",
  }]);

  assert.throws(() => allocator.reserve({
    ledger: createLedger(),
    amount: 80,
    resourceKind: "api",
    expiresAt: "2026-05-26T00:05:00.000Z",
    expectedVersion: 1,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "test",
      recommendationSubjectId: "workflow-1",
      recommendationRegistry: registry,
    },
  }));
});
