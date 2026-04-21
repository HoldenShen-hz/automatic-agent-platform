/**
 * ValidationReport - Automated Verification Results
 *
 * Structured output from automated verification checks (typecheck, lint, test, etc.)
 * produced during the validate stage.
 */
export type ValidationDecision = 'pass' | 'fail' | 'warning';
export interface ValidationReport {
    /** Unique report identifier */
    reportId: string;
    /** Associated task card ID */
    taskId: string;
    /** Associated patch bundle ID */
    bundleId: string;
    /** Overall decision */
    decision: ValidationDecision;
    /** Individual check results */
    checks: readonly CheckResult[];
    /** Summary */
    summary: string;
    /** Timestamp */
    createdAt: string;
}
export interface CheckResult {
    /** Check identifier */
    checkId: string;
    /** Check name */
    name: string;
    /** Check type */
    type: 'typecheck' | 'lint' | 'test' | 'security' | 'review' | 'custom';
    /** Whether check passed */
    passed: boolean;
    /** Error count (0 if passed) */
    errorCount: number;
    /** Warning count */
    warningCount: number;
    /** Detailed results/errors */
    errors: readonly CheckError[];
    /** Duration in milliseconds */
    durationMs: number;
    /** Whether this is a required check */
    required: boolean;
}
export interface CheckError {
    /** Error message */
    message: string;
    /** File path (if applicable) */
    filePath?: string;
    /** Line number (if applicable) */
    line?: number;
    /** Column number (if applicable) */
    column?: number;
    /** Error code/identifier */
    code?: string;
    /** Severity */
    severity: 'error' | 'warning';
}
export declare function createValidationReport(input: {
    reportId: string;
    taskId: string;
    bundleId: string;
    checks: readonly CheckResult[];
    summary?: string;
}): ValidationReport;
export declare function hasFailedRequiredChecks(report: ValidationReport): boolean;
export declare function getFailedCheckCount(report: ValidationReport): number;
