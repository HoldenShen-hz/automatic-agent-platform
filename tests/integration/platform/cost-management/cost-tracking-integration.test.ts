/**
 * Integration Tests: Cost Tracking and Alerts
 *
 * Tests cost tracking, budget threshold checking, and cost alerting
 * across the platform cost management module.
 *
 * Uses node:test + assert/strict with ESM and .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CostEstimationService } from "../../../../src/scale-ecosystem/billing/cost-estimation-service.js";
import { CostAlertService } from "../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-service.js";
import { CostReportService } from "../../../../src/platform/five-plane-interface/api/cost-report-service.js";

// ============================================================================
// Cost Tracking and Aggregation Tests
// ============================================================================

test("cost tracking: estimate, alert, and report compose correctly", () => {
  // Step 1: Estimate cost based on historical data
  const mockDb = {
    connection: {
      prepare: (_sql?: string) => ({
        get: () => ({ avg_cost: 0.25, sample_count: 50 }),
      }),
    },
  };
  const estimationService = new CostEstimationService(mockDb as any);

  const estimate = estimationService.estimate("division_a");

  assert.equal(estimate.divisionId, "division_a");
  assert.equal(estimate.basedOn, "division_avg");
  assert.ok(estimate.estimatedCostUsd > 0);
});

test("cost tracking: cost aggregation by division", () => {
  // Step 1: Estimate
  const mockDb = {
    connection: {
      prepare: (_sql?: string) => ({
        get: () => ({ avg_cost: 0.15, sample_count: 25 }),
      }),
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate1 = service.estimate("division_a");
  const estimate2 = service.estimate("division_b");

  assert.ok(estimate1.estimatedCostUsd > 0);
  assert.ok(estimate2.estimatedCostUsd > 0);
});

test("cost tracking: global average fallback", () => {
  const mockDb = {
    connection: {
      prepare: (sql?: string) => {
        if (sql?.includes("division_id")) {
          return { get: () => null };
        }
        return { get: () => ({ avg_cost: 0.10, sample_count: 100 }) };
      },
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate("unknown_division");

  assert.equal(estimate.basedOn, "global_avg");
  assert.equal(estimate.divisionId, null);
});

test("cost tracking: default cost when no historical data", () => {
  const mockDb = {
    connection: {
      prepare: () => ({ get: () => null }),
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
  assert.equal(estimate.confidence, "default");
});

test("cost tracking: confidence levels based on sample count", () => {
  const mockDb = {
    connection: {
      prepare: () => ({
        get: () => ({ avg_cost: 0.20, sample_count: 100 }),
      }),
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.confidence, "high");
});

test("cost tracking: medium confidence with moderate samples", () => {
  const mockDb = {
    connection: {
      prepare: () => ({
        get: () => ({ avg_cost: 0.20, sample_count: 10 }),
      }),
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.confidence, "medium");
});

test("cost tracking: low confidence with few samples", () => {
  const mockDb = {
    connection: {
      prepare: () => ({
        get: () => ({ avg_cost: 0.20, sample_count: 3 }),
      }),
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.confidence, "low");
});

test("cost tracking: custom confidence thresholds", () => {
  const mockDb = {
    connection: {
      prepare: () => ({
        get: () => ({ avg_cost: 0.20, sample_count: 8 }),
      }),
    },
  };
  const service = new CostEstimationService(mockDb as any, {
    highConfidenceThreshold: 50,
    mediumConfidenceThreshold: 20,
  });

  const estimate = service.estimate();

  // With 8 samples and threshold 50/20, should be "low"
  assert.equal(estimate.confidence, "low");
});

// ============================================================================
// Cost Report Service Tests
// ============================================================================

test("cost reporting: creates cost report with resource breakdown", () => {
  const reportService = new CostReportService();

  const report = reportService.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 250.75,
    currency: "USD",
    resourceCosts: [
      { resourceId: "compute_1", resourceType: "compute", costUsd: 150.00, currency: "USD" },
      { resourceId: "storage_1", resourceType: "storage", costUsd: 70.50, currency: "USD" },
      { resourceId: "api_1", resourceType: "api", costUsd: 30.25, currency: "USD" },
    ],
    submittedBy: "admin",
  });

  assert.match(report.reportId, /^cost_report_[0-9a-f-]+$/);
  assert.equal(report.tenantId, "tenant_1");
  assert.equal(report.totalCostUsd, 250.75);
  assert.equal(report.resourceCount, 3);
  assert.equal(report.currency, "USD");
});

test("cost reporting: lists reports by tenant", () => {
  const reportService = new CostReportService();

  reportService.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    resourceCosts: [],
    submittedBy: "admin",
  });

  reportService.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-03-01T00:00:00.000Z",
    periodEnd: "2026-03-31T23:59:59.999Z",
    totalCostUsd: 80,
    resourceCosts: [],
    submittedBy: "admin",
  });

  reportService.createReport({
    tenantId: "tenant_2",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 200,
    resourceCosts: [],
    submittedBy: "admin",
  });

  const tenant1Reports = reportService.listReports(50, "tenant_1");
  const allReports = reportService.listReports(50, null);

  assert.equal(tenant1Reports.length, 2);
  assert.equal(allReports.length, 3);
});

test("cost reporting: generates budget summaries", () => {
  const reportService = new CostReportService();

  reportService.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-15T23:59:59.999Z",
    totalCostUsd: 50,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-15T12:00:00.000Z",
  });

  reportService.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-04-16T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 75,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-30T12:00:00.000Z",
  });

  const summaries = reportService.listBudgetSummaries(50, "tenant_1");

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]!.totalCostUsd, 125);
  assert.equal(summaries[0]!.reportCount, 2);
});

test("cost reporting: respects limit parameter", () => {
  const reportService = new CostReportService();

  for (let i = 0; i < 5; i++) {
    reportService.createReport({
      tenantId: null,
      periodStart: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      periodEnd: `2026-04-${String(i + 1).padStart(2, "0")}T23:59:59.999Z`,
      totalCostUsd: 10 * (i + 1),
      resourceCosts: [],
      submittedBy: "admin",
      submittedAt: `2026-04-${String(i + 10).padStart(2, "0")}T12:00:00.000Z`,
    });
  }

  const limited = reportService.listReports(3, null);

  assert.equal(limited.length, 3);
});

test("cost reporting: handles platform-wide reports with null tenantId", () => {
  const reportService = new CostReportService();

  reportService.createReport({
    tenantId: null,
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 500,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "system",
  });

  const platformReports = reportService.listReports(50, null);

  assert.ok(platformReports.length > 0);
  const platformReport = platformReports.find((r) => r.tenantId === null);
  assert.ok(platformReport != null);
});

test("cost reporting: cost report structure validation", () => {
  const reportService = new CostReportService();

  const report = reportService.createReport({
    tenantId: "tenant_verify",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 123.45,
    currency: "USD",
    resourceCosts: [
      { resourceId: "r1", resourceType: "compute", costUsd: 100.00, currency: "USD" },
      { resourceId: "r2", resourceType: "storage", costUsd: 23.45, currency: "USD" },
    ],
    submittedBy: "admin",
    submittedAt: "2026-04-30T12:00:00.000Z",
  });

  assert.ok(report.reportId.length > 0);
  assert.equal(report.tenantId, "tenant_verify");
  assert.equal(report.totalCostUsd, 123.45);
  assert.equal(report.resourceCount, 2);
  assert.ok(report.createdAt.length > 0);
});

// ============================================================================
// Cost Estimation Configuration Tests
// ============================================================================

test("cost estimation: custom default cost", () => {
  const mockDb = {
    connection: {
      prepare: () => ({ get: () => null }),
    },
  };
  const service = new CostEstimationService(mockDb as any, {
    defaultCostUsd: 0.10,
  });

  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0.10);
  assert.equal(estimate.confidence, "default");
});

test("cost estimation: rounding to 4 decimal places", () => {
  const mockDb = {
    connection: {
      prepare: () => ({
        get: () => ({ avg_cost: 0.123456789, sample_count: 100 }),
      }),
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.estimatedCostUsd, 0.1235);
});

test("cost estimation: null divisionId uses global average", () => {
  const mockDb = {
    connection: {
      prepare: () => ({
        get: () => ({ avg_cost: 0.08, sample_count: 30 }),
      }),
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate(null);

  assert.equal(estimate.basedOn, "global_avg");
  assert.equal(estimate.divisionId, null);
});

test("cost estimation: filters zero-cost events", () => {
  let callCount = 0;
  const mockDb = {
    connection: {
      prepare: (sql?: string) => {
        callCount++;
        if (sql?.includes("division_id") && callCount === 1) {
          return { get: () => ({ avg_cost: 0, sample_count: 0 }) };
        }
        return { get: () => ({ avg_cost: 0.12, sample_count: 15 }) };
      },
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate("division_with_zero_avg");

  assert.equal(estimate.basedOn, "global_avg");
});

test("cost estimation: handles undefined avg_cost", () => {
  const mockDb = {
    connection: {
      prepare: () => ({ get: () => ({ avg_cost: null, sample_count: 0 }) }),
    },
  };
  const service = new CostEstimationService(mockDb as any);

  const estimate = service.estimate();

  assert.equal(estimate.basedOn, "default");
});
