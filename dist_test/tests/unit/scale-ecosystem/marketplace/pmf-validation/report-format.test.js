import assert from "node:assert/strict";
import test from "node:test";
import { buildMarkdownReport } from "../../../../../src/scale-ecosystem/marketplace/pmf-validation/report-format.js";
test("buildMarkdownReport generates valid markdown", () => {
    const report = {
        reportId: "report_123",
        profileName: "phase3_default",
        verdict: "pass",
        generatedAt: "2026-04-14T00:00:00.000Z",
        window: { start: "2026-04-01T00:00:00.000Z", end: "2026-04-14T00:00:00.000Z", days: 14 },
        divisionId: null,
        summary: "All PMF checks passed",
        metrics: {
            taskCount: 100,
            terminalTaskCount: 90,
            successfulTaskCount: 85,
            sessionCount: 95,
            activationSessionCount: 80,
            repeatedRootCount: 20,
            rootCount: 50,
            approvalCount: 10,
            resolvedApprovalCount: 8,
            averageSuccessfulTaskCostUsd: 0.05,
            p95StepDurationMs: 5000,
            divisionCount: 5,
            crossDivisionTaskCount: 15,
            taskSuccessRatePct: 94.4,
            activationRatePct: 84.2,
            repeatUsageRatePct: 40,
            approvalResolutionRatePct: 80,
            crossDivisionUsageRatePct: 15,
        },
        checks: [
            {
                checkId: "sample_size",
                status: "pass",
                detail: "Sample size is adequate",
                observed: 100,
                threshold: 50,
                unit: "count",
            },
            {
                checkId: "task_success_rate",
                status: "pass",
                detail: "Task success rate is above threshold",
                observed: 94.4,
                threshold: 80,
                unit: "pct",
            },
        ],
        runtimeSummary: {
            averageLatencyMs: 100,
            peakLatencyMs: 500,
            totalRequests: 100,
            errorCount: 0,
        },
    };
    const markdown = buildMarkdownReport(report);
    assert.ok(markdown.includes("# PMF Validation Report"));
    assert.ok(markdown.includes("report_123"));
    assert.ok(markdown.includes("pass"));
    assert.ok(markdown.includes("14d"));
});
test("buildMarkdownReport handles null metrics", () => {
    const report = {
        reportId: "report_456",
        profileName: "test_profile",
        verdict: "warn",
        generatedAt: "2026-04-14T00:00:00.000Z",
        window: { start: "2026-04-01T00:00:00.000Z", end: "2026-04-14T00:00:00.000Z", days: 7 },
        divisionId: "division_abc",
        summary: "Some metrics unavailable",
        metrics: {
            taskCount: 10,
            terminalTaskCount: 5,
            successfulTaskCount: 3,
            sessionCount: 8,
            activationSessionCount: 3,
            repeatedRootCount: 1,
            rootCount: 5,
            approvalCount: 0,
            resolvedApprovalCount: 0,
            averageSuccessfulTaskCostUsd: null,
            p95StepDurationMs: null,
            divisionCount: 1,
            crossDivisionTaskCount: 0,
            taskSuccessRatePct: null,
            activationRatePct: null,
            repeatUsageRatePct: null,
            approvalResolutionRatePct: null,
            crossDivisionUsageRatePct: null,
        },
        checks: [
            {
                checkId: "sample_size",
                status: "fail",
                detail: "Insufficient sample size",
                observed: 10,
                threshold: 50,
                unit: "count",
            },
        ],
        runtimeSummary: {
            averageLatencyMs: 0,
            peakLatencyMs: 0,
            totalRequests: 0,
            errorCount: 0,
        },
    };
    const markdown = buildMarkdownReport(report);
    assert.ok(markdown.includes("report_456"));
    assert.ok(markdown.includes("warn"));
    assert.ok(markdown.includes("n/a")); // null metrics should show n/a
    assert.ok(markdown.includes("division_abc"));
});
test("buildMarkdownReport includes check details in output", () => {
    const report = {
        reportId: "report_checks",
        profileName: "checks_test",
        verdict: "pass",
        generatedAt: "2026-04-14T00:00:00.000Z",
        window: { start: "2026-04-01T00:00:00.000Z", end: "2026-04-14T00:00:00.000Z", days: 14 },
        divisionId: null,
        summary: "All checks passed",
        metrics: {
            taskCount: 100,
            terminalTaskCount: 90,
            successfulTaskCount: 85,
            sessionCount: 95,
            activationSessionCount: 80,
            repeatedRootCount: 20,
            rootCount: 50,
            approvalCount: 10,
            resolvedApprovalCount: 8,
            averageSuccessfulTaskCostUsd: 0.05,
            p95StepDurationMs: 5000,
            divisionCount: 5,
            crossDivisionTaskCount: 15,
            taskSuccessRatePct: 94.4,
            activationRatePct: 84.2,
            repeatUsageRatePct: 40,
            approvalResolutionRatePct: 80,
            crossDivisionUsageRatePct: 15,
        },
        checks: [
            {
                checkId: "sample_size",
                status: "pass",
                detail: "Sample size is adequate",
                observed: 100,
                threshold: 50,
                unit: "count",
            },
            {
                checkId: "task_success_rate",
                status: "pass",
                detail: "Task success rate is above threshold",
                observed: 94.4,
                threshold: 80,
                unit: "pct",
            },
        ],
        runtimeSummary: {
            averageLatencyMs: 100,
            peakLatencyMs: 500,
            totalRequests: 100,
            errorCount: 0,
        },
    };
    const markdown = buildMarkdownReport(report);
    assert.ok(markdown.includes("sample_size"));
    assert.ok(markdown.includes("task_success_rate"));
    assert.ok(markdown.includes("94.4"));
});
//# sourceMappingURL=report-format.test.js.map