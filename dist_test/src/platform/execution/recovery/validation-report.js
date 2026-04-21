/**
 * ValidationReport - Automated Verification Results
 *
 * Structured output from automated verification checks (typecheck, lint, test, etc.)
 * produced during the validate stage.
 */
export function createValidationReport(input) {
    const { reportId, taskId, bundleId, checks, summary = '' } = input;
    const failedRequired = checks.filter((c) => !c.passed && c.required);
    const decision = failedRequired.length > 0 ? 'fail'
        : checks.some((c) => !c.passed) ? 'fail'
            : checks.some((c) => c.warningCount > 0) ? 'warning'
                : 'pass';
    return {
        reportId,
        taskId,
        bundleId,
        decision,
        checks,
        summary,
        createdAt: new Date().toISOString(),
    };
}
export function hasFailedRequiredChecks(report) {
    return report.checks.some((check) => !check.passed && check.required);
}
export function getFailedCheckCount(report) {
    return report.checks.filter((check) => !check.passed).length;
}
//# sourceMappingURL=validation-report.js.map