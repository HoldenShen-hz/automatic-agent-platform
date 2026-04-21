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
/**
 * Creates a new empty WorkflowRunState
 */
export function createEmptyWorkflowRunState() {
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
export const workflowRunProjectionHandler = (state, event) => {
    // Initialize state if null
    const currentState = state;
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
        newState.workflowId = payload.workflowId ?? event.taskId;
    }
    // Update timestamps
    if (newState.firstEventAt === null) {
        newState.firstEventAt = event.createdAt;
    }
    newState.lastEventAt = event.createdAt;
    // Add to timeline
    const timelineEntry = {
        eventId: event.eventId,
        eventType: event.eventType,
        timestamp: event.createdAt,
        stepId: payload.stepId ?? null,
        status: payload.status ?? null,
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
    return newState;
};
/**
 * Handle workflow:step_completed event
 */
function handleStepCompleted(state, payload) {
    const stepId = payload.stepId;
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
function handleDivisionCompleted(state, payload, timestamp) {
    const divisionId = payload.divisionId;
    if (divisionId) {
        const division = {
            divisionId,
            status: "completed",
            timestamp,
            reasonCode: payload.reasonCode ?? null,
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
function handleDivisionFailed(state, payload, timestamp) {
    const divisionId = payload.divisionId;
    if (divisionId) {
        const division = {
            divisionId,
            status: "failed",
            timestamp,
            reasonCode: payload.reasonCode ?? null,
        };
        state.divisions = [...state.divisions, division];
    }
    // Note: division failure doesn't immediately fail the workflow
    // The workflow aggregates all divisions before determining final status
}
/**
 * Handle subtask:completed event (maps to step completion)
 */
function handleSubtaskCompleted(state, payload) {
    const stepId = (payload.stepId ?? payload.subtaskId);
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
function handleSubtaskFailed(state, payload, timestamp) {
    const stepId = (payload.stepId ?? payload.subtaskId);
    if (stepId && !state.failedSteps.includes(stepId)) {
        state.failedSteps = [...state.failedSteps, stepId];
    }
    state.status = "failed";
    state.failedAt = timestamp;
    state.error = {
        code: payload.reasonCode ?? null,
        message: null, // subtask:failed doesn't include error message in payload
        failedStepId: stepId ?? null,
        failedAt: timestamp,
    };
}
/**
 * Handle task:status_changed event for workflow lifecycle
 */
function handleTaskStatusChanged(state, payload, timestamp) {
    const toStatus = payload.toStatus;
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
                    code: payload.reasonCode ?? null,
                    message: payload.reasonDetail ?? null,
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
export function createWorkflowRunProjectionHandler() {
    return workflowRunProjectionHandler;
}
//# sourceMappingURL=workflow-run-projection.js.map