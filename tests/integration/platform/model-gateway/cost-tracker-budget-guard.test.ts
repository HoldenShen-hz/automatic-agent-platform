import assert from "node:assert/strict";
import test from "node:test";

import { BudgetGuard, type BudgetPolicy, type ExecutionChainBudgetSpend } from "../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import { ChargebackService, type ChargebackReportSource } from "../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";
import { createBudgetLedger, type BudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";
import type { CostReportRecord } from "../../../../src/platform/interface/api/cost-report-service.js";

function createDefaultPolicy(): BudgetPolicy {
  return {
    maxTaskCostUsd: 10.0,
    maxPackCostUsd: 100.0,
    maxPlatformCostUsd: 1000.0,
    maxDailyCostUsd: 500.0,
    maxMonthlyCostUsd: 5000.0,
    warnAtRatio: 0.8,
    mode: "supervised",
  };
}

function createDefaultSpend(overrides?: Partial<ExecutionChainBudgetSpend>): ExecutionChainBudgetSpend {
  return {
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: 1.0,
    currentPackCostUsd: 0,
    currentPlatformCostUsd: 0,
    currentDailyCostUsd: 0,
    currentMonthlyCostUsd: 0,
    ...overrides,
  };
}

function createMockCostReportSource(reports: CostReportRecord[]): ChargebackReportSource {
  return {
    listReports: (limit?: number) => reports.slice(0, limit ?? 500),
  };
}

// Integration: BudgetGuard with full execution chain evaluation
test("BudgetGuard integration: Full cascade evaluation across all scopes", () => {
  const guard = new BudgetGuard();
  const policy = createDefaultPolicy();

  // All costs under limits
  const spend = createDefaultSpend({
    currentTaskCostUsd: 5.0,
    currentPackCostUsd: 50.0,
    currentPlatformCostUsd: 500.0,
    currentDailyCostUsd: 250.0,
    currentMonthlyCostUsd: 2500.0,
  });

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, true);
  assert.equal(result.violatedScope, null);
  assert.ok(result.warningScopes.length === 0);
});

// Integration: BudgetGuard evaluateExecutionChain identifies pack scope violations
test("BudgetGuard integration: Pack limit exceeded blocks execution", () => {
  const guard = new BudgetGuard();
  const policy = createDefaultPolicy();

  const spend = createDefaultSpend({
    currentPackCostUsd: 99.0,
    nextEstimatedCostUsd: 2.0,
  });

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "pack");
});

// Integration: BudgetGuard evaluateExecutionChain identifies scope violations
test("BudgetGuard integration: Platform limit exceeded blocks execution", () => {
  const guard = new BudgetGuard();
  const policy = createDefaultPolicy();

  const spend = createDefaultSpend({
    currentPlatformCostUsd: 999.5,
    nextEstimatedCostUsd: 1.0,
  });

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "platform");
});

// Integration: BudgetGuard warning scopes tracked correctly
test("BudgetGuard integration: Multiple scopes approaching limits", () => {
  const guard = new BudgetGuard();
  const policy = createDefaultPolicy();

  // Task at 90%, Pack at 85%, Daily at 80%
  const spend = createDefaultSpend({
    currentTaskCostUsd: 8.0,
    currentPackCostUsd: 81.0,
    currentDailyCostUsd: 396.0,
  });

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, true);
  assert.ok(result.warningScopes.length >= 2);
  assert.ok(result.warningScopes.includes("task"));
  assert.ok(result.warningScopes.includes("pack"));
});

// Integration: ChargebackService aggregates multiple tenants
test("ChargebackService integration: Multi-tenant cost aggregation", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 100,
      currency: "USD",
      resourceCosts: [
        { resourceId: "api-key-1", resourceType: "api", costUsd: 100, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant2",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 200,
      currency: "USD",
      resourceCosts: [
        { resourceId: "api-key-2", resourceType: "api", costUsd: 200, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({});

  assert.equal(report.totalCostUsd, 300);
  assert.equal(report.reportCount, 2);
  assert.equal(report.allocations.length, 2);
});

// Integration: ChargebackService currency conversion
test("ChargebackService integration: Mixed currency conversion", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 100,
      currency: "EUR",
      resourceCosts: [
        { resourceId: "api-key-1", resourceType: "api", costUsd: 100, currency: "EUR" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant1",
      periodStart: "2024-02-01T00:00:00Z",
      periodEnd: "2024-02-29T23:59:59Z",
      totalCostUsd: 50,
      currency: "GBP",
      resourceCosts: [
        { resourceId: "api-key-1", resourceType: "api", costUsd: 50, currency: "GBP" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-03-01T00:00:00Z",
      createdAt: "2024-03-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ baseCurrency: "USD" });

  // EUR: 100 * 1.08 = 108
  // GBP: 50 * 1.27 = 63.5
  // Total: 171.5
  assert.equal(report.totalCostUsd, 171.5);
  assert.equal(report.currency, "USD");
});

// Integration: BudgetGuard evaluateTaskSpend evaluates correctly
test("BudgetGuard evaluateTaskSpend evaluates task-level budget", () => {
  const guard = new BudgetGuard();
  const policy = createDefaultPolicy();
  const spend = createDefaultSpend({
    currentTaskCostUsd: 5.0,
    nextEstimatedCostUsd: 1.0,
  });

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: spend.currentTaskCostUsd,
    nextEstimatedCostUsd: spend.nextEstimatedCostUsd,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remainingBudgetUsd, 4.0);
});

// Integration: BudgetGuard evaluateTaskSpend blocks when over limit
test("BudgetGuard evaluateTaskSpend blocks when over task limit", () => {
  const guard = new BudgetGuard();
  const policy = createDefaultPolicy();

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 9.0,
    nextEstimatedCostUsd: 2.0,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});

// Integration: BudgetGuard cascade evaluation with all limits
test("BudgetGuard integration: Verify cascade evaluation with all scope limits", () => {
  const guard = new BudgetGuard();
  const policy = createDefaultPolicy();

  const spend = createDefaultSpend({
    currentTaskCostUsd: 5.0,
    currentPackCostUsd: 50.0,
    currentPlatformCostUsd: 500.0,
    currentDailyCostUsd: 250.0,
    currentMonthlyCostUsd: 2500.0,
  });

  const result = guard.evaluateExecutionChain({ policy, spend });

  assert.equal(result.allowed, true);
  assert.equal(result.violatedScope, null);
  assert.equal(result.warningScopes.length, 0);
  assert.equal(result.projectedTaskCostUsd, 6.0);
});
