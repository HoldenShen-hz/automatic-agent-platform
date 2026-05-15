/**
 * Integration tests for ChargebackService
 *
 * Tests the chargeback reporting service with realistic multi-tenant,
 * multi-currency cost data scenarios.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ChargebackService, type ChargebackReportSource } from "../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";
import type { CostReportRecord } from "../../../../src/platform/five-plane-interface/api/cost-report-service.js";

function createMockCostReportSource(reports: CostReportRecord[]): ChargebackReportSource {
  return {
    listReports: (limit?: number, _tenantId?: string | null) => {
      return reports.slice(0, limit ?? 500);
    },
  };
}

test("ChargebackService integration: Empty report when no reports available", () => {
  const source = createMockCostReportSource([]);
  const service = new ChargebackService(source);

  const report = service.buildReport({});

  assert.strictEqual(report.totalCostUsd, 0);
  assert.strictEqual(report.reportCount, 0);
  assert.deepStrictEqual(report.allocations, []);
  assert.strictEqual(report.tenantId, null);
  assert.strictEqual(report.currency, "USD");
});

test("ChargebackService integration: Single report aggregation", () => {
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

  assert.strictEqual(report.reportCount, 1);
  assert.strictEqual(report.totalCostUsd, 100);
  assert.strictEqual(report.allocations.length, 2);
});

test("ChargebackService integration: EUR to USD currency conversion", () => {
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
  assert.strictEqual(report.totalCostUsd, 108);
  assert.strictEqual(report.currency, "USD");
});

test("ChargebackService integration: Multiple reports with same allocation key merge correctly", () => {
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
  assert.strictEqual(report.reportCount, 2);
  assert.strictEqual(report.allocations.length, 1);
  assert.strictEqual(report.allocations[0]!.costOriginal, 70);
  assert.strictEqual(report.allocations[0]!.reportCount, 2);
});

test("ChargebackService integration: Allocations sorted by cost descending", () => {
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

  assert.strictEqual(report.allocations.length, 3);
  // Sorted by cost descending
  assert.strictEqual(report.allocations[0]!.resourceId, "res2");
  assert.strictEqual(report.allocations[1]!.resourceId, "res1");
  assert.strictEqual(report.allocations[2]!.resourceId, "res3");
});

test("ChargebackService integration: Null tenant reports grouped under platform key", () => {
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
  assert.ok(report.allocations[0]!.allocationKey.startsWith("platform:"), `Key was: ${report.allocations[0]!.allocationKey}`);
});

test("ChargebackService integration: Limit parameter restricts reports", () => {
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

  assert.strictEqual(report.reportCount, 3);
});

test("ChargebackService integration: Period tracking across merged allocations", () => {
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

  assert.strictEqual(report.allocations.length, 1);
  assert.strictEqual(report.allocations[0]!.firstPeriodStart, "2024-01-01T00:00:00Z");
  assert.strictEqual(report.allocations[0]!.latestPeriodEnd, "2024-03-31T23:59:59Z");
});

test("ChargebackService integration: FX rate tracking in allocations", () => {
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

  assert.strictEqual(report.allocations[0]!.fxRateToBase, 1.08);
  assert.strictEqual(report.allocations[0]!.originalCurrency, "EUR");
  assert.strictEqual(report.allocations[0]!.baseCurrency, "USD");
});

test("ChargebackService integration: Multi-currency mixed into USD", () => {
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
      tenantId: "tenant2",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 50,
      currency: "GBP",
      resourceCosts: [
        { resourceId: "api-key-2", resourceType: "api", costUsd: 50, currency: "GBP" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ baseCurrency: "USD" });

  // EUR: 100 * 1.08 = 108
  // GBP: 50 * 1.27 = 63.5
  // Total: 171.5
  assert.strictEqual(report.totalCostUsd, 171.5);
  assert.strictEqual(report.currency, "USD");
  assert.strictEqual(report.reportCount, 2);
  assert.strictEqual(report.allocations.length, 2);
});

test("ChargebackService integration: JPY currency conversion", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 10000,
      currency: "JPY",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 10000, currency: "JPY" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ baseCurrency: "USD" });

  // JPY to USD: 10000 * 0.0067 = 67 USD
  assert.strictEqual(report.totalCostUsd, 67);
});

test("ChargebackService integration: Cost source from metadata", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 100,
      currency: "USD",
      resourceCosts: [
        {
          resourceId: "res1",
          resourceType: "api",
          costUsd: 100,
          currency: "USD",
          metadata: { costSource: "token" },
        },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({});

  assert.strictEqual(report.allocations[0]!.costSource, "token");
});

test("ChargebackService integration: Resource type used when no costSource metadata", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 100,
      currency: "USD",
      resourceCosts: [
        {
          resourceId: "res1",
          resourceType: "compute",
          costUsd: 100,
          currency: "USD",
        },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({});

  assert.strictEqual(report.allocations[0]!.costSource, "compute");
});

test("ChargebackService integration: CNY currency conversion", () => {
  const source = createMockCostReportSource([
    {
      reportId: "r1",
      tenantId: "tenant1",
      periodStart: "2024-01-01T00:00:00Z",
      periodEnd: "2024-01-31T23:59:59Z",
      totalCostUsd: 1000,
      currency: "CNY",
      resourceCosts: [
        { resourceId: "res1", resourceType: "api", costUsd: 1000, currency: "CNY" },
      ],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2024-02-01T00:00:00Z",
      createdAt: "2024-02-01T00:00:00Z",
    },
  ]);

  const service = new ChargebackService(source);
  const report = service.buildReport({ baseCurrency: "USD" });

  // CNY to USD: 1000 * 0.14 = 140 USD
  assert.strictEqual(report.totalCostUsd, 140);
});
