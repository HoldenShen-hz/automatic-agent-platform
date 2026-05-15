import assert from "node:assert/strict";
import test from "node:test";

import { ChargebackService, type ChargebackReportSource, type ChargebackAllocation } from "../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";
import type { CostReportRecord } from "../../../../src/platform/five-plane-interface/api/cost-report-service.js";

function createMockCostReportSource(reports: CostReportRecord[]): ChargebackReportSource {
  return {
    listReports: (limit?: number, _tenantId?: string | null) => {
      return reports.slice(0, limit ?? 500);
    },
  };
}

test("ChargebackService buildReport returns empty report when no reports", () => {
  const source = createMockCostReportSource([]);
  const service = new ChargebackService(source);

  const report = service.buildReport({});

  assert.equal(report.totalCostUsd, 0);
  assert.equal(report.reportCount, 0);
  assert.deepStrictEqual(report.allocations, []);
  assert.equal(report.tenantId, null);
  assert.equal(report.currency, "USD");
});

test("ChargebackService buildReport aggregates single report", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 100,
      currency: "USD",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 50, currency: "USD" },
        { resourceId: "res2", resourceType: "compute", costUsd: 50, currency: "USD" },
      ],
      resourceCount: 2,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ tenantId: "tenant1" });

  assert.equal(report.reportCount, 1);
  assert.equal(report.totalCostUsd, 100);
  assert.equal(report.allocations.length, 2);
});

test("ChargebackService buildReport converts currency to base currency", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 100,
      currency: "EUR",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 100, currency: "EUR" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ baseCurrency: "USD" });

  // EUR to USD rate is 1.08, so 100 EUR = 108 USD
  assert.equal(report.totalCostUsd, 108);
  assert.equal(report.currency, "USD");
});

test("ChargebackService buildReport merges allocations with same key", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 60,
      currency: "USD",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 30, currency: "USD" },
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
      totalCostUsd: 90,
      currency: "USD",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 40, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-03-01T00:00:00Z",
      createdAt: "2024-03-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ tenantId: "tenant1" });

  // Should be merged into one allocation for res1
  assert.equal(report.reportCount, 2);
  assert.equal(report.allocations.length, 1);
  assert.equal(report.allocations[0]!.costOriginal, 70);
  assert.equal(report.allocations[0]!.reportCount, 2);
});

test("ChargebackService buildReport sorts allocations by cost descending", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 150,
      currency: "USD",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 30, currency: "USD" },
        { resourceId: "res2", resourceType: "compute", costUsd: 100, currency: "USD" },
        { resourceId: "res3", resourceType: "storage", costUsd: 20, currency: "USD" },
      ],
      resourceCount: 3,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({});

  assert.equal(report.allocations.length, 3);
  // Sorted by cost descending
  assert.equal(report.allocations[0]!.resourceId, "res2");
  assert.equal(report.allocations[1]!.resourceId, "res1");
  assert.equal(report.allocations[2]!.resourceId, "res3");
});

test("ChargebackService buildReport merges null tenant reports under platform key", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: null,
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 50, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ tenantId: null });

  // Allocation key uses "platform" for null tenantId
  assert.equal(report.allocations[0]!.allocationKey.startsWith("platform:"), true);
});

test("ChargebackService buildReport respects limit parameter", () => {
  const reports: CostReportRecord[] = [];
  for (let i = 0; i < 5; i++) {
    reports.push({
      reportId: `r${i}`,
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 100,
      currency: "USD",
      resourceCosts: [
        { resourceId: `res${i}`, resourceType: "api", costUsd: 100, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    });
  }

  const source = createMockCostReportSource(reports);
  const service = new ChargebackService(source);
  const report = service.buildReport({ limit: 3 });

  assert.equal(report.reportCount, 3);
});

test("ChargebackService buildReport tracks firstPeriodStart and latestPeriodEnd", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 30,
      currency: "USD",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 30, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant1",
      periodStart: "2024-03-01T00:00:00Z",
      periodEnd: "2024-03-31T23:59:59Z",
      totalCostUsd: 30,
      currency: "USD",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 30, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-04-01T00:00:00Z",
      createdAt: "2024-04-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({});

  assert.equal(report.allocations.length, 1);
  assert.equal(report.allocations[0]!.firstPeriodStart, "2024-01-01T00:00:00Z");
  assert.equal(report.allocations[0]!.latestPeriodEnd, "2024-03-31T23:59:59Z");
});

test("ChargebackService buildReport includes fxRateToBase in allocations", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 100,
      currency: "EUR",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 100, currency: "EUR" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ baseCurrency: "USD" });

  assert.equal(report.allocations[0]!.fxRateToBase, 1.08);
  assert.equal(report.allocations[0]!.originalCurrency, "EUR");
  assert.equal(report.allocations[0]!.baseCurrency, "USD");
});
