import assert from "node:assert/strict";
import test from "node:test";
import { buildMarkdownReport } from "../../../../src/scale-ecosystem/marketplace/pmf-validation/report-format.js";
test("buildMarkdownReport generates header section", () => {
    const report = createMockPmfReport({
        reportId: "rpt_001",
        profileName: "test_profile",
        verdict: "pass",
    });
    const output = buildMarkdownReport(report);
    assert.ok(output.includes("# PMF Validation Report"));
    assert.ok(output.includes("Report ID: `rpt_001`"));
    assert.ok(output.includes("Profile: `test_profile`"));
    assert.ok(output.includes("Verdict: `pass`"));
});
test("buildMarkdownReport includes window information", () => {
    const report = createMockPmfReport({
        window: { start: "2026-03-01", end: "2026-03-31", days: 30 },
    });
    const output = buildMarkdownReport(report);
    assert.ok(output.includes("Window: `2026-03-01` -> `2026-03-31` (30d)"));
});
test("buildMarkdownReport shows division scope", () => {
    const report1 = createMockPmfReport({ divisionId: "div_123" });
    assert.ok(buildMarkdownReport(report1).includes("Division Scope: `div_123`"));
    const report2 = createMockPmfReport({ divisionId: null });
    assert.ok(buildMarkdownReport(report2).includes("Division Scope: `all`"));
});
test("buildMarkdownReport includes summary", () => {
    const report = createMockPmfReport({ summary: "All metrics within threshold" });
    const output = buildMarkdownReport(report);
    assert.ok(output.includes("## Summary"));
    assert.ok(output.includes("All metrics within threshold"));
});
test("buildMarkdownReport renders all required metrics", () => {
    const report = createMockPmfReport({
        metrics: {
            taskCount: 100,
            terminalTaskCount: 95,
            successfulTaskCount: 90,
            activationSessionCount: 40,
            sessionCount: 50,
            repeatedRootCount: 10,
            rootCount: 30,
            approvalCount: 5,
            resolvedApprovalCount: 4,
            averageSuccessfulTaskCostUsd: 0.05,
            p95StepDurationMs: 5000,
            divisionCount: 3,
            crossDivisionTaskCount: 15,
            taskSuccessRatePct: 90,
            activationRatePct: 80,
            repeatUsageRatePct: 33,
            approvalResolutionRatePct: 80,
            crossDivisionUsageRatePct: 15,
        },
    });
    const output = buildMarkdownReport(report);
    assert.ok(output.includes("taskCount: 100"));
    assert.ok(output.includes("terminalTaskCount: 95"));
    assert.ok(output.includes("successfulTaskCount: 90"));
    assert.ok(output.includes("sessionCount: 50"));
    assert.ok(output.includes("averageSuccessfulTaskCostUsd: 0.05"));
    assert.ok(output.includes("p95StepDurationMs: 5000"));
});
test("buildMarkdownReport handles null optional metrics as n/a", () => {
    const report = createMockPmfReport({
        metrics: {
            taskCount: 100,
            terminalTaskCount: 95,
            successfulTaskCount: 90,
            activationSessionCount: 40,
            sessionCount: 50,
            repeatedRootCount: 10,
            rootCount: 30,
            approvalCount: 5,
            resolvedApprovalCount: 4,
            averageSuccessfulTaskCostUsd: null,
            p95StepDurationMs: null,
            divisionCount: 0,
            crossDivisionTaskCount: 0,
            taskSuccessRatePct: null,
            activationRatePct: null,
            repeatUsageRatePct: null,
            approvalResolutionRatePct: null,
            crossDivisionUsageRatePct: null,
        },
    });
    const output = buildMarkdownReport(report);
    assert.ok(output.includes("averageSuccessfulTaskCostUsd: n/a"));
    assert.ok(output.includes("p95StepDurationMs: n/a"));
});
test("buildMarkdownReport renders checks section", () => {
    const report = createMockPmfReport({
        checks: [
            {
                checkId: "task_success_rate",
                status: "pass",
                detail: "Above threshold",
                observed: 85,
                threshold: 70,
                unit: "pct",
            },
            {
                checkId: "activation_rate",
                status: "fail",
                detail: "Below threshold",
                observed: 55,
                threshold: 60,
                unit: "pct",
            },
        ],
    });
    const output = buildMarkdownReport(report);
    assert.ok(output.includes("## Checks"));
    assert.ok(output.includes("task_success_rate: pass"));
    assert.ok(output.includes("activation_rate: fail"));
    assert.ok(output.includes("observed=85"));
    assert.ok(output.includes("threshold=70"));
});
test("buildMarkdownReport handles checks with null observed/threshold", () => {
    const report = createMockPmfReport({
        checks: [
            {
                checkId: "sample_size",
                status: "warn",
                detail: "Insufficient data",
                observed: null,
                threshold: null,
                unit: "count",
            },
        ],
    });
    const output = buildMarkdownReport(report);
    assert.ok(output.includes("observed=n/a"));
    assert.ok(output.includes("threshold=n/a"));
});
function createMockPmfReport(overrides) {
    return {
        reportId: "test_report",
        profileName: "default",
        verdict: "pass",
        generatedAt: "2026-04-14T00:00:00.000Z",
        window: { start: "2026-04-01", end: "2026-04-14", days: 13 },
        divisionId: null,
        summary: "Test summary",
        metrics: {
            taskCount: 0,
            terminalTaskCount: 0,
            successfulTaskCount: 0,
            activationSessionCount: 0,
            sessionCount: 0,
            repeatedRootCount: 0,
            rootCount: 0,
            approvalCount: 0,
            resolvedApprovalCount: 0,
            averageSuccessfulTaskCostUsd: null,
            p95StepDurationMs: null,
            divisionCount: 0,
            crossDivisionTaskCount: 0,
            taskSuccessRatePct: null,
            activationRatePct: null,
            repeatUsageRatePct: null,
            approvalResolutionRatePct: null,
            crossDivisionUsageRatePct: null,
            ...(overrides.metrics || {}),
        },
        checks: overrides.checks || [],
        runtimeSummary: { lines: [], total: 0, filtered: 0 },
        ...overrides,
    };
}
//# sourceMappingURL=pmf-validation-report-format.test.js.map