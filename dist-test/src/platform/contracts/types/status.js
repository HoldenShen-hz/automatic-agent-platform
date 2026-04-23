import { newId } from "./ids.js";
/**
 * Task lifecycle states.
 *
 * State transitions:
 * - queued → pending/in_progress/cancelled (task is picked up by scheduler)
 * - pending → in_progress/cancelled (execution starts or is superseded)
 * - in_progress → awaiting_decision/done/failed/cancelled (task completes or needs approval)
 * - awaiting_decision → in_progress/failed/cancelled (approval resolved)
 * - done/failed/cancelled are terminal states
 */
export const TASK_STATUSES = [
    "queued",
    "pending",
    "in_progress",
    "awaiting_decision",
    "done",
    "failed",
    "cancelled",
];
/**
 * Workflow lifecycle states.
 *
 * State transitions:
 * - running → paused/completed/failed/cancelling (workflow in progress)
 * - paused → resuming/failed/cancelled (waiting for resources or approval)
 * - resuming → running/failed/cancelled (resuming from pause)
 * - completed/failed/cancelled are terminal states
 * - cancelling → cancelled (graceful cancellation in progress)
 */
export const WORKFLOW_STATUSES = [
    "running",
    "paused",
    "resuming",
    "completed",
    "failed",
    "cancelling",
    "cancelled",
];
/**
 * Session lifecycle states.
 *
 * State transitions:
 * - open → streaming/awaiting_user/completed/failed/cancelled (session starts)
 * - streaming → awaiting_user/completed/failed/cancelled/open (live output streaming)
 * - awaiting_user → streaming/completed/failed/cancelled (waiting for user input)
 * - paused → streaming/completed/failed/cancelled (session paused)
 * - completed/failed/cancelled are terminal states
 */
export const SESSION_STATUSES = [
    "open",
    "streaming",
    "awaiting_user",
    "paused",
    "completed",
    "failed",
    "cancelled",
];
/**
 * Execution lifecycle states.
 *
 * State transitions:
 * - created → prechecking/cancelled/failed (execution initialized)
 * - prechecking → executing/blocked/cancelled/failed (validating resources)
 * - executing → blocked/succeeded/failed/cancelled (work being performed)
 * - blocked → prechecking/executing/cancelled/failed/superseded (waiting for approval)
 * - succeeded/failed/cancelled/superseded are terminal states
 */
export const EXECUTION_STATUSES = [
    "created",
    "prechecking",
    "executing",
    "blocked",
    "succeeded",
    "failed",
    "cancelled",
    "superseded",
];
/**
 * Approval lifecycle states.
 *
 * State transitions:
 * - requested → approved/rejected/expired/cancelled (waiting for human decision)
 * - approved/rejected/expired/cancelled are terminal states
 */
export const APPROVAL_STATUSES = [
    "requested",
    "approved",
    "rejected",
    "expired",
    "cancelled",
];
/**
 * Type guard to check if a session status is terminal (no further updates possible).
 * Terminal sessions cannot be reopened and a new session must be created for new work.
 */
export function isSessionTerminalStatus(status) {
    return status === "completed" || status === "failed" || status === "cancelled";
}
/**
 * Type guard to check if a string is a valid TaskStatus.
 * Useful for validating user input or external data.
 */
export function isTaskStatus(value) {
    return TASK_STATUSES.includes(value);
}
/**
 * Type guard to check if a string is a valid WorkflowStatus.
 * Useful for validating user input or external data.
 */
export function isWorkflowStatus(value) {
    return WORKFLOW_STATUSES.includes(value);
}
/**
 * Type guard to check if a string is a valid SessionStatus.
 * Useful for validating user input or external data.
 */
export function isSessionStatus(value) {
    return SESSION_STATUSES.includes(value);
}
/**
 * Creates a new recovery session for a task that needs to resume after a failure.
 *
 * When an execution fails but the task needs to retry, a new recovery session
 * is created to track the new attempt. The session inherits the channel and
 * external session ID from the original but starts fresh with "open" status.
 */
export function createRecoverySession(session, occurredAt) {
    return {
        id: newId("sess"),
        taskId: session.taskId,
        channel: session.channel,
        status: "open",
        externalSessionId: session.externalSessionId,
        createdAt: occurredAt,
        updatedAt: occurredAt,
    };
}
/**
 * Type guard to check if a string is a valid ExecutionStatus.
 * Useful for validating user input or external data.
 */
export function isExecutionStatus(value) {
    return EXECUTION_STATUSES.includes(value);
}
//# sourceMappingURL=status.js.map