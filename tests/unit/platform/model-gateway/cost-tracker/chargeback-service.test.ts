import assert from "node:assert/strict";
import test from "node:test";

import { ChargebackService, type ChargebackReportSource } from "../../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";
import { CostReportService } from "../../../../../src/platform/interface/api/cost-report-service.js";

test("ChargebackService aggregates report costs by tenant resource and currency", () => {
  const costReports = new CostReportService();
  costReports.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 12,
    resourceCosts: [{ resourceId: "openai:gpt-5", resourceType: "api", costUsd: 12, currency: "USD" }],
    submittedBy: "operator-1",
  });
  costReports.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-02T00:00:00.000Z",
    periodEnd: "2026-04-02T23:59:59.000Z",
    totalCostUsd: 8,
    resourceCosts: [{ resourceId: "openai:gpt-5", resourceType: "api", costUsd: 8, currency: "USD" }],
    submittedBy: "operator-1",
  });

  const report = new ChargebackService(costReports).buildReport({ tenantId: "tenant-1" });

  assert.equal(report.totalCostUsd, 20);
  assert.equal(report.reportCount, 2);
  assert.equal(report.allocations.length, 1);
  assert.equal(report.allocations[0]?.costUsd, 20);
  assert.equal(report.allocations[0]?.reportCount, 2);
});

test("ChargebackService aggregates multiple resources across reports", () => {
  const costReports = new CostReportService();
  costReports.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 100,
    resourceCosts: [
      { resourceId: "openai:gpt-5", resourceType: "api", costUsd: 80, currency: "USD" },
      { resourceId: "aws:s3", resourceType: "storage", costUsd: 20, currency: "USD" },
    ],
    submittedBy: "operator-1",
  });

  const report = new ChargebackService(costReports).buildReport({ tenantId: "tenant-1" });

  assert.equal(report.totalCostUsd, 100);
  assert.equal(report.allocations.length, 2);
  const gpt5Allocation = report.allocations.find((a) => a.resourceId === "openai:gpt-5");
  const s3Allocation = report.allocations.find((a) => a.resourceId === "aws:s3");
  assert.ok(gpt5Allocation);
  assert.ok(s3Allocation);
  assert.equal(gpt5Allocation?.costUsd, 80);
  assert.equal(s3Allocation?.costUsd, 20);
});

test("ChargebackService handles platform-level reports without tenant", () => {
  const costReports = new CostReportService();
  costReports.createReport({
    tenantId: null,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 50,
    resourceCosts: [{ resourceId: "internal:compute", resourceType: "compute", costUsd: 50, currency: "USD" }],
    submittedBy: "system",
  });

  const report = new ChargebackService(costReports).buildReport();

  assert.equal(report.totalCostUsd, 50);
  assert.equal(report.tenantId, null);
  // AllocationKey uses "platform" as fallback for null tenantId, but allocation stores actual tenantId
  assert.equal(report.allocations[0]?.allocationKey, "platform:compute:internal:compute:USD");
});

test("ChargebackService respects limit parameter", () => {
  const costReports = new CostReportService();
  for (let i = 0; i < 5; i++) {
    costReports.createReport({
      tenantId: "tenant-1",
      periodStart: `2026-04-0${i + 1}T00:00:00.000Z`,
      periodEnd: `2026-04-0${i + 1}T23:59:59.000Z`,
      totalCostUsd: 10,
      resourceCosts: [{ resourceId: "openai:gpt-5", resourceType: "api", costUsd: 10, currency: "USD" }],
      submittedBy: "operator-1",
    });
  }

  const report = new ChargebackService(costReports).buildReport({ limit: 3 });

  assert.equal(report.reportCount, 3);
});

test("ChargebackService handles empty reports", () => {
  const costReports = new CostReportService();
  const report = new ChargebackService(costReports).buildReport();

  assert.equal(report.totalCostUsd, 0);
  assert.equal(report.reportCount, 0);
  assert.equal(report.allocations.length, 0);
});

test("ChargebackService sorts allocations by cost descending", () => {
  const costReports = new CostReportService();
  costReports.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 150,
    resourceCosts: [
      { resourceId: "cheap:resource", resourceType: "api", costUsd: 10, currency: "USD" },
      { resourceId: "expensive:resource", resourceType: "compute", costUsd: 100, currency: "USD" },
      { resourceId: "medium:resource", resourceType: "storage", costUsd: 40, currency: "USD" },
    ],
    submittedBy: "operator-1",
  });

  const report = new ChargebackService(costReports).buildReport();

  assert.equal(report.allocations[0]?.resourceId, "expensive:resource");
  assert.equal(report.allocations[1]?.resourceId, "medium:resource");
  assert.equal(report.allocations[2]?.resourceId, "cheap:resource");
});

test("ChargebackService tracks first and latest period correctly", () => {
  const costReports = new CostReportService();
  costReports.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-15T00:00:00.000Z",
    periodEnd: "2026-04-15T23:59:59.000Z",
    totalCostUsd: 30,
    resourceCosts: [{ resourceId: "openai:gpt-5", resourceType: "api", costUsd: 30, currency: "USD" }],
    submittedBy: "operator-1",
  });
  costReports.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 20,
    resourceCosts: [{ resourceId: "openai:gpt-5", resourceType: "api", costUsd: 20, currency: "USD" }],
    submittedBy: "operator-1",
  });

  const report = new ChargebackService(costReports).buildReport({ tenantId: "tenant-1" });

  assert.equal(report.allocations[0]?.firstPeriodStart, "2026-04-01T00:00:00.000Z");
  assert.equal(report.allocations[0]?.latestPeriodEnd, "2026-04-15T23:59:59.000Z");
});

test("ChargebackService uses custom ChargebackReportSource", () => {
  const mockSource: ChargebackReportSource = {
    listReports: () => [
      {
        reportId: "r1",
        tenantId: "tenant-x",
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-01T23:59:59.000Z",
        totalCostUsd: 25,
        currency: "USD",
        resourceCosts: [{ resourceId: "custom:api", resourceType: "api", costUsd: 25, currency: "USD" }],
        resourceCount: 1,
        submittedBy: "test",
        submittedAt: "2026-04-01T12:00:00.000Z",
        createdAt: "2026-04-01T12:00:00.000Z",
      },
    ],
  };

  const report = new ChargebackService(mockSource).buildReport();

  assert.equal(report.totalCostUsd, 25);
  assert.equal(report.allocations[0]?.resourceId, "custom:api");
});
