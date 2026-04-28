/**
 * Workflow Step Retry Policy
 *
 * Determines retry behavior for failed workflow steps based on error classification.
 * Classifies failures as transient, semantic, permission, destructive, or non-retryable
 * and computes appropriate retry delays and actions.
 */

/** Classification of workflow step failure causes */
export type WorkflowStepFailureClass =
  | "transient"
  | "semantic"
  | "permission"
  | "destructive"
  | "non_retryable";

/** Action to take after a step failure */
export type WorkflowStepFailureAction = "retry" | "fail" | "escalate";

/** Retry backoff strategy */
export type WorkflowStepRetryBackoff = "none" | "fixed" | "exponential";

/**
 * Decision on whether and how to retry a failed workflow step.
 */
export interface WorkflowStepRetryDecision {
  errorCode: string;
  failureClass: WorkflowStepFailureClass;
  action: WorkflowStepFailureAction;
  retryable: boolean;
  backoff: WorkflowStepRetryBackoff;
  retryDelayMs: number;
}

/** Error codes classified as transient failures that may resolve on retry */
const TRANSIENT_ERROR_CODES = new Set<string>([
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
const SEMANTIC_ERROR_CODES = new Set<string>([
  "validation.schema_mismatch",
  "runtime.context_overflow",
]);

/** Error codes classified as permission failures requiring authorization */
const PERMISSION_ERROR_CODES = new Set<string>([
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
const DESTRUCTIVE_ERROR_CODES = new Set<string>([
  "policy.approval_required",
]);

/**
 * Classifies a failure based on its error code.
 */
function classifyFailure(errorCode: string): WorkflowStepFailureClass {
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
function computeRetryDelayMs(
  failureClass: WorkflowStepFailureClass,
  attempt: number,
): number {
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
export function decideWorkflowStepRetry(input: {
  errorCode: string;
  attempt: number;
  maxAttempts: number;
}): WorkflowStepRetryDecision {
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
