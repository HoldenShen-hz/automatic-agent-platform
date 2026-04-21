/**
 * @fileoverview Session Lifecycle - Utilities for session state management.
 *
 * Provides type guards and factory functions for session and task lifecycle
 * management, particularly for recovery scenarios where sessions need to be
 * reopened or recreated after failures.
 *
 * @see Task and Workflow Contract: docs_zh/contracts/task_and_workflow_contract.md
 */
import { newId } from "../../contracts/types/ids.js";
/**
 * Type guard to check if a session status is terminal (no further updates possible).
 * Terminal sessions cannot be reopened and a new session must be created for new work.
 */
export function isSessionTerminalStatus(status) {
    return status === "completed" || status === "failed" || status === "cancelled";
}
/**
 * Type guard to check if a task status is active (may still receive updates).
 * Active tasks can still transition to new states.
 */
export function isTaskActiveStatus(status) {
    return status === "queued" || status === "pending" || status === "in_progress" || status === "awaiting_decision";
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
//# sourceMappingURL=session-lifecycle.js.map