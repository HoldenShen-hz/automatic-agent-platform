/**
 * @fileoverview Session Lifecycle - Utilities for session state management.
 *
 * Provides type guards and factory functions for session and task lifecycle
 * management, particularly for recovery scenarios where sessions need to be
 * reopened or recreated after failures.
 *
 * @see Task and Workflow Contract: docs_zh/contracts/task_and_workflow_contract.md
 */
import type { SessionRecord, TaskRecord } from "../../contracts/types/domain.js";
import type { SessionStatus, TaskStatus } from "../../contracts/types/status.js";
/**
 * Session terminal statuses - states where no further interaction is expected.
 */
export type SessionTerminalStatus = Extract<SessionStatus, "completed" | "failed" | "cancelled">;
/**
 * Task active statuses - states where the task may still receive updates.
 */
export type TaskActiveStatus = Extract<TaskStatus, "queued" | "pending" | "in_progress" | "awaiting_decision">;
/**
 * Type guard to check if a session status is terminal (no further updates possible).
 * Terminal sessions cannot be reopened and a new session must be created for new work.
 */
export declare function isSessionTerminalStatus(status: SessionStatus): status is SessionTerminalStatus;
/**
 * Type guard to check if a task status is active (may still receive updates).
 * Active tasks can still transition to new states.
 */
export declare function isTaskActiveStatus(status: TaskRecord["status"]): status is TaskActiveStatus;
/**
 * Creates a new recovery session for a task that needs to resume after a failure.
 *
 * When an execution fails but the task needs to retry, a new recovery session
 * is created to track the new attempt. The session inherits the channel and
 * external session ID from the original but starts fresh with "open" status.
 */
export declare function createRecoverySession(session: SessionRecord, occurredAt: string): SessionRecord;
