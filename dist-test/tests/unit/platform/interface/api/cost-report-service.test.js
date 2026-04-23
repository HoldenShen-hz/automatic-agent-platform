import assert from "node:assert/strict";
import test from "node:test";
import { CostReportService } from "../../../../../src/platform/interface/api/cost-report-service.js";
function makeResourceCost(overrides = {}) {
    return {
        resourceId: "res_001",
        resourceType: "compute",
        costUsd: 0.5,
        currency: "USD",
        ...overrides,
    };
}
function makeCreateInput(overrides = {}) {
    return {
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.999Z",
        totalCostUsd: 100.0,
        currency: "USD",
        resourceCosts: [makeResourceCost()],
        submittedBy: "user_001",
        ...overrides,
    };
}
test("createReport generates a valid CostReportRecord", () => {
    const service = new CostReportService();
    const input = makeCreateInput();
    const report = service.createReport(input);
    assert.ok(report.reportId.startsWith("cost_report_"));
    assert.equal(report.tenantId, null);
    assert.equal(report.periodStart, "2026-04-01T00:00:00.000Z");
    assert.equal(report.periodEnd, "2026-04-30T23:59:59.999Z");
    assert.equal(report.totalCostUsd, 100.0);
    assert.equal(report.currency, "USD");
    assert.equal(report.resourceCount, 1);
    assert.equal(report.submittedBy, "user_001");
    assert.ok(report.submittedAt);
    assert.ok(report.createdAt);
});
test("createReport uses provided tenantId", () => {
    const service = new CostReportService();
    const report = service.createReport(makeCreateInput({ tenantId: "tenant_abc" }));
    assert.equal(report.tenantId, "tenant_abc");
});
test("createReport uses provided currency", () => {
    const service = new CostReportService();
    const report = service.createReport(makeCreateInput({ currency: "EUR" }));
    assert.equal(report.currency, "EUR");
});
test("createReport defaults currency to USD", () => {
    const service = new CostReportService();
    // Omit currency field entirely to test default
    const input = {
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.999Z",
        totalCostUsd: 100.0,
        resourceCosts: [makeResourceCost()],
        submittedBy: "user_001",
    };
    const report = service.createReport(input);
    assert.equal(report.currency, "USD");
});
test("createReport uses submittedAt or falls back to createdAt", () => {
    const service = new CostReportService();
    const customTime = "2026-03-15T12:00:00.000Z";
    const report = service.createReport(makeCreateInput({ submittedAt: customTime }));
    assert.equal(report.submittedAt, customTime);
});
test("listReports returns all reports sorted by submittedAt descending", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput({ submittedAt: "2026-04-01T00:00:00.000Z" }));
    service.createReport(makeCreateInput({ submittedAt: "2026-04-03T00:00:00.000Z" }));
    service.createReport(makeCreateInput({ submittedAt: "2026-04-02T00:00:00.000Z" }));
    const reports = service.listReports();
    assert.equal(reports.length, 3);
    const [r0, r1, r2] = reports;
    assert.equal(r0.submittedAt, "2026-04-03T00:00:00.000Z");
    assert.equal(r1.submittedAt, "2026-04-02T00:00:00.000Z");
    assert.equal(r2.submittedAt, "2026-04-01T00:00:00.000Z");
});
test("listReports filters by tenantId when provided", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput({ tenantId: "tenant_a" }));
    service.createReport(makeCreateInput({ tenantId: "tenant_b" }));
    service.createReport(makeCreateInput({ tenantId: "tenant_a" }));
    assert.equal(service.listReports(50, "tenant_a").length, 2);
    assert.equal(service.listReports(50, "tenant_b").length, 1);
    assert.equal(service.listReports(50, "tenant_c").length, 0);
});
test("listReports returns all when tenantId is undefined", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput({ tenantId: "tenant_a" }));
    service.createReport(makeCreateInput({ tenantId: null }));
    assert.equal(service.listReports(50, undefined).length, 2);
});
test("listReports respects limit", () => {
    const service = new CostReportService();
    for (let i = 0; i < 10; i++) {
        service.createReport(makeCreateInput({ submittedAt: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` }));
    }
    const reports = service.listReports(5);
    assert.equal(reports.length, 5);
});
test("listReports handles zero limit", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput());
    const reports = service.listReports(0);
    assert.equal(reports.length, 0);
});
test("listBudgetSummaries aggregates by tenant and currency", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput({ tenantId: "tenant_a", totalCostUsd: 50, currency: "USD" }));
    service.createReport(makeCreateInput({ tenantId: "tenant_a", totalCostUsd: 30, currency: "USD" }));
    service.createReport(makeCreateInput({ tenantId: "tenant_b", totalCostUsd: 20, currency: "USD" }));
    service.createReport(makeCreateInput({ tenantId: "tenant_a", totalCostUsd: 15, currency: "EUR" }));
    const summaries = service.listBudgetSummaries(50, undefined);
    const usdTenantA = summaries.find((s) => s.budgetKey === "tenant_a:USD");
    assert.ok(usdTenantA);
    assert.equal(usdTenantA.totalCostUsd, 80);
    assert.equal(usdTenantA.reportCount, 2);
    const usdTenantB = summaries.find((s) => s.budgetKey === "tenant_b:USD");
    assert.ok(usdTenantB);
    assert.equal(usdTenantB.totalCostUsd, 20);
    const eurTenantA = summaries.find((s) => s.budgetKey === "tenant_a:EUR");
    assert.ok(eurTenantA);
    assert.equal(eurTenantA.totalCostUsd, 15);
});
test("listBudgetSummaries groups null tenantId as platform", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput({ tenantId: null, totalCostUsd: 100 }));
    const summaries = service.listBudgetSummaries();
    const platformSummary = summaries.find((s) => s.budgetKey === "platform:USD");
    assert.ok(platformSummary);
    assert.equal(platformSummary.totalCostUsd, 100);
});
test("listBudgetSummaries picks latest period from most recent report", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput({
        submittedAt: "2026-04-01T00:00:00.000Z",
        periodStart: "2026-03-01T00:00:00.000Z",
        periodEnd: "2026-03-31T23:59:59.999Z",
    }));
    service.createReport(makeCreateInput({
        submittedAt: "2026-04-10T00:00:00.000Z",
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.999Z",
    }));
    const summaries = service.listBudgetSummaries();
    const [first] = summaries;
    assert.ok(first);
    assert.equal(first.periodStart, "2026-04-01T00:00:00.000Z");
    assert.equal(first.periodEnd, "2026-04-30T23:59:59.999Z");
});
test("listBudgetSummaries filters by tenantId", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput({ tenantId: "tenant_a" }));
    service.createReport(makeCreateInput({ tenantId: "tenant_b" }));
    const summariesA = service.listBudgetSummaries(50, "tenant_a");
    assert.equal(summariesA.length, 1);
    const [sumA] = summariesA;
    assert.ok(sumA);
    assert.equal(sumA.tenantId, "tenant_a");
    const summariesB = service.listBudgetSummaries(50, "tenant_b");
    assert.equal(summariesB.length, 1);
    const [sumB] = summariesB;
    assert.ok(sumB);
    assert.equal(sumB.tenantId, "tenant_b");
});
test("listBudgetSummaries respects limit", () => {
    const service = new CostReportService();
    for (let i = 0; i < 5; i++) {
        service.createReport(makeCreateInput({
            tenantId: `tenant_${i}`,
            totalCostUsd: 10,
            submittedAt: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
        }));
    }
    const summaries = service.listBudgetSummaries(3);
    assert.equal(summaries.length, 3);
});
test("listBudgetSummaries handles empty service", () => {
    const service = new CostReportService();
    const summaries = service.listBudgetSummaries();
    assert.deepEqual(summaries, []);
});
test("createReport stores multiple reports", () => {
    const service = new CostReportService();
    service.createReport(makeCreateInput({ totalCostUsd: 10 }));
    service.createReport(makeCreateInput({ totalCostUsd: 20 }));
    service.createReport(makeCreateInput({ totalCostUsd: 30 }));
    const reports = service.listReports();
    assert.equal(reports.length, 3);
    const totalCost = reports.reduce((sum, r) => sum + r.totalCostUsd, 0);
    assert.equal(totalCost, 60);
});
//# sourceMappingURL=cost-report-service.test.js.map