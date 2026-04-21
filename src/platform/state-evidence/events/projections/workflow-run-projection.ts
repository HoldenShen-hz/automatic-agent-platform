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

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

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

export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

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
export function createEmptyWorkflowRunState(): WorkflowRunState {
  return {
    workflowId: null,
    taskId: null,
    status: "pending",
    timeline: [],
    completedSteps: [],
    failedSteps: [],
    eventCount: 0,
    processedEventIds: [],
    firstEventAt: null,
    lastEventAt: null,
    error: null,
    divisions: [],
    completedAt: null,
    failedAt: null,
  };
}

/**
 * Parses JSON payload safely
 */
function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson);
    return typeof parsed === "object" && parsed !== null
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

/**
 * Checks if an event has already been processed (idempotency check)
 */
function isEventProcessed(state: WorkflowRunState, eventId: string): boolean {
  return state.processedEventIds.includes(eventId);
}

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
export const workflowRunProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null
  const currentState = state as WorkflowRunState | null;
  const newState = currentState ? { ...currentState } : createEmptyWorkflowRunState();

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return newState;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);

  // Update taskId if not set
  if (newState.taskId === null && event.taskId !== null) {
    newState.taskId = event.taskId;
  }

  // Update workflowId if not set
  if (newState.workflowId === null) {
    newState.workflowId = (payload.workflowId as string | null) ?? event.taskId;
  }

  // Update timestamps
  if (newState.firstEventAt === null) {
    newState.firstEventAt = event.createdAt;
  }
  newState.lastEventAt = event.createdAt;

  // Add to timeline
  const timelineEntry: WorkflowTimelineEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    stepId: (payload.stepId as string | null) ?? null,
    status: (payload.status as string | null) ?? null,
  };
  newState.timeline = [...newState.timeline, timelineEntry];

  // Mark event as processed
  newState.processedEventIds = [...newState.processedEventIds, event.eventId];
  newState.eventCount = newState.eventCount + 1;

  // Update state based on event type
  switch (event.eventType) {
    case "workflow:step_completed":
      handleStepCompleted(newState, payload);
      break;

    case "division:completed":
      handleDivisionCompleted(newState, payload, event.createdAt);
      break;

    case "division:failed":
      handleDivisionFailed(newState, payload, event.createdAt);
      break;

    case "subtask:completed":
      handleSubtaskCompleted(newState, payload);
      break;

    case "subtask:failed":
      handleSubtaskFailed(newState, payload, event.createdAt);
      break;

    case "task:status_changed":
      handleTaskStatusChanged(newState, payload, event.createdAt);
      break;

    default:
      // No specific handling for other event types
      break;
  }

  return newState as Record<string, unknown>;
};

/**
 * Handle workflow:step_completed event
 */
function handleStepCompleted(
  state: WorkflowRunState,
  payload: Record<string, unknown>,
): void {
  const stepId = payload.stepId as string | undefined;
  if (stepId && !state.completedSteps.includes(stepId)) {
    state.completedSteps = [...state.completedSteps, stepId];
  }
  if (state.status === "pending") {
    state.status = "running";
  }
}

/**
 * Handle division:completed event
 */
function handleDivisionCompleted(
  state: WorkflowRunState,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  const divisionId = payload.divisionId as string | undefined;
  if (divisionId) {
    const division: DivisionResult = {
      divisionId,
      status: "completed",
      timestamp,
      reasonCode: (payload.reasonCode as string | null) ?? null,
    };
    state.divisions = [...state.divisions, division];
  }
  if (state.status === "pending") {
    state.status = "running";
  }
}

/**
 * Handle division:failed event
 */
function handleDivisionFailed(
  state: WorkflowRunState,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  const divisionId = payload.divisionId as string | undefined;
  if (divisionId) {
    const division: DivisionResult = {
      divisionId,
      status: "failed",
      timestamp,
      reasonCode: (payload.reasonCode as string | null) ?? null,
    };
    state.divisions = [...state.divisions, division];
  }
  // Note: division failure doesn't immediately fail the workflow
  // The workflow aggregates all divisions before determining final status
}

/**
 * Handle subtask:completed event (maps to step completion)
 */
function handleSubtaskCompleted(
  state: WorkflowRunState,
  payload: Record<string, unknown>,
): void {
  const stepId = (payload.stepId ?? payload.subtaskId) as string | undefined;
  if (stepId && !state.completedSteps.includes(stepId)) {
    state.completedSteps = [...state.completedSteps, stepId];
  }
  if (state.status === "pending") {
    state.status = "running";
  }
}

/**
 * Handle subtask:failed event
 */
function handleSubtaskFailed(
  state: WorkflowRunState,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  const stepId = (payload.stepId ?? payload.subtaskId) as string | undefined;
  if (stepId && !state.failedSteps.includes(stepId)) {
    state.failedSteps = [...state.failedSteps, stepId];
  }
  state.status = "failed";
  state.failedAt = timestamp;
  state.error = {
    code: (payload.reasonCode as string | null) ?? null,
    message: null, // subtask:failed doesn't include error message in payload
    failedStepId: stepId ?? null,
    failedAt: timestamp,
  };
}

/**
 * Handle task:status_changed event for workflow lifecycle
 */
function handleTaskStatusChanged(
  state: WorkflowRunState,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  const toStatus = payload.toStatus as string | undefined;

  switch (toStatus) {
    case "completed":
      if (state.status !== "failed") {
        state.status = "completed";
        state.completedAt = timestamp;
      }
      break;
    case "failed":
      state.status = "failed";
      state.failedAt = timestamp;
      if (!state.error) {
        state.error = {
          code: (payload.reasonCode as string | null) ?? null,
          message: (payload.reasonDetail as string | null) ?? null,
          failedStepId: null,
          failedAt: timestamp,
        };
      }
      break;
    case "cancelled":
      state.status = "cancelled";
      state.failedAt = timestamp;
      break;
    case "in_progress":
    case "running":
      if (state.status === "pending") {
        state.status = "running";
      }
      break;
    case "paused":
      state.status = "paused";
      break;
  }
}

/**
 * Creates a WorkflowRunProjection instance for use with ProjectionRebuildService
 */
export function createWorkflowRunProjectionHandler(): ProjectionHandler {
  return workflowRunProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
