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

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

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
  /** Canonical plan graph / compatibility workflow identifier */
  planGraphBundleId: string | null;
  /** Canonical harness run identifier */
  harnessRunId: string | null;
  /** Workflow ID */
  workflowId: string | null;
  /** Associated task ID */
  taskId: string | null;
  /** @deprecated legacy projection identifier; use harnessRunId */
  executionId: string | null;
  /** Current status derived from timeline */
  status: WorkflowTimelineStatus;
  /** All events in chronological order */
  events: WorkflowTimelineEventEntry[];
  /** Step completion map (nodeId -> completedAt) */
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
  /**
   * Set of processed event IDs for idempotency.
   * Stored as array for JSON serialization but converted to Set internally.
   */
  processedEventIds: string[];
  /** First event timestamp */
  firstEventAt: string | null;
  /** Last event timestamp */
  lastEventAt: string | null;
  /**
   * Timestamp when this projection was last updated.
   * Used for freshness monitoring and stale projection detection.
   */
  lastProjectedAt: string | null;
  /**
   * Lag in milliseconds between event time and projection update.
   * Computed as: now - lastProjectedAt.
   * Used for freshness monitoring per §28.6.
   */
  lagMs: number | null;
  /**
   * Whether this projection is considered stale.
   * A projection is stale if lagMs exceeds the stale threshold (default: 5 minutes).
   * Used for freshness monitoring per §28.6/§25.5.
   */
  stale: boolean;
  /** Workflow started at */
  startedAt: string | null;
  /** Workflow completed at */
  completedAt: string | null;
  /** Workflow failed at */
  failedAt: string | null;
  /** Error information if failed */
  error: WorkflowTimelineError | null;
}

export type WorkflowTimelineStatus =
  | "pending"
  | "running"
  | "awaiting_decision"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

/**
 * Timeline event entry
 */
export interface WorkflowTimelineEventEntry {
  eventId: string;
  eventType: string;
  timestamp: string;
  nodeId: string | null;
  /** @deprecated legacy projection identifier; use nodeId */
  stepId: string | null;
  taskId: string | null;
  harnessRunId: string | null;
  /** @deprecated legacy projection identifier; use harnessRunId */
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
  nodeId: string | null;
  /** @deprecated legacy projection identifier; use nodeId */
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
  nodeId: string | null;
  /** @deprecated legacy projection identifier; use nodeId */
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
  nodeId: string | null;
  /** @deprecated legacy projection identifier; use nodeId */
  failedStepId: string | null;
  failedAt: string | null;
}

/**
 * Creates a new empty WorkflowTimelineState
 */
