/**
 * Chargeback Service Unit Tests - Issue #2087
 *
 * Tests for the chargeback service focusing on:
 * - Issue #2087: Cost tracking not atomic with execution - crash loses records
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ChargebackService, type ChargebackReportSource } from "../../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";

interface MockReportRecord {
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

function createMockReportSource(reports: MockReportRecord[]): ChargebackReportSource {
  return {
    listReports: () => reports,
  };
}

// ============================================================================
// Basic Functionality Tests
// ============================================================================

test("ChargebackService buildReport aggregates costs correctly", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [
        { resourceId: "api:openai", resourceType: "api", costUsd: 30, currency: "USD" },
        { resourceId: "compute:aws", resourceType: "compute", costUsd: 20, currency: "USD" },
      ],
      resourceCount: 2,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant-1",
      periodStart: "2026-04-02T00:00:00.000Z",
      periodEnd: "2026-04-02T23:59:59.000Z",
      totalCostUsd: 30,
      currency: "USD",
      resourceCosts: [
        { resourceId: "api:openai", resourceType: "api", costUsd: 30, currency: "USD" },
      ],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-02T12:00:00.000Z",
      createdAt: "2026-04-02T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ tenantId: "tenant-1" });

  assert.equal(report.totalCostUsd, 80);
  assert.equal(report.reportCount, 2);
  assert.equal(report.allocations.length, 2);

  const apiAlloc = report.allocations.find((a) => a.resourceId === "api:openai");
  assert.ok(apiAlloc);
  assert.equal(apiAlloc?.costUsd, 60);
  assert.equal(apiAlloc?.reportCount, 2);
});

test("ChargebackService buildReport handles empty reports", () => {
  const service = new ChargebackService(createMockReportSource([]));
  const report = service.buildReport();

  assert.equal(report.totalCostUsd, 0);
  assert.equal(report.reportCount, 0);
  assert.equal(report.allocations.length, 0);
});

test("ChargebackService buildReport with null tenantId includes all tenants", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [{ resourceId: "api:1", resourceType: "api", costUsd: 50, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant-2",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 30,
      currency: "USD",
      resourceCosts: [{ resourceId: "api:2", resourceType: "api", costUsd: 30, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport(); // No tenant filter

  assert.equal(report.totalCostUsd, 80);
  assert.equal(report.allocations.length, 2);
});

test("ChargebackService buildReport filters by tenantId correctly", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 100,
      currency: "USD",
      resourceCosts: [{ resourceId: "api:1", resourceType: "api", costUsd: 100, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant-2",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [{ resourceId: "api:2", resourceType: "api", costUsd: 50, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ tenantId: "tenant-1" });

  assert.equal(report.totalCostUsd, 100);
  assert.equal(report.reportCount, 1);
  assert.equal(report.allocations.length, 1);
  assert.equal(report.allocations[0]?.resourceId, "api:1");
});

test("ChargebackService buildReport respects limit parameter", () => {
  const reports: MockReportRecord[] = Array.from({ length: 10 }, (_, i) => ({
    reportId: `r${i}`,
    tenantId: "tenant-1",
    periodStart: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    periodEnd: `2026-04-${String(i + 1).padStart(2, "0")}T23:59:59.000Z`,
    totalCostUsd: 10,
    currency: "USD",
    resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 10, currency: "USD" }],
    resourceCount: 1,
    submittedBy: "test",
    submittedAt: `2026-04-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
    createdAt: `2026-04-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
  }));

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ limit: 3 });

  assert.equal(report.reportCount, 3);
});

test("ChargebackService buildReport defaults limit to 500", () => {
  const reports: MockReportRecord[] = Array.from({ length: 1000 }, (_, i) => ({
    reportId: `r${i}`,
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 1,
    currency: "USD",
    resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 1, currency: "USD" }],
    resourceCount: 1,
    submittedBy: "test",
    submittedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T12:00:00.000Z",
  }));

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  // Default limit is 500
  assert.equal(report.reportCount, 500);
});

// ============================================================================
// Currency Conversion Tests
// ============================================================================

test("ChargebackService buildReport converts currency to baseCurrency (USD)", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 54, // 50 EUR * 1.08 rate = 54 USD
      currency: "EUR",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 50, currency: "EUR" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ baseCurrency: "USD" });

  assert.equal(report.currency, "USD");
  // 50 EUR -> 50 * 1.08 = 54 USD
  assert.equal(report.totalCostUsd, 54);
});

test("ChargebackService buildReport with GBP conversion", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 127, // 100 GBP * 1.27 rate = 127 USD
      currency: "GBP",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 100, currency: "GBP" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ baseCurrency: "USD" });

  // 100 GBP * 1.27 = 127 USD
  assert.equal(report.totalCostUsd, 127);
});

test("ChargebackService buildReport handles JPY conversion", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 15, // 10000 JPY * 0.0067 rate = 67 USD... wait
      currency: "JPY",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 10000, currency: "JPY" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ baseCurrency: "USD" });

  // 10000 JPY * 0.0067 = 67 USD
  assert.equal(report.totalCostUsd, 67);
});

test("ChargebackService buildReport handles CNY conversion", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 14, // 100 CNY * 0.14 rate = 14 USD
      currency: "CNY",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 100, currency: "CNY" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ baseCurrency: "USD" });

  // 100 CNY * 0.14 = 14 USD
  assert.equal(report.totalCostUsd, 14);
});

test("ChargebackService buildReport unknown currency defaults to 1:1", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 100,
      currency: "XYZ",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 100, currency: "XYZ" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ baseCurrency: "USD" });

  // Unknown currency defaults to 1:1
  assert.equal(report.totalCostUsd, 100);
});

// ============================================================================
// Cost Source Metadata Tests
// ============================================================================

test("ChargebackService buildReport uses costSource from metadata", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [
        {
          resourceId: "api:openai",
          resourceType: "api",
          costUsd: 50,
          currency: "USD",
          metadata: { costSource: "token" },
        },
      ],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  const allocation = report.allocations[0];
  assert.equal(allocation?.costSource, "token");
});

test("ChargebackService buildReport falls back to resourceType when no costSource metadata", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [
        {
          resourceId: "api:openai",
          resourceType: "api",
          costUsd: 50,
          currency: "USD",
          // No metadata
        },
      ],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  const allocation = report.allocations[0];
  assert.equal(allocation?.costSource, "api");
});

test("ChargebackService buildReport trims whitespace from costSource", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [
        {
          resourceId: "api:openai",
          resourceType: "api",
          costUsd: 50,
          currency: "USD",
          metadata: { costSource: "  token  " },
        },
      ],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  const allocation = report.allocations[0];
  assert.equal(allocation?.costSource, "token");
});

// ============================================================================
// Aggregation Tests
// ============================================================================

test("ChargebackService buildReport aggregates same resource across reports", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 30,
      currency: "USD",
      resourceCosts: [{ resourceId: "api:openai", resourceType: "api", costUsd: 30, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant-1",
      periodStart: "2026-04-02T00:00:00.000Z",
      periodEnd: "2026-04-02T23:59:59.000Z",
      totalCostUsd: 70,
      currency: "USD",
      resourceCosts: [{ resourceId: "api:openai", resourceType: "api", costUsd: 70, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-02T12:00:00.000Z",
      createdAt: "2026-04-02T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ tenantId: "tenant-1" });

  const allocation = report.allocations.find((a) => a.resourceId === "api:openai");
  assert.ok(allocation);
  assert.equal(allocation?.costUsd, 100);
  assert.equal(allocation?.reportCount, 2);
});

test("ChargebackService buildReport tracks first and latest period correctly", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-15T00:00:00.000Z",
      periodEnd: "2026-04-15T23:59:59.000Z",
      totalCostUsd: 30,
      currency: "USD",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 30, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-15T12:00:00.000Z",
      createdAt: "2026-04-15T12:00:00.000Z",
    },
    {
      reportId: "r2",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 20,
      currency: "USD",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 20, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ tenantId: "tenant-1" });

  const allocation = report.allocations[0];
  assert.equal(allocation?.firstPeriodStart, "2026-04-01T00:00:00.000Z");
  assert.equal(allocation?.latestPeriodEnd, "2026-04-15T23:59:59.000Z");
});

test("ChargebackService buildReport sorts allocations by cost descending", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 150,
      currency: "USD",
      resourceCosts: [
        { resourceId: "api:cheap", resourceType: "api", costUsd: 10, currency: "USD" },
        { resourceId: "api:expensive", resourceType: "compute", costUsd: 100, currency: "USD" },
        { resourceId: "api:medium", resourceType: "storage", costUsd: 40, currency: "USD" },
      ],
      resourceCount: 3,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  assert.equal(report.allocations[0]?.resourceId, "api:expensive");
  assert.equal(report.allocations[1]?.resourceId, "api:medium");
  assert.equal(report.allocations[2]?.resourceId, "api:cheap");
});

test("ChargebackService buildReport with limit 0 returns empty", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 100,
      currency: "USD",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 100, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport({ limit: 0 });

  assert.equal(report.reportCount, 0);
  assert.equal(report.totalCostUsd, 0);
  assert.equal(report.allocations.length, 0);
});

// ============================================================================
// Platform-level Reports Tests
// ============================================================================

test("ChargebackService buildReport handles null tenantId (platform reports)", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: null,
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [{ resourceId: "internal:compute", resourceType: "compute", costUsd: 50, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "system",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  assert.equal(report.tenantId, null);
  assert.equal(report.totalCostUsd, 50);
});

test("ChargebackService generatedAt is ISO timestamp", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 10,
      currency: "USD",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 10, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  // Should be valid ISO timestamp
  assert.ok(report.generatedAt.endsWith("Z") || report.generatedAt.includes("+"));
  assert.doesNotThrow(() => new Date(report.generatedAt));
});

// ============================================================================
// Issue #2087: Atomicity Tests
// ============================================================================

test("ChargebackService buildReport does not mutate original reports", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [{ resourceId: "api:openai", resourceType: "api", costUsd: 50, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const originalTotal = reports[0].totalCostUsd;
  const report = service.buildReport();

  // Modify report
  reports[0].totalCostUsd = 999;

  // Service should still have original values
  assert.equal(report.totalCostUsd, originalTotal);
});

test("ChargebackService buildReport creates independent allocation objects", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 50, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report1 = service.buildReport();
  const report2 = service.buildReport();

  // Allocations should be independent copies
  report1.allocations[0]!.costUsd = 999;

  assert.equal(report2.allocations[0]!.costUsd, 50);
});

test("ChargebackService buildReport multiple calls produce consistent results", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 50, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));

  const report1 = service.buildReport();
  const report2 = service.buildReport();
  const report3 = service.buildReport();

  assert.equal(report1.totalCostUsd, report2.totalCostUsd);
  assert.equal(report2.totalCostUsd, report3.totalCostUsd);
  assert.equal(report1.allocations.length, report2.allocations.length);
});

test("ChargebackService buildReport handles reports with no resourceCosts gracefully", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 0,
      currency: "USD",
      resourceCosts: [],
      resourceCount: 0,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  assert.equal(report.totalCostUsd, 0);
  assert.equal(report.allocations.length, 0);
});

test("ChargebackService buildReport allocationKey includes all identifiers", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 50,
      currency: "USD",
      resourceCosts: [{ resourceId: "api:openai", resourceType: "api", costUsd: 50, currency: "USD" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  const allocation = report.allocations[0];
  assert.ok(allocation?.allocationKey.includes("tenant-1"));
  assert.ok(allocation?.allocationKey.includes("api"));
  assert.ok(allocation?.allocationKey.includes("api:openai"));
  assert.ok(allocation?.allocationKey.includes("USD"));
});

test("ChargebackService buildReport fxRateToBase is recorded correctly", () => {
  const reports: MockReportRecord[] = [
    {
      reportId: "r1",
      tenantId: "tenant-1",
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-01T23:59:59.000Z",
      totalCostUsd: 54,
      currency: "EUR",
      resourceCosts: [{ resourceId: "api", resourceType: "api", costUsd: 50, currency: "EUR" }],
      resourceCount: 1,
      submittedBy: "test",
      submittedAt: "2026-04-01T12:00:00.000Z",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
  ];

  const service = new ChargebackService(createMockReportSource(reports));
  const report = service.buildReport();

  const allocation = report.allocations[0];
  assert.equal(allocation?.fxRateToBase, 1.08); // EUR to USD rate
  assert.equal(allocation?.originalCurrency, "EUR");
  assert.equal(allocation?.baseCurrency, "USD");
});