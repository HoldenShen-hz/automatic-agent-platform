/**
 * ReviewReport - Agent Code Review Output
 *
 * Structured review output that captures issues found during code review.
 * Reviewer agent produces this after examining the PatchBundle.
 */

export type ReviewVerdict = 'approve' | 'request_changes' | 'reject';

export type ReviewIssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export interface ReviewReport {
  /** Unique report identifier */
  reportId: string;

  /** Associated task card ID */
  taskId: string;

  /** Associated patch bundle ID */
  bundleId: string;

  /** Reviewer agent ID */
  reviewerAgentId: string;

  /** Review verdict */
  verdict: ReviewVerdict;

  /** Issues found during review */
  issues: readonly ReviewIssue[];

  /** Overall comments */
  comments: string;

  /** Timestamp */
  createdAt: string;

  /** Review duration in milliseconds */
  durationMs: number;
}

export interface ReviewIssue {
  /** Issue identifier */
  id: string;

  /** Issue title */
  title: string;

  /** Detailed description */
  description: string;

  /** Severity level */
  severity: ReviewIssueSeverity;

  /** Affected file path */
  filePath?: string;

  /** Line numbers affected */
  lineNumbers?: readonly number[];

  /** Issue category */
  category: 'correctness' | 'security' | 'performance' | 'maintainability' | 'style' | 'other';

  /** Whether this issue blocks approval */
  blocking: boolean;

  /** Suggested fix (if any) */
  suggestedFix?: string;
}

export function createReviewReport(input: {
  reportId: string;
  taskId: string;
  bundleId: string;
  reviewerAgentId: string;
  verdict: ReviewVerdict;
  issues?: readonly ReviewIssue[];
  comments?: string;
  durationMs?: number;
}): ReviewReport {
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

export function hasBlockingIssues(report: ReviewReport): boolean {
  return report.issues.some((issue) => issue.blocking);
}

export function getBlockingIssueCount(report: ReviewReport): number {
  return report.issues.filter((issue) => issue.blocking).length;
}

export function getCriticalIssueCount(report: ReviewReport): number {
  return report.issues.filter((issue) => issue.severity === 'critical').length;
}
