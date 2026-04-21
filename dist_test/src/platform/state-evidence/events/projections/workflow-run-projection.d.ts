/**
 * @fileoverview Workflow Run Projection
 *
 * Tracks workflow run state and timeline from workflow lifecycle events.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 *
 * @see ProjectionRebuildService: ../../projections/projection-rebuild-service.ts
 * @see event-registry: ../event-registry.ts
 */
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
/**
 * Workflow Run Projection State
 *
 * Tracks the complete lifecycle of a workflow run including:
 * - Run metadata (workflowId, taskId, status)
 * - Timeline of events with timestamps
 * - Step completion tracking
 * - Error and failure information
 */
export interface WorkflowRunState {
    /** Unique identifier for this workflow run */
    workflowId: string | null;
    /** Associated task ID */
    taskId: string | null;
    /** Current status of the workflow run */
    status: WorkflowRunStatus;
    /** Timeline of events in order */
    timeline: WorkflowTimelineEntry[];
    /** Completed step IDs */
    completedSteps: string[];
    /** Failed step IDs */
    failedSteps: string[];
    /** Count of all events processed */
    eventCount: number;
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
    /** Error information if workflow failed */
    error: WorkflowError | null;
    /** Division results (parallel/branch outcomes) */
    divisions: DivisionResult[];
    /** Terminal timestamp if workflow completed */
    completedAt: string | null;
    /** Failed timestamp if workflow failed */
    failedAt: string | null;
}
export type WorkflowRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "paused";
/**
 * Timeline entry for workflow events
 */
export interface WorkflowTimelineEntry {
    eventId: string;
    eventType: string;
    timestamp: string;
    stepId: string | null;
    status: string | null;
}
/**
 * Error information for failed workflows
 */
export interface WorkflowError {
    code: string | null;
    message: string | null;
    failedStepId: string | null;
    failedAt: string | null;
}
/**
 * Division/branch result
 */
export interface DivisionResult {
    divisionId: string;
    status: "completed" | "failed";
    timestamp: string;
    reasonCode: string | null;
}
/**
 * Creates a new empty WorkflowRunState
 */
export declare function createEmptyWorkflowRunState(): WorkflowRunState;
/**
 * Workflow Run Projection Handler
 *
 * Implements ProjectionHandler interface for workflow run state management.
 * Handles events:
 * - workflow:step_completed - Step completion tracking
 * - division:completed - Division/branch completion
 * - division:failed - Division/branch failure
 * - subtask:completed - Subtask completion (maps to step)
 * - subtask:failed - Subtask failure (maps to step)
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export declare const workflowRunProjectionHandler: ProjectionHandler;
/**
 * Creates a WorkflowRunProjection instance for use with ProjectionRebuildService
 */
export declare function createWorkflowRunProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
