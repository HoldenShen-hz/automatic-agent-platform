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
export declare const TASK_STATUSES: readonly ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
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
export declare const WORKFLOW_STATUSES: readonly ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
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
export declare const SESSION_STATUSES: readonly ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];
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
export declare const EXECUTION_STATUSES: readonly ["created", "prechecking", "executing", "blocked", "succeeded", "failed", "cancelled", "superseded"];
/**
 * Approval lifecycle states.
 *
 * State transitions:
 * - requested → approved/rejected/expired/cancelled (waiting for human decision)
 * - approved/rejected/expired/cancelled are terminal states
 */
export declare const APPROVAL_STATUSES: readonly ["requested", "approved", "rejected", "expired", "cancelled"];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
/**
 * Task terminal states - states where no further processing occurs.
 * Used to determine when a task is permanently done (either successfully or not).
 */
export type TaskTerminalStatus = Extract<TaskStatus, "done" | "failed" | "cancelled">;
/**
 * Type guard to check if a string is a valid TaskStatus.
 * Useful for validating user input or external data.
 */
export declare function isTaskStatus(value: string): value is TaskStatus;
/**
 * Type guard to check if a string is a valid WorkflowStatus.
 * Useful for validating user input or external data.
 */
export declare function isWorkflowStatus(value: string): value is WorkflowStatus;
/**
 * Type guard to check if a string is a valid SessionStatus.
 * Useful for validating user input or external data.
 */
export declare function isSessionStatus(value: string): value is SessionStatus;
/**
 * Type guard to check if a string is a valid ExecutionStatus.
 * Useful for validating user input or external data.
 */
export declare function isExecutionStatus(value: string): value is ExecutionStatus;
