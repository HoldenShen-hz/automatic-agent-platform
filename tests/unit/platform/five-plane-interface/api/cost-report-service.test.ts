import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  CostReportService,
  type CreateCostReportInput,
  type CostReportResourceCost,
} from "../../../../../src/platform/five-plane-interface/api/cost-report-service.js";

describe("CostReportService", () => {
  let service: CostReportService;

  beforeEach(() => {
    service = new CostReportService();
  });

  describe("createReport", () => {
    it("should create a cost report with required fields", () => {
      const input: CreateCostReportInput = {
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1500.00,
        resourceCosts: [],
        submittedBy: "admin@example.com",
      };

      const report = service.createReport(input);

      assert.ok(report.reportId.startsWith("cost_report_"));
      assert.strictEqual(report.tenantId, null);
      assert.strictEqual(report.periodStart, "2024-01-01");
      assert.strictEqual(report.periodEnd, "2024-01-31");
      assert.strictEqual(report.totalCostUsd, 1500.00);
      assert.strictEqual(report.currency, "USD");
      assert.strictEqual(report.resourceCount, 0);
      assert.strictEqual(report.submittedBy, "admin@example.com");
      assert.ok(report.submittedAt);
      assert.ok(report.createdAt);
    });

    it("should create report with tenant ID", () => {
      const input: CreateCostReportInput = {
        tenantId: "tenant-abc",
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 2500.00,
        resourceCosts: [],
        submittedBy: "admin@example.com",
      };

      const report = service.createReport(input);

      assert.strictEqual(report.tenantId, "tenant-abc");
    });

    it("should use provided currency", () => {
      const input: CreateCostReportInput = {
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        currency: "EUR",
        resourceCosts: [],
        submittedBy: "admin",
      };

      const report = service.createReport(input);

      assert.strictEqual(report.currency, "EUR");
    });

    it("should copy resource costs", () => {
      const resourceCosts: CostReportResourceCost[] = [
        { resourceId: "res-1", resourceType: "compute", costUsd: 500, currency: "USD" },
        { resourceId: "res-2", resourceType: "storage", costUsd: 300, currency: "USD" },
      ];
      const input: CreateCostReportInput = {
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 800,
        resourceCosts,
        submittedBy: "admin",
      };

      const report = service.createReport(input);

      assert.strictEqual(report.resourceCount, 2);
      assert.strictEqual(report.resourceCosts.length, 2);
      assert.strictEqual(report.resourceCosts[0]?.resourceId, "res-1");
      assert.strictEqual(report.resourceCosts[1]?.resourceId, "res-2");
    });

    it("should use submittedAt from input when provided", () => {
      const customDate = "2024-02-15T10:00:00.000Z";
      const input: CreateCostReportInput = {
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        resourceCosts: [],
        submittedBy: "admin",
        submittedAt: customDate,
      };

      const report = service.createReport(input);

      assert.strictEqual(report.submittedAt, customDate);
    });
  });

  describe("listReports", () => {
    it("should list all reports when no tenant filter", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 100,
        resourceCosts: [],
        submittedBy: "admin",
        tenantId: "tenant-a",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 200,
        resourceCosts: [],
        submittedBy: "admin",
        tenantId: "tenant-b",
      });

      const reports = service.listReports(50);

      assert.strictEqual(reports.length, 2);
    });

    it("should filter by tenant ID", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 100,
        resourceCosts: [],
        submittedBy: "admin",
        tenantId: "tenant-abc",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 200,
        resourceCosts: [],
        submittedBy: "admin",
        tenantId: "tenant-xyz",
      });

      const reports = service.listReports(50, "tenant-abc");

      assert.strictEqual(reports.length, 1);
      assert.strictEqual(reports[0]?.totalCostUsd, 100);
    });

    it("should limit results", () => {
      for (let i = 0; i < 10; i++) {
        service.createReport({
          periodStart: "2024-01-01",
          periodEnd: "2024-01-31",
          totalCostUsd: 100,
          resourceCosts: [],
          submittedBy: "admin",
        });
      }

      const reports = service.listReports(3);

      assert.strictEqual(reports.length, 3);
    });

    it("should sort by submittedAt descending", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 100,
        resourceCosts: [],
        submittedBy: "admin",
        submittedAt: "2024-01-01T00:00:00.000Z",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 200,
        resourceCosts: [],
        submittedBy: "admin",
        submittedAt: "2024-02-15T00:00:00.000Z",
      });

      const reports = service.listReports(50);

      assert.ok(reports[0]!.submittedAt > reports[1]!.submittedAt);
    });

    it("should return empty array when no reports", () => {
      const reports = service.listReports(50);
      assert.strictEqual(reports.length, 0);
    });
  });

  describe("listBudgetSummaries", () => {
    it("should aggregate reports into budget summaries", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 500,
        currency: "USD",
        resourceCosts: [],
        submittedBy: "admin",
        submittedAt: "2024-01-15T00:00:00.000Z",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 700,
        currency: "USD",
        resourceCosts: [],
        submittedBy: "admin",
        submittedAt: "2024-02-15T00:00:00.000Z",
      });

      const summaries = service.listBudgetSummaries(50);

      assert.strictEqual(summaries.length, 1);
      assert.strictEqual(summaries[0]?.totalCostUsd, 1200);
      assert.strictEqual(summaries[0]?.reportCount, 2);
      assert.strictEqual(summaries[0]?.currency, "USD");
    });

    it("should separate summaries by tenant", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 500,
        currency: "USD",
        resourceCosts: [],
        submittedBy: "admin",
        tenantId: "tenant-a",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 300,
        currency: "USD",
        resourceCosts: [],
        submittedBy: "admin",
        tenantId: "tenant-b",
      });

      const summaries = service.listBudgetSummaries(50);

      assert.strictEqual(summaries.length, 2);
    });

    it("should separate summaries by currency", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 500,
        currency: "USD",
        resourceCosts: [],
        submittedBy: "admin",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 400,
        currency: "EUR",
        resourceCosts: [],
        submittedBy: "admin",
      });

      const summaries = service.listBudgetSummaries(50);

      assert.strictEqual(summaries.length, 2);
    });

    it("should use latest submittedAt for latestPeriodStart/End", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 100,
        currency: "USD",
        resourceCosts: [],
        submittedBy: "admin",
        submittedAt: "2024-01-01T00:00:00.000Z",
      });
      service.createReport({
        periodStart: "2024-03-01",
        periodEnd: "2024-03-31",
        totalCostUsd: 200,
        currency: "USD",
        resourceCosts: [],
        submittedBy: "admin",
        submittedAt: "2024-03-15T00:00:00.000Z",
      });

      const summaries = service.listBudgetSummaries(50);
      const summary = summaries.find((s) => s.currency === "USD")!;

      assert.strictEqual(summary.periodStart, "2024-03-01");
      assert.strictEqual(summary.periodEnd, "2024-03-31");
    });

    it("should return empty array when no reports", () => {
      const summaries = service.listBudgetSummaries(50);
      assert.strictEqual(summaries.length, 0);
    });
  });

  describe("computeDomainBreakdown", () => {
    it("should aggregate costs by domain", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        resourceCosts: [
          { resourceId: "r1", resourceType: "compute", costUsd: 400, currency: "USD", domainId: "domain-a" },
          { resourceId: "r2", resourceType: "storage", costUsd: 200, currency: "USD", domainId: "domain-b" },
        ],
        submittedBy: "admin",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 2000,
        resourceCosts: [
          { resourceId: "r3", resourceType: "compute", costUsd: 300, currency: "USD", domainId: "domain-a" },
        ],
        submittedBy: "admin",
      });

      const breakdown = service.computeDomainBreakdown(50);

      const domainA = breakdown.find((b) => b.dimensionId === "domain-a");
      const domainB = breakdown.find((b) => b.dimensionId === "domain-b");

      assert.ok(domainA);
      assert.ok(domainB);
      assert.strictEqual(domainA?.costUsd, 700); // 400 + 300
      assert.strictEqual(domainB?.costUsd, 200);
      assert.strictEqual(domainA?.dimensionType, "domain");
    });

    it("should compute percentage of total", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        resourceCosts: [
          { resourceId: "r1", resourceType: "compute", costUsd: 750, currency: "USD", domainId: "domain-a" },
          { resourceId: "r2", resourceType: "storage", costUsd: 250, currency: "USD", domainId: "domain-b" },
        ],
        submittedBy: "admin",
      });

      const breakdown = service.computeDomainBreakdown(50);
      const domainA = breakdown.find((b) => b.dimensionId === "domain-a")!;

      assert.strictEqual(domainA.percentageOfTotal, 0.75);
    });

    it("should filter by tenant", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        resourceCosts: [
          { resourceId: "r1", resourceType: "compute", costUsd: 500, currency: "USD", domainId: "domain-a" },
        ],
        submittedBy: "admin",
        tenantId: "tenant-abc",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 2000,
        resourceCosts: [
          { resourceId: "r2", resourceType: "compute", costUsd: 800, currency: "USD", domainId: "domain-a" },
        ],
        submittedBy: "admin",
        tenantId: "tenant-xyz",
      });

      const breakdown = service.computeDomainBreakdown(50, "tenant-abc");

      assert.strictEqual(breakdown.length, 1);
      assert.strictEqual(breakdown[0]?.costUsd, 500);
    });

    it("should sort by cost descending", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        resourceCosts: [
          { resourceId: "r1", resourceType: "compute", costUsd: 100, currency: "USD", domainId: "small-domain" },
          { resourceId: "r2", resourceType: "compute", costUsd: 900, currency: "USD", domainId: "large-domain" },
        ],
        submittedBy: "admin",
      });

      const breakdown = service.computeDomainBreakdown(50);

      assert.strictEqual(breakdown[0]?.dimensionId, "large-domain");
      assert.strictEqual(breakdown[1]?.dimensionId, "small-domain");
    });

    it("should return empty array when no domain costs", () => {
      const breakdown = service.computeDomainBreakdown(50);
      assert.strictEqual(breakdown.length, 0);
    });
  });

  describe("computeTeamBreakdown", () => {
    it("should aggregate costs by team", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        resourceCosts: [
          { resourceId: "r1", resourceType: "compute", costUsd: 400, currency: "USD", teamId: "team-alpha" },
          { resourceId: "r2", resourceType: "storage", costUsd: 200, currency: "USD", teamId: "team-beta" },
        ],
        submittedBy: "admin",
      });

      const breakdown = service.computeTeamBreakdown(50);

      const teamAlpha = breakdown.find((b) => b.dimensionId === "team-alpha");
      const teamBeta = breakdown.find((b) => b.dimensionId === "team-beta");

      assert.ok(teamAlpha);
      assert.ok(teamBeta);
      assert.strictEqual(teamAlpha?.costUsd, 400);
      assert.strictEqual(teamBeta?.costUsd, 200);
      assert.strictEqual(teamAlpha?.dimensionType, "team");
    });

    it("should filter by tenant", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        resourceCosts: [
          { resourceId: "r1", resourceType: "compute", costUsd: 500, currency: "USD", teamId: "team-a" },
        ],
        submittedBy: "admin",
        tenantId: "tenant-abc",
      });
      service.createReport({
        periodStart: "2024-02-01",
        periodEnd: "2024-02-29",
        totalCostUsd: 2000,
        resourceCosts: [
          { resourceId: "r2", resourceType: "compute", costUsd: 800, currency: "USD", teamId: "team-a" },
        ],
        submittedBy: "admin",
        tenantId: "tenant-xyz",
      });

      const breakdown = service.computeTeamBreakdown(50, "tenant-abc");

      assert.strictEqual(breakdown.length, 1);
      assert.strictEqual(breakdown[0]?.costUsd, 500);
    });
  });

  describe("computeOrgBreakdown", () => {
    it("should aggregate costs by org", () => {
      service.createReport({
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        totalCostUsd: 1000,
        resourceCosts: [
          { resourceId: "r1", resourceType: "compute", costUsd: 600, currency: "USD", orgId: "org-main" },
          { resourceId: "r2", resourceType: "storage", costUsd: 400, currency: "USD", orgId: "org-subsidiary" },
        ],
        submittedBy: "admin",
      });

      const breakdown = service.computeOrgBreakdown(50);

      const orgMain = breakdown.find((b) => b.dimensionId === "org-main");
      const orgSubsidiary = breakdown.find((b) => b.dimensionId === "org-subsidiary");

      assert.ok(orgMain);
      assert.ok(orgSubsidiary);
      assert.strictEqual(orgMain?.costUsd, 600);
      assert.strictEqual(orgSubsidiary?.costUsd, 400);
      assert.strictEqual(orgMain?.dimensionType, "org");
    });

    it("should return empty array when no org costs", () => {
      const breakdown = service.computeOrgBreakdown(50);
      assert.strictEqual(breakdown.length, 0);
    });
  });
});