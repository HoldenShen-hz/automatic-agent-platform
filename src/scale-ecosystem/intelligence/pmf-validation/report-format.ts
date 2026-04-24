import type { PmfValidationReport } from "./types.js";

/** Builds a Markdown-formatted PMF validation report for human review */
export function buildMarkdownReport(report: PmfValidationReport): string {
  const lines = [
    "# PMF Validation Report",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Profile: \`${report.profileName}\``,
    `- Verdict: \`${report.verdict}\``,
    `- Generated At: \`${report.generatedAt}\``,
    `- Window: \`${report.window.start}\` -> \`${report.window.end}\` (${report.window.days}d)`,
    `- Division Scope: \`${report.divisionId ?? "all"}\``,
    "",
    "## Summary",
    "",
    report.summary,
    "",
    "## Metrics",
    "",
    `- taskCount: ${report.metrics.taskCount}`,
    `- terminalTaskCount: ${report.metrics.terminalTaskCount}`,
    `- successfulTaskCount: ${report.metrics.successfulTaskCount}`,
    `- sessionCount: ${report.metrics.sessionCount}`,
    `- activationSessionCount: ${report.metrics.activationSessionCount}`,
    `- repeatedRootCount: ${report.metrics.repeatedRootCount}`,
    `- rootCount: ${report.metrics.rootCount}`,
    `- approvalCount: ${report.metrics.approvalCount}`,
    `- resolvedApprovalCount: ${report.metrics.resolvedApprovalCount}`,
    `- averageSuccessfulTaskCostUsd: ${report.metrics.averageSuccessfulTaskCostUsd ?? "n/a"}`,
    `- p95StepDurationMs: ${report.metrics.p95StepDurationMs ?? "n/a"}`,
    `- taskSuccessRatePct: ${report.metrics.taskSuccessRatePct ?? "n/a"}`,
    `- activationRatePct: ${report.metrics.activationRatePct ?? "n/a"}`,
    `- repeatUsageRatePct: ${report.metrics.repeatUsageRatePct ?? "n/a"}`,
    `- approvalResolutionRatePct: ${report.metrics.approvalResolutionRatePct ?? "n/a"}`,
    `- crossDivisionUsageRatePct: ${report.metrics.crossDivisionUsageRatePct ?? "n/a"}`,
    "",
    "## Checks",
    "",
    ...report.checks.map(
      (check) =>
        `- ${check.checkId}: ${check.status} (observed=${check.observed ?? "n/a"} ${check.unit}, threshold=${check.threshold ?? "n/a"} ${check.unit}) - ${check.detail}`,
    ),
  ];
  return lines.join("\n");
}
