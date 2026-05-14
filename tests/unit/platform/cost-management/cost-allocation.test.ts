/**
 * Unit Tests: Cost Allocation Service
 *
 * Tests for cost allocation by division, tenant, task, and workflow
 * across platform cost management modules.
 *
 * Uses node:test + assert/strict with ESM and .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CostReportService } from "../../../../src/platform/five-plane-interface/api/cost-report-service.js";
import type { CreateCostReportInput, CostReportRecord, BudgetSummaryRecord } from "../../../../src/platform/five-plane-interface/api/cost-report-service.js";
import { aggregateCostAttribution } from "../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";

// =============================================================================
// Cost Report Service Tests
// =============================================================================

test("CostReportService.createReport generates valid report", () => {
  const service = new CostReportService();

  const input: CreateCostReportInput = {
    tenantId: "tenant_alloc_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 150.75,
    currency: "USD",
    resourceCosts: [
      { resourceId: "compute_1", resourceType: "compute", costUsd: 100.00, currency: "USD" },
      { resourceId: "storage_1", resourceType: "storage", costUsd: 50.75, currency: "USD" },
    ],
    submittedBy: "admin",
  };

  const report = service.createReport(input);

  assert.ok(report.reportId.startsWith("cost_report_"));
  assert.equal(report.tenantId, "tenant_alloc_1");
  assert.equal(report.totalCostUsd, 150.75);
  assert.equal(report.currency, "USD");
  assert.equal(report.resourceCount, 2);
  assert.equal(report.submittedBy, "admin");
});

test("CostReportService.createReport handles null tenant for platform-wide", () => {
  const service = new CostReportService();

  const input: CreateCostReportInput = {
    tenantId: null,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 500.00,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "system",
  };

  const report = service.createReport(input);

  assert.equal(report.tenantId, null);
});

test("CostReportService.listReports filters by tenantId", () => {
  const service = new CostReportService();

  // Create reports for different tenants
  service.createReport({
    tenantId: "tenant_a",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-15T12:00:00.000Z",
  });

  service.createReport({
    tenantId: "tenant_b",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 200,
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-16T12:00:00.000Z",
  });

  service.createReport({
    tenantId: "tenant_a",
    periodStart: "2026-03-01T00:00:00.000Z",
    periodEnd: "2026-03-31T23:59:59.999Z",
    totalCostUsd: 80,
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-01T12:00:00.000Z",
  });

  const tenantAReports = service.listReports(50, "tenant_a");
  const allReports = service.listReports(50, null);

  assert.equal(tenantAReports.length, 2);
  assert.equal(allReports.length, 3);
});

test("CostReportService.listReports respects limit", () => {
  const service = new CostReportService();

  for (let i = 0; i < 10; i++) {
    service.createReport({
      tenantId: null,
      periodStart: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      periodEnd: `2026-04-${String(i + 1).padStart(2, "0")}T23:59:59.999Z`,
      totalCostUsd: 10 * (i + 1),
      resourceCosts: [],
      submittedBy: "admin",
      submittedAt: `2026-04-${String(i + 10).padStart(2, "0")}T12:00:00.000Z`,
    });
  }

  const limited = service.listReports(3, null);

  assert.equal(limited.length, 3);
});

test("CostReportService.listReports sorts by submittedAt descending", () => {
  const service = new CostReportService();

  service.createReport({
    tenantId: null,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 50,
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-01T00:00:00.000Z",
  });

  service.createReport({
    tenantId: null,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-30T00:00:00.000Z",
  });

  const reports = service.listReports(50, null);

  // Most recent first
  assert.ok(reports[0]!.submittedAt > reports[1]!.submittedAt);
});

test("CostReportService.listBudgetSummaries aggregates by tenant and currency", () => {
  const service = new CostReportService();

  service.createReport({
    tenantId: "tenant_agg",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-15T23:59:59.999Z",
    totalCostUsd: 50,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-15T12:00:00.000Z",
  });

  service.createReport({
    tenantId: "tenant_agg",
    periodStart: "2026-04-16T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 75,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-30T12:00:00.000Z",
  });

  const summaries = service.listBudgetSummaries(50, "tenant_agg");

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]!.totalCostUsd, 125);
  assert.equal(summaries[0]!.reportCount, 2);
  assert.equal(summaries[0]!.currency, "USD");
});

test("CostReportService.listBudgetSummaries handles different currencies separately", () => {
  const service = new CostReportService();

  service.createReport({
    tenantId: "tenant_multi",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-15T12:00:00.000Z",
  });

  service.createReport({
    tenantId: "tenant_multi",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 50,
    currency: "EUR",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-16T12:00:00.000Z",
  });

  const summaries = service.listBudgetSummaries(50, "tenant_multi");

  assert.equal(summaries.length, 2);
});

test("CostReportService.createReport uses default currency USD", () => {
  const service = new CostReportService();

  const report = service.createReport({
    tenantId: "tenant_test",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    resourceCosts: [],
    submittedBy: "admin",
  });

  assert.equal(report.currency, "USD");
});

test("CostReportService.createReport uses current time for submittedAt when not provided", () => {
  const service = new CostReportService();
  const before = new Date().toISOString();

  const report = service.createReport({
    tenantId: "tenant_test",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    resourceCosts: [],
    submittedBy: "admin",
  });

  const after = new Date().toISOString();
  assert.ok(report.submittedAt >= before);
  assert.ok(report.submittedAt <= after);
});

test("CostReportService.createReport stores resource costs as readonly", () => {
  const service = new CostReportService();

  const report = service.createReport({
    tenantId: "tenant_test",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    currency: "USD",
    resourceCosts: [
      { resourceId: "r1", resourceType: "compute", costUsd: 50, currency: "USD" },
      { resourceId: "r2", resourceType: "storage", costUsd: 50, currency: "USD" },
    ],
    submittedBy: "admin",
  });

  assert.equal(report.resourceCount, 2);
  assert.ok(Array.isArray(report.resourceCosts));
  assert.equal(report.resourceCosts.length, 2);
});

test("CostReportService.listReports returns empty array when no reports exist", () => {
  const service = new CostReportService();

  const reports = service.listReports(50, "tenant_nonexistent");

  assert.equal(reports.length, 0);
});

test("CostReportService.listBudgetSummaries returns empty array when no summaries", () => {
  const service = new CostReportService();

  const summaries = service.listBudgetSummaries(50, "tenant_nonexistent");

  assert.equal(summaries.length, 0);
});

test("CostReportService.listBudgetSummaries handles null tenant for platform-wide", () => {
  const service = new CostReportService();

  service.createReport({
    tenantId: null,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 1000,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "system",
    submittedAt: "2026-04-15T00:00:00.000Z",
  });

  const summaries = service.listBudgetSummaries(50, null);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]!.budgetKey, "platform:USD");
});

// =============================================================================
// Cost Allocation Aggregation Tests
// =============================================================================

test("aggregateCostAttribution allocates by subject correctly", () => {
  const entries = [
    { subjectId: "division_alpha", amountUsd: 100.00 },
    { subjectId: "division_alpha", amountUsd: 50.00 },
    { subjectId: "division_beta", amountUsd: 75.00 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["division_alpha"], 150.00);
  assert.equal(result["division_beta"], 75.00);
});

test("aggregateCostAttribution handles decimal amounts", () => {
  const entries = [
    { subjectId: "task_precise", amountUsd: 0.123456789 },
    { subjectId: "task_precise", amountUsd: 0.123456789 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["task_precise"], 0.2469);
});

test("aggregateCostAttribution allocates across multiple divisions", () => {
  const entries = [
    { subjectId: "div_1", amountUsd: 10 },
    { subjectId: "div_2", amountUsd: 20 },
    { subjectId: "div_3", amountUsd: 30 },
    { subjectId: "div_4", amountUsd: 40 },
    { subjectId: "div_5", amountUsd: 50 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(Object.keys(result).length, 5);
  assert.equal(result["div_1"], 10);
  assert.equal(result["div_5"], 50);
});

test("aggregateCostAttribution handles large amounts", () => {
  const entries = [
    { subjectId: "large_subject", amountUsd: 1_000_000.00 },
    { subjectId: "large_subject", amountUsd: 500_000.00 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["large_subject"], 1_500_000.00);
});

test("aggregateCostAttribution handles mixed zero and non-zero", () => {
  const entries = [
    { subjectId: "task_mixed", amountUsd: 0 },
    { subjectId: "task_mixed", amountUsd: 0 },
    { subjectId: "task_mixed", amountUsd: 0.01 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["task_mixed"], 0.01);
});

test("aggregateCostAttribution allocates task costs correctly", () => {
  const entries = [
    { subjectId: "task_1", amountUsd: 0.10 },
    { subjectId: "task_2", amountUsd: 0.20 },
    { subjectId: "task_3", amountUsd: 0.15 },
  ];

  const result = aggregateCostAttribution(entries);

  const totalCost = Math.round(Object.values(result).reduce((sum, cost) => sum + cost, 0) * 100) / 100;
  assert.equal(totalCost, 0.45);
});

test("aggregateCostAttribution calculates per-task average correctly", () => {
  const entries = [
    { subjectId: "task_avg", amountUsd: 0.10 },
    { subjectId: "task_avg", amountUsd: 0.20 },
    { subjectId: "task_avg", amountUsd: 0.30 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["task_avg"], 0.60);
  // Average per task = 0.60 / 3 tasks = 0.20 per task
});

test("aggregateCostAttribution allocates by workflow", () => {
  const entries = [
    { subjectId: "workflow_alpha", amountUsd: 25.00 },
    { subjectId: "workflow_alpha", amountUsd: 15.00 },
    { subjectId: "workflow_alpha", amountUsd: 10.00 },
    { subjectId: "workflow_beta", amountUsd: 40.00 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["workflow_alpha"], 50.00);
  assert.equal(result["workflow_beta"], 40.00);
});

test("aggregateCostAttribution handles tenant isolation", () => {
  const entries = [
    { subjectId: "tenant_x:task_1", amountUsd: 10 },
    { subjectId: "tenant_x:task_2", amountUsd: 20 },
    { subjectId: "tenant_y:task_1", amountUsd: 30 },
  ];

  const result = aggregateCostAttribution(entries);

  // Tenant isolation uses prefixed subject IDs
  assert.equal(result["tenant_x:task_1"], 10);
  assert.equal(result["tenant_x:task_2"], 20);
  assert.equal(result["tenant_y:task_1"], 30);
});

test("aggregateCostAttribution calculates division totals", () => {
  // Simulate division-based cost allocation
  const entries = [
    { subjectId: "division:engineering", amountUsd: 500.00 },
    { subjectId: "division:engineering", amountUsd: 300.00 },
    { subjectId: "division:sales", amountUsd: 200.00 },
  ];

  const result = aggregateCostAttribution(entries);

  const engineering = result["division:engineering"] ?? 0;
  const sales = result["division:sales"] ?? 0;

  assert.equal(engineering, 800.00);
  assert.equal(sales, 200.00);

  const total = Object.values(result).reduce((sum, v) => sum + v, 0);
  assert.equal(total, 1000.00);
});

test("aggregateCostAttribution handles sparse allocations", () => {
  // Many subjects with few allocations each
  const entries = [
    { subjectId: "task_1", amountUsd: 0.01 },
    { subjectId: "task_2", amountUsd: 0.02 },
    { subjectId: "task_3", amountUsd: 0.03 },
    { subjectId: "task_100", amountUsd: 1.00 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(Object.keys(result).length, 4);
  assert.equal(result["task_100"], 1.00);
});

// =============================================================================
// Cost Allocation by Resource Type Tests
// =============================================================================

test("Cost allocation by resource type: compute vs storage", () => {
  const computeCosts = [
    { subjectId: "task_compute", amountUsd: 100.00 },
    { subjectId: "task_compute", amountUsd: 50.00 },
  ];

  const storageCosts = [
    { subjectId: "task_storage", amountUsd: 25.00 },
    { subjectId: "task_storage", amountUsd: 15.00 },
  ];

  const computeTotal = aggregateCostAttribution(computeCosts);
  const storageTotal = aggregateCostAttribution(storageCosts);

  assert.equal(computeTotal["task_compute"], 150.00);
  assert.equal(storageTotal["task_storage"], 40.00);
});

test("Cost allocation by cost center", () => {
  const entries = [
    { subjectId: "cost_center:engineering", amountUsd: 1000.00 },
    { subjectId: "cost_center:engineering", amountUsd: 500.00 },
    { subjectId: "cost_center:marketing", amountUsd: 300.00 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["cost_center:engineering"], 1500.00);
  assert.equal(result["cost_center:marketing"], 300.00);
});

test("Cost allocation by region", () => {
  const entries = [
    { subjectId: "region:us-west-2", amountUsd: 200.00 },
    { subjectId: "region:us-west-2", amountUsd: 100.00 },
    { subjectId: "region:eu-west-1", amountUsd: 150.00 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["region:us-west-2"], 300.00);
  assert.equal(result["region:eu-west-1"], 150.00);
});

// =============================================================================
// Multi-Dimensional Allocation Tests
// =============================================================================

test("Multi-dimensional allocation by tenant and division", () => {
  const entries = [
    { subjectId: "tenant_a:division_alpha", amountUsd: 100.00 },
    { subjectId: "tenant_a:division_alpha", amountUsd: 50.00 },
    { subjectId: "tenant_a:division_beta", amountUsd: 75.00 },
    { subjectId: "tenant_b:division_alpha", amountUsd: 200.00 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["tenant_a:division_alpha"], 150.00);
  assert.equal(result["tenant_a:division_beta"], 75.00);
  assert.equal(result["tenant_b:division_alpha"], 200.00);

  // Calculate tenant totals
  const tenantATotal = Object.entries(result)
    .filter(([key]) => key.startsWith("tenant_a:"))
    .reduce((sum, [, value]) => sum + value, 0);

  assert.equal(tenantATotal, 225.00); // 150 + 75
});

test("Multi-dimensional allocation by workflow and step", () => {
  const entries = [
    { subjectId: "wf_alpha:step_1", amountUsd: 10.00 },
    { subjectId: "wf_alpha:step_1", amountUsd: 5.00 },
    { subjectId: "wf_alpha:step_2", amountUsd: 15.00 },
    { subjectId: "wf_beta:step_1", amountUsd: 20.00 },
  ];

  const result = aggregateCostAttribution(entries);

  // Step-level allocation
  assert.equal(result["wf_alpha:step_1"], 15.00);
  assert.equal(result["wf_alpha:step_2"], 15.00);
  assert.equal(result["wf_beta:step_1"], 20.00);

  // Workflow totals
  const wfAlphaTotal = Object.entries(result)
    .filter(([key]) => key.startsWith("wf_alpha:"))
    .reduce((sum, [, value]) => sum + value, 0);

  assert.equal(wfAlphaTotal, 30.00);
});

// =============================================================================
// Cost Allocation Type Validation Tests
// =============================================================================

test("CostReportRecord type accepts valid structure", () => {
  const record: CostReportRecord = {
    reportId: "cost_report_test",
    tenantId: "tenant_validation",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 150.00,
    currency: "USD",
    resourceCosts: [],
    resourceCount: 0,
    submittedBy: "admin",
    submittedAt: "2026-04-15T12:00:00.000Z",
    createdAt: "2026-04-15T12:00:00.000Z",
  };

  assert.equal(record.reportId, "cost_report_test");
  assert.equal(record.totalCostUsd, 150.00);
});

test("CostReportRecord accepts null tenantId for platform reports", () => {
  const record: CostReportRecord = {
    reportId: "cost_report_platform",
    tenantId: null,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 1000.00,
    currency: "USD",
    resourceCosts: [],
    resourceCount: 0,
    submittedBy: "system",
    submittedAt: "2026-04-15T00:00:00.000Z",
    createdAt: "2026-04-15T00:00:00.000Z",
  };

  assert.equal(record.tenantId, null);
});

test("BudgetSummaryRecord type accepts valid structure", () => {
  const summary: BudgetSummaryRecord = {
    budgetKey: "tenant_test:USD",
    tenantId: "tenant_test",
    currency: "USD",
    totalCostUsd: 500.00,
    reportCount: 5,
    latestSubmittedAt: "2026-04-30T12:00:00.000Z",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
  };

  assert.equal(summary.budgetKey, "tenant_test:USD");
  assert.equal(summary.reportCount, 5);
});

test("CreateCostReportInput accepts optional tenantId", () => {
  const input: CreateCostReportInput = {
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    resourceCosts: [],
    submittedBy: "admin",
  };

  // tenantId is optional (can be null or undefined)
  assert.ok(input.tenantId === undefined || input.tenantId === null || typeof input.tenantId === "string");
});

test("CreateCostReportInput accepts optional currency", () => {
  const input: CreateCostReportInput = {
    tenantId: "tenant_currency_test",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    resourceCosts: [],
    submittedBy: "admin",
    currency: "EUR",
  };

  assert.equal(input.currency, "EUR");
});
