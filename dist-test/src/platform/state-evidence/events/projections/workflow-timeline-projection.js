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
/**
 * Creates a new empty WorkflowTimelineState
 */
export function createEmptyWorkflowTimelineState() {
    return {
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
        startedAt: null,
        completedAt: null,
        failedAt: null,
        error: null,
    };
}
/**
 * Parses JSON payload safely
 */
function parsePayload(payloadJson) {
    try {
        const parsed = JSON.parse(payloadJson);
        return typeof parsed === "object" && parsed !== null
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
/**
 * Checks if an event has already been processed (idempotency check)
 */
function isEventProcessed(state, eventId) {
    return state.processedEventIds.includes(eventId);
}
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
export const workflowTimelineProjectionHandler = (state, event) => {
    // Initialize state if null
    const currentState = state;
    const newState = currentState ? { ...currentState } : createEmptyWorkflowTimelineState();
    // Idempotency check - skip already processed events
    if (isEventProcessed(newState, event.eventId)) {
        return newState;
    }
    // Parse payload
    const payload = parsePayload(event.payloadJson);
    // Update IDs if not set
    if (newState.workflowId === null) {
        newState.workflowId =
            payload.workflowId ??
                payload.workflowRunId ??
                event.taskId;
    }
    if (newState.taskId === null && event.taskId !== null) {
        newState.taskId = event.taskId;
    }
    if (newState.executionId === null) {
        newState.executionId = payload.executionId ?? null;
    }
    // Update timestamps
    if (newState.firstEventAt === null) {
        newState.firstEventAt = event.createdAt;
    }
    newState.lastEventAt = event.createdAt;
    // Extract details
    const details = {};
    for (const key of Object.keys(payload)) {
        if (key !== "traceContext") {
            details[key] = payload[key];
        }
    }
    const stepId = payload.stepId ?? null;
    // Add event to timeline
    const eventEntry = {
        eventId: event.eventId,
        eventType: event.eventType,
        timestamp: event.createdAt,
        stepId,
        taskId: event.taskId,
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
        case "workflow:step_completed":
            if (stepId) {
                newState.completedSteps[stepId] = event.createdAt;
            }
            if (newState.status === "pending") {
                newState.status = "running";
                if (newState.startedAt === null) {
                    newState.startedAt = event.createdAt;
                }
            }
            break;
        case "workflow:step_failed":
            if (stepId) {
                newState.failedSteps[stepId] = event.createdAt;
            }
            newState.status = "failed";
            newState.failedAt = event.createdAt;
            newState.error = {
                code: payload.reasonCode ?? null,
                message: payload.errorMessage ?? null,
                failedStepId: stepId,
                failedAt: event.createdAt,
            };
            break;
        case "division:completed":
        case "division:failed": {
            const divisionId = payload.divisionId;
            if (divisionId) {
                newState.divisionOutcomes[divisionId] = {
                    divisionId,
                    status: event.eventType === "division:completed" ? "completed" : "failed",
                    timestamp: event.createdAt,
                    reasonCode: payload.reasonCode ?? null,
                };
            }
            break;
        }
        case "subtask:completed":
        case "subtask:failed": {
            const subtaskId = payload.subtaskId ?? null;
            const entry = {
                subtaskId,
                stepId,
                status: event.eventType === "subtask:completed" ? "completed" : "failed",
                timestamp: event.createdAt,
                reasonCode: payload.reasonCode ?? null,
            };
            newState.subtaskOutcomes = [...newState.subtaskOutcomes, entry];
            if (stepId && event.eventType === "subtask:completed") {
                newState.completedSteps[stepId] = event.createdAt;
            }
            break;
        }
        case "task:status_changed": {
            const fromStatus = payload.fromStatus;
            const toStatus = payload.toStatus;
            if (fromStatus && toStatus) {
                const transition = {
                    fromStatus,
                    toStatus,
                    timestamp: event.createdAt,
                    reasonCode: payload.reasonCode ?? null,
                    actorId: payload.actorId ?? null,
                };
                newState.statusTransitions = [...newState.statusTransitions, transition];
            }
            if (toStatus) {
                if (toStatus === "completed") {
                    newState.status = "completed";
                    newState.completedAt = event.createdAt;
                }
                else if (toStatus === "failed") {
                    newState.status = "failed";
                    newState.failedAt = event.createdAt;
                    newState.error = {
                        code: payload.reasonCode ?? null,
                        message: payload.reasonDetail ?? null,
                        failedStepId: null,
                        failedAt: event.createdAt,
                    };
                }
                else if (toStatus === "cancelled") {
                    newState.status = "cancelled";
                }
                else if (toStatus === "in_progress" || toStatus === "running") {
                    if (newState.status === "pending") {
                        newState.status = "running";
                        newState.startedAt = event.createdAt;
                    }
                }
                else if (toStatus === "awaiting_decision") {
                    newState.status = "awaiting_decision";
                }
            }
            break;
        }
        case "workflow_run.failed":
            newState.status = "failed";
            newState.failedAt = event.createdAt;
            newState.error = {
                code: payload.reasonCode ?? null,
                message: payload.errorMessage ?? null,
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
    return newState;
};
/**
 * Creates a WorkflowTimelineProjection instance for use with ProjectionRebuildService
 */
export function createWorkflowTimelineProjectionHandler() {
    return workflowTimelineProjectionHandler;
}
//# sourceMappingURL=workflow-timeline-projection.js.map