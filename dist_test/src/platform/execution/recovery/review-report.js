/**
 * ReviewReport - Agent Code Review Output
 *
 * Structured review output that captures issues found during code review.
 * Reviewer agent produces this after examining the PatchBundle.
 */
export function createReviewReport(input) {
    const { reportId, taskId, bundleId, reviewerAgentId, verdict, issues = [], comments = '', durationMs = 0 } = input;
    return {
        reportId,
        taskId,
        bundleId,
        reviewerAgentId,
        verdict,
        issues,
        comments,
        createdAt: new Date().toISOString(),
        durationMs,
    };
}
export function hasBlockingIssues(report) {
    return report.issues.some((issue) => issue.blocking);
}
export function getBlockingIssueCount(report) {
    return report.issues.filter((issue) => issue.blocking).length;
}
export function getCriticalIssueCount(report) {
    return report.issues.filter((issue) => issue.severity === 'critical').length;
}
//# sourceMappingURL=review-report.js.map