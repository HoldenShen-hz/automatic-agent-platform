/**
 * Workflow Step Retry Policy
 *
 * Determines retry behavior for failed workflow steps based on error classification.
 * Classifies failures as transient, semantic, permission, destructive, or non-retryable
 * and computes appropriate retry delays and actions.
 */
/** Error codes classified as transient failures that may resolve on retry */
const TRANSIENT_ERROR_CODES = new Set([
    "provider.rate_limited",
    "provider.temporary_unavailable",
    "provider.compaction_unavailable",
    "tool.temporary_io_error",
    "tool.file_lock_conflict",
    "tool.file_lock_timeout",
    "storage.write_failed",
    "workflow.dependency_unavailable",
    "runtime.recovery_required",
    "runtime.stale_lock_detected",
    "external.service_unavailable",
]);
/** Error codes classified as semantic failures requiring content changes */
const SEMANTIC_ERROR_CODES = new Set([
    "validation.schema_mismatch",
    "runtime.context_overflow",
]);
/** Error codes classified as permission failures requiring authorization */
const PERMISSION_ERROR_CODES = new Set([
    "auth.permission_denied",
    "policy.action_denied",
    "validation.invalid_input",
    "budget.budget_exceeded",
    "budget.quota_exceeded",
    "sandbox.path_denied",
    "sandbox.network_denied",
    "sandbox.exec_denied",
    "sandbox.isolation_broken",
    "tenant.boundary_violation",
    "tenant.workspace_mismatch",
]);
/** Error codes classified as destructive requiring human intervention */
const DESTRUCTIVE_ERROR_CODES = new Set([
    "policy.approval_required",
]);
/**
 * Classifies a failure based on its error code.
 */
function classifyFailure(errorCode) {
    if (DESTRUCTIVE_ERROR_CODES.has(errorCode)) {
        return "destructive";
    }
    if (PERMISSION_ERROR_CODES.has(errorCode)) {
        return "permission";
    }
    if (SEMANTIC_ERROR_CODES.has(errorCode)) {
        return "semantic";
    }
    if (TRANSIENT_ERROR_CODES.has(errorCode)) {
        return "transient";
    }
    return "non_retryable";
}
/**
 * Computes the retry delay based on failure class and attempt number.
 */
function computeRetryDelayMs(failureClass, attempt) {
    switch (failureClass) {
        case "transient":
            return Math.min(10_000, 500 * 2 ** Math.max(0, attempt - 1));
        case "semantic":
            return 0;
        default:
            return 0;
    }
}
/**
 * Determines retry policy for a failed workflow step.
 *
 * Analyzes the error code to classify the failure and decides:
 * - Whether to retry, fail, or escalate
 * - What backoff strategy to use
 * - How long to wait before retrying
 */
export function decideWorkflowStepRetry(input) {
    const failureClass = classifyFailure(input.errorCode);
    const canRetry = input.attempt < input.maxAttempts;
    if (failureClass === "destructive") {
        return {
            errorCode: input.errorCode,
            failureClass,
            action: "escalate",
            retryable: false,
            backoff: "none",
            retryDelayMs: 0,
        };
    }
    if ((failureClass === "transient" || failureClass === "semantic") && canRetry) {
        return {
            errorCode: input.errorCode,
            failureClass,
            action: "retry",
            retryable: true,
            backoff: failureClass === "transient" ? "exponential" : "fixed",
            retryDelayMs: computeRetryDelayMs(failureClass, input.attempt),
        };
    }
    return {
        errorCode: input.errorCode,
        failureClass,
        action: "fail",
        retryable: false,
        backoff: "none",
        retryDelayMs: 0,
    };
}
//# sourceMappingURL=workflow-step-retry-policy.js.map