import assert from "node:assert/strict";
import test from "node:test";

import { ChargebackService } from "../../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";
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