export function createEmptyWorkflowTimelineState(): WorkflowTimelineState {
  return {
    planGraphBundleId: null,
    harnessRunId: null,
    workflowId: null,
    taskId: null,
    executionId: null,
    status: "pending",
    events: [],
    completedSteps: {},
    failedSteps: {},
    divisionOutcomes: {},
    decisionPoints: [],
    subtaskOutcomes: [],
    statusTransitions: [],
    eventCount: 0,
    processedEventIds: [],
    firstEventAt: null,
    lastEventAt: null,
    lastProjectedAt: null,
    lagMs: null,
    stale: false,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    error: null,
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

function extractNodeId(payload: Record<string, unknown>): string | null {
  return (payload.nodeId as string | null | undefined)
    ?? (payload.stepId as string | null | undefined)
    ?? null;
}

/**
 * Internal state interface with Set for efficient O(1) lookups.
 * Used during event processing; serialized to WorkflowTimelineState for storage.
 */
interface WorkflowTimelineStateInternal extends Omit<WorkflowTimelineState, "processedEventIds"> {
  _processedEventIdSet: Set<string>;
}

/**
 * Converts serialized state (with array) to internal state (with Set for O(1) lookup).
 */
function toInternalState(state: WorkflowTimelineState): WorkflowTimelineStateInternal {
  return {
    ...state,
    _processedEventIdSet: new Set(state.processedEventIds),
  };
}

/**
 * Converts internal state (with Set) back to serialized state (with array for JSON).
 */
function toSerializedState(state: WorkflowTimelineStateInternal): WorkflowTimelineState {
  return {
    ...state,
    processedEventIds: Array.from(state._processedEventIdSet),
  };
}

/**
 * Checks if an event has already been processed (idempotency check).
 * Uses O(1) Set lookup for efficiency.
 */
function isEventProcessed(state: WorkflowTimelineStateInternal, eventId: string): boolean {
  return state._processedEventIdSet.has(eventId);
}

/**
 * Workflow Timeline Projection Handler
 *
 * Implements ProjectionHandler interface for workflow timeline tracking.
 * Handles all workflow-related events to build a complete chronological timeline.
 * Events handled:
 * - platform.node_run.status_changed - Canonical node-run status projection
 * - platform.harness_run.status_changed - Canonical harness-run status projection
 * - workflow:step_completed - Legacy step completion projection input
 * - workflow:step_failed - Legacy step failure projection input
 * - division:completed - Division completed
 * - division:failed - Division failed
 * - subtask:completed - Subtask completed
 * - subtask:failed - Subtask failed
 * - task:status_changed - Task status transitions
 * - decision:requested - Decision requested
 * - decision:responded - Decision responded
 * - workflow_run.created - Legacy workflow-run created projection input
 * - workflow_run.failed - Legacy workflow-run failed projection input
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const workflowTimelineProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null, convert to internal state with Set for O(1) lookup
  const currentState = state as unknown as WorkflowTimelineState | null;
  const baseState = currentState ? { ...currentState } : createEmptyWorkflowTimelineState();
  const newState = toInternalState(baseState);

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return toSerializedState(newState) as unknown as Record<string, unknown>;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);
  const nodeId = extractNodeId(payload);

  // Update IDs if not set
  if (newState.planGraphBundleId === null) {
    newState.planGraphBundleId =
      (payload.planGraphBundleId as string | undefined)
      ?? (payload.workflowId as string | undefined)
      ?? (payload.workflowRunId as string | undefined)
      ?? null;
  }
  if (newState.harnessRunId === null) {
    newState.harnessRunId =
      (payload.harnessRunId as string | undefined)
      ?? (payload.executionId as string | undefined)
      ?? null;
  }
  if (newState.workflowId === null) {
    newState.workflowId =
      (payload.planGraphBundleId as string | undefined) ??
      (payload.workflowId as string | undefined) ??
      (payload.workflowRunId as string | undefined) ??
      event.taskId;
  }
  if (newState.taskId === null && event.taskId !== null) {
    newState.taskId = event.taskId;
  }
  if (newState.executionId === null) {
    newState.executionId =
      (payload.harnessRunId as string | null | undefined)
      ?? (payload.executionId as string | null | undefined)
      ?? null;
  }

  // Update timestamps
  if (newState.firstEventAt === null) {
    newState.firstEventAt = event.createdAt;
  }
  newState.lastEventAt = event.createdAt;
  newState.lastProjectedAt = event.createdAt;
  // Compute lagMs and stale flag per §28.6/§25.5
  if (event.createdAt) {
    const eventTime = new Date(event.createdAt).getTime();
    const now = Date.now();
    newState.lagMs = now - eventTime;
    // Stale threshold: 5 minutes (300000ms)
    newState.stale = newState.lagMs > 300000;
  }

  // Extract details
  const details: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (key !== "traceContext") {
      details[key] = payload[key];
    }
  }

  const stepId = nodeId;

  // Add event to timeline
  const eventEntry: WorkflowTimelineEventEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    nodeId,
    stepId,
    taskId: event.taskId,
    harnessRunId: newState.harnessRunId,
    executionId: newState.executionId,
    details: Object.keys(details).length > 0 ? details : null,
  };
  newState.events = [...newState.events, eventEntry];

  // Mark event as processed
  newState.processedEventIds = [...newState.processedEventIds, event.eventId];
  newState.eventCount = newState.eventCount + 1;

  // Update state based on event type
  switch (event.eventType) {
    case "workflow_run.created":
    case "workflow:started":
      newState.status = "running";
      if (newState.startedAt === null) {
        newState.startedAt = event.createdAt;
      }
      break;

    case "platform.harness_run.status_changed": {
      const toStatus = (payload.toStatus as string | null | undefined) ?? (payload.status as string | null | undefined);
      if (toStatus === "completed") {
        newState.status = "completed";
        newState.completedAt = event.createdAt;
      } else if (toStatus === "failed" || toStatus === "aborted") {
        newState.status = "failed";
        newState.failedAt = event.createdAt;
      } else if (toStatus === "paused" || toStatus === "pausing") {
        newState.status = "awaiting_decision";
      } else {
        newState.status = "running";
        if (newState.startedAt === null) {
          newState.startedAt = event.createdAt;
        }
      }
      break;
    }

    case "workflow:step_completed":
      if (nodeId) {
        newState.completedSteps[nodeId] = event.createdAt;
      }
      if (newState.status === "pending") {
        newState.status = "running";
        if (newState.startedAt === null) {
          newState.startedAt = event.createdAt;
        }
      }
      break;

    case "platform.node_run.status_changed": {
      const toStatus = (payload.toStatus as string | null | undefined) ?? (payload.status as string | null | undefined);
      if (nodeId && (toStatus === "succeeded" || toStatus === "completed")) {
        newState.completedSteps[nodeId] = event.createdAt;
      }
      if (nodeId && (toStatus === "failed" || toStatus === "aborted" || toStatus === "policy_blocked")) {
        newState.failedSteps[nodeId] = event.createdAt;
      }
      if (newState.status === "pending" && toStatus != null) {
        newState.status = "running";
        if (newState.startedAt === null) {
          newState.startedAt = event.createdAt;
        }
      }
      break;
    }

    case "workflow:step_failed":
      if (nodeId) {
        newState.failedSteps[nodeId] = event.createdAt;
      }
      newState.status = "failed";
      newState.failedAt = event.createdAt;
      newState.error = {
        code: (payload.reasonCode as string | null | undefined) ?? null,
        message: (payload.errorMessage as string | null | undefined) ?? null,
        nodeId,
        failedStepId: stepId,
        failedAt: event.createdAt,
      };
      break;

    case "platform.side_effect.status_changed":
    case "platform.budget_ledger.status_changed":
    case "platform.budget_reservation.status_changed":
    case "platform.graph_scheduler.decision_recorded":
      if (newState.status === "pending") {
        newState.status = "running";
        if (newState.startedAt === null) {
          newState.startedAt = event.createdAt;
        }
      }
      break;

    case "division:completed":
    case "division:failed": {
      const divisionId = payload.divisionId as string | undefined;
      if (divisionId) {
        newState.divisionOutcomes[divisionId] = {
          divisionId,
          status: event.eventType === "division:completed" ? "completed" : "failed",
          timestamp: event.createdAt,
          reasonCode: (payload.reasonCode as string | null | undefined) ?? null,
        };
      }
      break;
    }

    case "subtask:completed":
    case "subtask:failed": {
      const subtaskId = (payload.subtaskId as string | null | undefined) ?? null;
      const entry: SubtaskOutcomeEntry = {
        subtaskId,
        nodeId,
        stepId,
        status: event.eventType === "subtask:completed" ? "completed" : "failed",
        timestamp: event.createdAt,
        reasonCode: (payload.reasonCode as string | null | undefined) ?? null,
      };
      newState.subtaskOutcomes = [...newState.subtaskOutcomes, entry];
      if (nodeId && event.eventType === "subtask:completed") {
        newState.completedSteps[nodeId] = event.createdAt;
      }
      break;
    }

    case "task:status_changed": {
      const fromStatus = payload.fromStatus as string | undefined;
      const toStatus = payload.toStatus as string | undefined;
      if (fromStatus && toStatus) {
        const transition: StatusTransitionEntry = {
          fromStatus,
          toStatus,
          timestamp: event.createdAt,
          reasonCode: (payload.reasonCode as string | null | undefined) ?? null,
          actorId: (payload.actorId as string | null | undefined) ?? null,
        };
        newState.statusTransitions = [...newState.statusTransitions, transition];
      }
      if (toStatus) {
        if (toStatus === "completed") {
          newState.status = "completed";
          newState.completedAt = event.createdAt;
        } else if (toStatus === "failed") {
          newState.status = "failed";
          newState.failedAt = event.createdAt;
          newState.error = {
            code: (payload.reasonCode as string | null | undefined) ?? null,
            message: (payload.reasonDetail as string | null | undefined) ?? null,
            nodeId: null,
            failedStepId: null,
            failedAt: event.createdAt,
          };
        } else if (toStatus === "cancelled") {
          newState.status = "cancelled";
        } else if (toStatus === "in_progress" || toStatus === "running") {
          if (newState.status === "pending") {
            newState.status = "running";
            newState.startedAt = event.createdAt;
          }
        } else if (toStatus === "awaiting_decision") {
          newState.status = "awaiting_decision";
        }
      }
      break;
    }

    case "workflow_run.failed":
      newState.status = "failed";
      newState.failedAt = event.createdAt;
      newState.error = {
        code: (payload.reasonCode as string | null | undefined) ?? null,
        message: (payload.errorMessage as string | null | undefined) ?? null,
        nodeId: null,
        failedStepId: null,
        failedAt: event.createdAt,
      };
      break;

    case "workflow_run.completed":
      newState.status = "completed";
      newState.completedAt = event.createdAt;
      break;

    default:
      // For any other event, if status is still pending, transition to running
      if (newState.status === "pending") {
        newState.status = "running";
        newState.startedAt = event.createdAt;
      }
      break;
  }

  return toSerializedState(newState) as unknown as Record<string, unknown>;
};

/**
 * Creates a WorkflowTimelineProjection instance for use with ProjectionRebuildService
 */
export function createWorkflowTimelineProjectionHandler(): ProjectionHandler {
  return workflowTimelineProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
