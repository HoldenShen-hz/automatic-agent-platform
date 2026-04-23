import assert from "node:assert/strict";
import test from "node:test";
import { createReviewReport, hasBlockingIssues, getBlockingIssueCount, getCriticalIssueCount, } from "../../../../../src/platform/execution/recovery/review-report.js";
test("createReviewReport creates report with defaults", () => {
    const report = createReviewReport({
        reportId: "review_1",
        taskId: "task_1",
        bundleId: "bundle_1",
        reviewerAgentId: "agent_1",
        verdict: "approve",
    });
    assert.equal(report.reportId, "review_1");
    assert.equal(report.taskId, "task_1");
    assert.equal(report.bundleId, "bundle_1");
    assert.equal(report.reviewerAgentId, "agent_1");
    assert.equal(report.verdict, "approve");
    assert.deepEqual(report.issues, []);
    assert.equal(report.comments, "");
    assert.equal(report.durationMs, 0);
    assert.ok(report.createdAt);
});
test("createReviewReport creates report with custom values", () => {
    const issues = [
        {
            id: "issue_1",
            title: "Bug",
            description: "Found a bug",
            severity: "critical",
            category: "correctness",
            blocking: true,
        },
    ];
    const report = createReviewReport({
        reportId: "review_2",
        taskId: "task_2",
        bundleId: "bundle_2",
        reviewerAgentId: "agent_2",
        verdict: "request_changes",
        issues,
        comments: "Please fix",
        durationMs: 5000,
    });
    assert.equal(report.issues.length, 1);
    assert.equal(report.comments, "Please fix");
    assert.equal(report.durationMs, 5000);
});
test("hasBlockingIssues returns false when no issues", () => {
    const report = createReviewReport({
        reportId: "review_1",
        taskId: "task_1",
        bundleId: "bundle_1",
        reviewerAgentId: "agent_1",
        verdict: "approve",
    });
    assert.equal(hasBlockingIssues(report), false);
});
test("hasBlockingIssues returns false when no blocking issues", () => {
    const issues = [
        {
            id: "issue_1",
            title: "Suggestion",
            description: "Consider this",
            severity: "minor",
            category: "style",
            blocking: false,
        },
    ];
    const report = createReviewReport({
        reportId: "review_1",
        taskId: "task_1",
        bundleId: "bundle_1",
        reviewerAgentId: "agent_1",
        verdict: "approve",
        issues,
    });
    assert.equal(hasBlockingIssues(report), false);
});
test("hasBlockingIssues returns true when has blocking issue", () => {
    const issues = [
        {
            id: "issue_1",
            title: "Critical bug",
            description: "Must fix",
            severity: "critical",
            category: "correctness",
            blocking: true,
        },
    ];
    const report = createReviewReport({
        reportId: "review_1",
        taskId: "task_1",
        bundleId: "bundle_1",
        reviewerAgentId: "agent_1",
        verdict: "reject",
        issues,
    });
    assert.equal(hasBlockingIssues(report), true);
});
test("getBlockingIssueCount returns zero when no issues", () => {
    const report = createReviewReport({
        reportId: "review_1",
        taskId: "task_1",
        bundleId: "bundle_1",
        reviewerAgentId: "agent_1",
        verdict: "approve",
    });
    assert.equal(getBlockingIssueCount(report), 0);
});
test("getBlockingIssueCount returns correct count", () => {
    const issues = [
        {
            id: "issue_1",
            title: "Bug 1",
            description: "Bug 1",
            severity: "critical",
            category: "correctness",
            blocking: true,
        },
        {
            id: "issue_2",
            title: "Bug 2",
            description: "Bug 2",
            severity: "major",
            category: "correctness",
            blocking: false,
        },
        {
            id: "issue_3",
            title: "Bug 3",
            description: "Bug 3",
            severity: "major",
            category: "security",
            blocking: true,
        },
    ];
    const report = createReviewReport({
        reportId: "review_1",
        taskId: "task_1",
        bundleId: "bundle_1",
        reviewerAgentId: "agent_1",
        verdict: "request_changes",
        issues,
    });
    assert.equal(getBlockingIssueCount(report), 2);
});
test("getCriticalIssueCount returns zero when no issues", () => {
    const report = createReviewReport({
        reportId: "review_1",
        taskId: "task_1",
        bundleId: "bundle_1",
        reviewerAgentId: "agent_1",
        verdict: "approve",
    });
    assert.equal(getCriticalIssueCount(report), 0);
});
test("getCriticalIssueCount returns correct count", () => {
    const issues = [
        {
            id: "issue_1",
            title: "Bug 1",
            description: "Bug 1",
            severity: "critical",
            category: "correctness",
            blocking: true,
        },
        {
            id: "issue_2",
            title: "Bug 2",
            description: "Bug 2",
            severity: "critical",
            category: "security",
            blocking: true,
        },
        {
            id: "issue_3",
            title: "Bug 3",
            description: "Bug 3",
            severity: "minor",
            category: "style",
            blocking: false,
        },
    ];
    const report = createReviewReport({
        reportId: "review_1",
        taskId: "task_1",
        bundleId: "bundle_1",
        reviewerAgentId: "agent_1",
        verdict: "request_changes",
        issues,
    });
    assert.equal(getCriticalIssueCount(report), 2);
});
test("ReviewVerdict type accepts all valid values", () => {
    const verdicts = ["approve", "request_changes", "reject"];
    assert.equal(verdicts.length, 3);
});
test("ReviewIssueSeverity type accepts all valid values", () => {
    const severities = ["critical", "major", "minor", "suggestion"];
    assert.equal(severities.length, 4);
});
test("ReviewIssue category accepts all valid values", () => {
    const issue = {
        id: "test",
        title: "Test",
        description: "Test",
        severity: "minor",
        category: "correctness",
        blocking: false,
    };
    assert.equal(issue.category, "correctness");
    const securityIssue = {
        ...issue,
        category: "security",
    };
    assert.equal(securityIssue.category, "security");
});
//# sourceMappingURL=review-report.test.js.map