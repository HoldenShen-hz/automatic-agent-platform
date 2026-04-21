/**
 * Workflow Step Retry Policy
 *
 * Determines retry behavior for failed workflow steps based on error classification.
 * Classifies failures as transient, semantic, permission, destructive, or non-retryable
 * and computes appropriate retry delays and actions.
 */
/** Classification of workflow step failure causes */
export type WorkflowStepFailureClass = "transient" | "semantic" | "permission" | "destructive" | "non_retryable";
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
/**
 * Determines retry policy for a failed workflow step.
 *
 * Analyzes the error code to classify the failure and decides:
 * - Whether to retry, fail, or escalate
 * - What backoff strategy to use
 * - How long to wait before retrying
 */
export declare function decideWorkflowStepRetry(input: {
    errorCode: string;
    attempt: number;
    maxAttempts: number;
}): WorkflowStepRetryDecision;
