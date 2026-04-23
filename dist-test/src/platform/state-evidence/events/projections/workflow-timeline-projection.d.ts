/**
 * @fileoverview Workflow Timeline Projection
 *
 * Tracks workflow run timeline as an ordered sequence of events.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Complete timeline of workflow events
 *
 * §28 architecture: workflow_timeline_projection
 *
 * This projection differs from workflow_run_projection by focusing
 * on the chronological timeline of ALL events in a workflow,
 * rather than the aggregated state.
 */
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
/**
 * Workflow Timeline Projection State
 *
 * Tracks the complete chronological timeline of a workflow including:
 * - All events in order
 * - Step transitions
 * - Division/branch outcomes
 * - Decision points
 * - Subtask outcomes
 */
export interface WorkflowTimelineState {
    /** Workflow ID */
    workflowId: string | null;
    /** Associated task ID */
    taskId: string | null;
    /** Associated execution ID */
    executionId: string | null;
    /** Current status derived from timeline */
    status: WorkflowTimelineStatus;
    /** All events in chronological order */
    events: WorkflowTimelineEventEntry[];
    /** Step completion map (stepId -> completedAt) */
    completedSteps: Record<string, string>;
    /** Failed steps */
    failedSteps: Record<string, string>;
    /** Division outcomes (divisionId -> outcome) */
    divisionOutcomes: Record<string, DivisionOutcomeEntry>;
    /** Decision points */
    decisionPoints: DecisionPointEntry[];
    /** Subtask outcomes */
    subtaskOutcomes: SubtaskOutcomeEntry[];
    /** Status transitions (from -> to) */
    statusTransitions: StatusTransitionEntry[];
    /** Count of all events processed */
    eventCount: number;
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
    /** Workflow started at */
    startedAt: string | null;
    /** Workflow completed at */
    completedAt: string | null;
    /** Workflow failed at */
    failedAt: string | null;
    /** Error information if failed */
    error: WorkflowTimelineError | null;
}
export type WorkflowTimelineStatus = "pending" | "running" | "awaiting_decision" | "completed" | "failed" | "cancelled" | "paused";
/**
 * Timeline event entry
 */
export interface WorkflowTimelineEventEntry {
    eventId: string;
    eventType: string;
    timestamp: string;
    stepId: string | null;
    taskId: string | null;
    executionId: string | null;
    details: Record<string, unknown> | null;
}
/**
 * Division outcome entry
 */
export interface DivisionOutcomeEntry {
    divisionId: string;
    status: "completed" | "failed";
    timestamp: string;
    reasonCode: string | null;
}
/**
 * Decision point entry
 */
export interface DecisionPointEntry {
    eventId: string;
    stepId: string | null;
    decisionType: string | null;
    options: string[];
    selectedOption: string | null;
    timestamp: string;
    decidedBy: string | null;
}
/**
 * Subtask outcome entry
 */
export interface SubtaskOutcomeEntry {
    subtaskId: string | null;
    stepId: string | null;
    status: "completed" | "failed";
    timestamp: string;
    reasonCode: string | null;
}
/**
 * Status transition entry
 */
export interface StatusTransitionEntry {
    fromStatus: string;
    toStatus: string;
    timestamp: string;
    reasonCode: string | null;
    actorId: string | null;
}
/**
 * Error information for failed workflows
 */
export interface WorkflowTimelineError {
    code: string | null;
    message: string | null;
    failedStepId: string | null;
    failedAt: string | null;
}
/**
 * Creates a new empty WorkflowTimelineState
 */
export declare function createEmptyWorkflowTimelineState(): WorkflowTimelineState;
/**
 * Workflow Timeline Projection Handler
 *
 * Implements ProjectionHandler interface for workflow timeline tracking.
 * Handles all workflow-related events to build a complete chronological timeline.
 * Events handled:
 * - workflow:step_completed - Step completion
 * - workflow:step_failed - Step failure
 * - division:completed - Division completed
 * - division:failed - Division failed
 * - subtask:completed - Subtask completed
 * - subtask:failed - Subtask failed
 * - task:status_changed - Task status transitions
 * - decision:requested - Decision requested
 * - decision:responded - Decision responded
 * - workflow_run.created - Workflow run created
 * - workflow_run.failed - Workflow run failed
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export declare const workflowTimelineProjectionHandler: ProjectionHandler;
/**
 * Creates a WorkflowTimelineProjection instance for use with ProjectionRebuildService
 */
export declare function createWorkflowTimelineProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
