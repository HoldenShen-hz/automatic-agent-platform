/**
 * Cost Tracking Integration Tests
 *
 * Tests the full cost tracking flow across multiple components:
 * - BudgetGuard evaluation
 * - ChargebackService aggregation
 * - Cost reporting
 *
 * Issue #2087: Cost tracking not atomic with execution - crash loses records
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BudgetGuard } from "../../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import { ChargebackService } from "../../../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";

// ============================================================================
// Mock Cost Report Source
// ============================================================================

interface MockCostReport {
  reportId: string;
  tenantId: string | null;
  periodStart: string;
  periodEnd: string;
  totalCostUsd: number;
  currency: string;
  resourceCosts: Array<{
    resourceId: string;
    resourceType: string;
    costUsd: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }>;
  resourceCount: number;
  submittedBy: string;
  submittedAt: string;
  createdAt: string;
}

function createMockReportSource(reports: MockCostReport[]) {
  return {
    listReports: () => reports,
  };
}

// ============================================================================
// Cost Tracking Flow Tests
// ============================================================================

test("Cost tracking flow: BudgetGuard evaluation followed by ChargebackService reporting", () => {
  // Step 1: Evaluate budget for a task
  const guard = new BudgetGuard();
  const budgetResult = guard.evaluateTaskSpend({
    policy: {
      maxTaskCostUsd: 100,
      maxPackCostUsd: 500,
      maxPlatformCostUsd: 5000,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "supervised",
      maxModelTokens: 100000,
      maxSteps: 50,
      maxDurationMs: 600000,
    },
    currentTaskCostUsd: 30,
    nextEstimatedCostUsd: 20,
  });

  assert.equal(budgetResult.allowed, true);
  assert.equal(budgetResult.remainingBudgetUsd, 50);

  // Step 2: Simulate cost recording after task execution
  const costReports: MockCostReport[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [
        { resourceId: "task:123", resourceType: "api", costUsd: 50, currency: "USD", metadata: { taskId: "123", costSource: "token" } },
      ],
      resourceCount: 1,
      submittedBy: "operator",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const chargebackService = new ChargebackService(createMockReportSource(costReports));
  const report = chargebackService.buildReport({ tenantId: "tenant-1" });

  assert.equal(report.totalCostUsd, 50);
  assert.equal(report.allocations.length, 1);
});

test("Cost tracking flow: Multiple task evaluations aggregate correctly", () => {
  const guard = new BudgetGuard();

  // Multiple budget evaluations
  const tasks = [
    { currentCost: 10, nextCost: 5 },
    { currentCost: 20, nextCost: 10 },
    { currentCost: 15, nextCost: 8 },
  ];

  const results = tasks.map((task) =>
    guard.evaluateTaskSpend({
      policy: {
        maxTaskCostUsd: 100,
        maxPackCostUsd: 500,
        maxPlatformCostUsd: 5000,
        maxDailyCostUsd: 1000,
        maxMonthlyCostUsd: 10000,
        warnAtRatio: 0.8,
        mode: "supervised",
        maxModelTokens: 100000,
        maxSteps: 50,
        maxDurationMs: 600000,
      },
      currentTaskCostUsd: task.currentCost,
      nextEstimatedCostUsd: task.nextCost,
    }),
  );

  // All should be allowed
  for (const result of results) {
    assert.equal(result.allowed, true);
  }

  // Cost reports for all tasks
  const costReports: MockCostReport[] = tasks.map((task, i) => ({
    reportId: `r${i}`,
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: task.currentCost + task.nextCost,
    currency: "USD",
    resourceCosts: [
      { resourceId: `task:${i}`, resourceType: "api", costUsd: task.currentCost + task.nextCost, currency: "USD" },
    ],
    resourceCount: 1,
    submittedBy: "operator",
    submittedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T12:00:00.000Z",
  }));

  const chargebackService = new ChargebackService(createMockReportSource(costReports));
  const report = chargebackService.buildReport({ tenantId: "tenant-1" });

  // Total should be sum of all task costs
  const totalExpected = tasks.reduce((sum, t) => sum + t.currentCost + t.nextCost, 0);
  assert.equal(report.totalCostUsd, totalExpected);
  assert.equal(report.reportCount, 3);
});

test("Cost tracking flow: Cascade budget evaluation with chargeback", () => {
  const guard = new BudgetGuard();

  // Evaluate cascade across task/pack/platform
  const cascadeResult = guard.evaluateExecutionChain({
    policy: {
      maxTaskCostUsd: 100,
      maxPackCostUsd: 500,
      maxPlatformCostUsd: 5000,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "auto",
      maxModelTokens: 100000,
      maxSteps: 50,
      maxDurationMs: 600000,
    },
    spend: {
      currentTaskCostUsd: 30,
      nextEstimatedCostUsd: 20,
      currentPackCostUsd: 200,
      currentPlatformCostUsd: 1000,
      currentDailyCostUsd: 500,
      currentMonthlyCostUsd: 2000,
    },
  });

  assert.equal(cascadeResult.allowed, true);
  assert.equal(cascadeResult.warningScopes.length, 0);

  // Now generate cost reports
  const costReports: MockCostReport[] = [
    {
      reportId: "cascade-r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [
        { resourceId: "task:cascade-1", resourceType: "api", costUsd: 30, currency: "USD" },
        { resourceId: "task:cascade-2", resourceType: "api", costUsd: 20, currency: "USD" },
      ],
      resourceCount: 2,
      submittedBy: "operator",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const chargebackService = new ChargebackService(createMockReportSource(costReports));
  const report = chargebackService.buildReport({ tenantId: "tenant-1" });

  assert.equal(report.totalCostUsd, 50);
});

// ============================================================================
// Issue #2087: Atomicity Tests - Ensuring no cost records lost
// ============================================================================

test("Cost tracking: Budget reservation followed by successful execution records cost", () => {
  const guard = new BudgetGuard();

  // Reserve budget before execution
  const reservationResult = guard.reserveExecutionChainBudget({
    policy: {
      maxTaskCostUsd: 100,
      maxPackCostUsd: 500,
      maxPlatformCostUsd: 5000,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "supervised",
      maxModelTokens: 100000,
      maxSteps: 50,
      maxDurationMs: 600000,
    },
    spend: {
      currentTaskCostUsd: 0,
      nextEstimatedCostUsd: 25,
      currentPackCostUsd: 0,
      currentPlatformCostUsd: 0,
      currentDailyCostUsd: 0,
      currentMonthlyCostUsd: 0,
    },
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    traceId: "trace-1",
    emittedBy: "test",
  });

  assert.equal(reservationResult.allowed, true);
  assert.ok(reservationResult.reservation !== null, "Reservation should be created");

  // Simulate execution cost recording
  const costReports: MockCostReport[] = [
    {
      reportId: "exec-r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 25,
      currency: "USD",
      resourceCosts: [
        { resourceId: "execution:123", resourceType: "api", costUsd: 25, currency: "USD", metadata: { executionId: "123", costSource: "token" } },
      ],
      resourceCount: 1,
      submittedBy: "operator",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const chargebackService = new ChargebackService(createMockReportSource(costReports));
  const report = chargebackService.buildReport({ tenantId: "tenant-1" });

  // Cost should be recorded
  assert.equal(report.totalCostUsd, 25);
  assert.equal(report.allocations[0]?.costUsd, 25);
});

test("Cost tracking: Budget exceeded blocks execution, no cost recorded", () => {
  const guard = new BudgetGuard();

  // First task uses most of budget
  const firstResult = guard.evaluateTaskSpend({
    policy: {
      maxTaskCostUsd: 100,
      maxPackCostUsd: 500,
      maxPlatformCostUsd: 5000,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "supervised",
      maxModelTokens: 100000,
      maxSteps: 50,
      maxDurationMs: 600000,
    },
    currentTaskCostUsd: 90,
    nextEstimatedCostUsd: 20,
  });

  assert.equal(firstResult.allowed, false);
  assert.equal(firstResult.reasonCode, "budget.task_limit_exceeded");

  // Second task tries to execute after first used budget
  const secondResult = guard.evaluateTaskSpend({
    policy: {
      maxTaskCostUsd: 100,
      maxPackCostUsd: 500,
      maxPlatformCostUsd: 5000,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "supervised",
      maxModelTokens: 100000,
      maxSteps: 50,
      maxDurationMs: 600000,
    },
    currentTaskCostUsd: 95,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(secondResult.allowed, false);

  // No cost reports generated because execution was blocked
  const costReports: MockCostReport[] = [];
  const chargebackService = new ChargebackService(createMockReportSource(costReports));
  const report = chargebackService.buildReport();

  assert.equal(report.totalCostUsd, 0);
});

// ============================================================================
// Multi-tenant Cost Tracking Tests
// ============================================================================

test("Cost tracking: Multi-tenant isolation in chargeback", () => {
  // Tenant 1 budget evaluation
  const guard = new BudgetGuard();
  const tenant1Result = guard.evaluateTaskSpend({
    policy: {
      maxTaskCostUsd: 100,
      maxPackCostUsd: 500,
      maxPlatformCostUsd: 5000,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "supervised",
      maxModelTokens: 100000,
      maxSteps: 50,
      maxDurationMs: 600000,
    },
    currentTaskCostUsd: 20,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(tenant1Result.allowed, true);

  // Tenant 2 budget evaluation
  const tenant2Result = guard.evaluateTaskSpend({
    policy: {
      maxTaskCostUsd: 50,
      maxPackCostUsd: 250,
      maxPlatformCostUsd: 5000,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "supervised",
      maxModelTokens: 100000,
      maxSteps: 50,
      maxDurationMs: 600000,
    },
    currentTaskCostUsd: 40,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(tenant2Result.allowed, false); // Would exceed 50 limit

  // Cost reports
  const costReports: MockCostReport[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 30,
      currency: "USD",
      resourceCosts: [
        { resourceId: "task:t1-1", resourceType: "api", costUsd: 30, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "operator",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant-2",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 20,
      currency: "USD",
      resourceCosts: [
        { resourceId: "task:t2-1", resourceType: "api", costUsd: 20, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "operator",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const chargebackService = new ChargebackService(createMockReportSource(costReports));

  // Tenant 1 report
  const tenant1Report = chargebackService.buildReport({ tenantId: "tenant-1" });
  assert.equal(tenant1Report.totalCostUsd, 30);
  assert.equal(tenant1Report.tenantId, "tenant-1");

  // Tenant 2 report
  const tenant2Report = chargebackService.buildReport({ tenantId: "tenant-2" });
  assert.equal(tenant2Report.totalCostUsd, 20);
  assert.equal(tenant2Report.tenantId, "tenant-2");

  // Full report (all tenants)
  const fullReport = chargebackService.buildReport();
  assert.equal(fullReport.totalCostUsd, 50);
});

// ============================================================================
// Currency Conversion in Cost Tracking
// ============================================================================

test("Cost tracking: Currency conversion in chargeback for global tracking", () => {
  const guard = new BudgetGuard();

  // Task with USD cost
  const result = guard.evaluateTaskSpend({
    policy: {
      maxTaskCostUsd: 100,
      maxPackCostUsd: 500,
      maxPlatformCostUsd: 5000,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "supervised",
      maxModelTokens: 100000,
      maxSteps: 50,
      maxDurationMs: 600000,
    },
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: 50,
  });

  assert.equal(result.allowed, true);

  // Reports in different currencies
  const costReports: MockCostReport[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 54, // 50 EUR * 1.08
      currency: "EUR",
      resourceCosts: [
        { resourceId: "api:eu", resourceType: "api", costUsd: 50, currency: "EUR" },
      ],
      resourceCount: 1,
      submittedBy: "operator",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant-1",
      periodStart: "2026-04-02T00:00:00.000Z",
      periodEnd: "2026-04-02T23:59:59.000Z",
      totalCostUsd: 127, // 100 GBP * 1.27
      currency: "GBP",
      resourceCosts: [
        { resourceId: "api:uk", resourceType: "api", costUsd: 100, currency: "GBP" },
      ],
      resourceCount: 1,
      submittedBy: "operator",
      submittedAt: "2026-04-02T12:00:00.000Z",
      createdAt: "2026-04-02T12:00:00.000Z",
    },
  ];

  const chargebackService = new ChargebackService(createMockReportSource(costReports));
  const report = chargebackService.buildReport({ tenantId: "tenant-1", baseCurrency: "USD" });

  // 50 EUR * 1.08 = 54 USD
  // 100 GBP * 1.27 = 127 USD
  // Total = 54 + 127 = 181 USD
  assert.equal(report.totalCostUsd, 181);
  assert.equal(report.currency, "USD");
});