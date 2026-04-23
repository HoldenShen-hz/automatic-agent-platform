/**
 * @fileoverview Tool Usage Projection
 *
 * Tracks tool/plugin invocation usage patterns and outcomes.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Tool usage aggregated per tool and per workflow
 *
 * §28 architecture: tool_usage_projection
 */
/**
 * Creates a new empty ToolUsageState
 */
export function createEmptyToolUsageState() {
    return {
        toolId: null,
        toolName: null,
        status: null,
        invocationCount: 0,
        successCount: 0,
        failureCount: 0,
        cacheHitCount: 0,
        cacheMissCount: 0,
        retryCount: 0,
        lastInvocationAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailedStepId: null,
        timeline: [],
        eventCount: 0,
        processedEventIds: [],
        firstEventAt: null,
        lastEventAt: null,
        taskId: null,
        sessionId: null,
        executionId: null,
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
 * Tool Usage Projection Handler
 *
 * Implements ProjectionHandler interface for tool usage tracking.
 * Handles events:
 * - plugin:invocation_started - Tool invocation started
 * - plugin:invocation_completed - Tool invocation completed
 * - skill:execution_started - Skill execution started
 * - skill:step_started - Skill step started
 * - skill:step_succeeded - Skill step succeeded
 * - skill:step_failed - Skill step failed
 * - skill:retry_scheduled - Retry scheduled
 * - skill:cache_miss - Cache miss
 * - skill:cache_hit - Cache hit
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const toolUsageProjectionHandler = (state, event) => {
    // Initialize state if null
    const currentState = state;
    const newState = currentState ? { ...currentState } : createEmptyToolUsageState();
    // Idempotency check - skip already processed events
    if (isEventProcessed(newState, event.eventId)) {
        return newState;
    }
    // Parse payload
    const payload = parsePayload(event.payloadJson);
    // Update IDs if not set
    if (newState.toolId === null) {
        newState.toolId = payload.pluginId ?? payload.skillId ?? null;
    }
    if (newState.toolName === null) {
        newState.toolName = payload.toolName ?? null;
    }
    if (newState.taskId === null && event.taskId !== null) {
        newState.taskId = event.taskId;
    }
    if (newState.sessionId === null) {
        newState.sessionId = event.taskId; // Use taskId as session proxy if no session
    }
    if (newState.executionId === null) {
        newState.executionId = payload.executionId ?? null;
    }
    // Update timestamps
    if (newState.firstEventAt === null) {
        newState.firstEventAt = event.createdAt;
    }
    newState.lastEventAt = event.createdAt;
    const stepId = payload.stepId ?? null;
    const status = payload.status ?? inferStatus(event.eventType);
    const durationMs = payload.durationMs ?? null;
    const errorCode = payload.errorCode ?? null;
    // Add to timeline
    const timelineEntry = {
        eventId: event.eventId,
        eventType: event.eventType,
        timestamp: event.createdAt,
        stepId,
        status,
        durationMs,
        errorCode,
    };
    newState.timeline = [...newState.timeline, timelineEntry];
    // Mark event as processed
    newState.processedEventIds = [...newState.processedEventIds, event.eventId];
    newState.eventCount = newState.eventCount + 1;
    // Update counters based on event type
    switch (event.eventType) {
        case "plugin:invocation_started":
        case "skill:execution_started":
        case "skill:step_started":
            newState.invocationCount++;
            newState.lastInvocationAt = event.createdAt;
            newState.status = "started";
            break;
        case "plugin:invocation_completed":
            if (status === "completed") {
                newState.successCount++;
                newState.lastSuccessAt = event.createdAt;
            }
            newState.lastInvocationAt = event.createdAt;
            break;
        case "skill:step_succeeded":
            newState.successCount++;
            newState.lastInvocationAt = event.createdAt;
            newState.lastSuccessAt = event.createdAt;
            newState.status = "completed";
            break;
        case "skill:step_failed":
            newState.failureCount++;
            newState.lastInvocationAt = event.createdAt;
            newState.lastFailureAt = event.createdAt;
            newState.lastFailedStepId = stepId ?? newState.lastFailedStepId;
            newState.status = "failed";
            break;
        case "skill:retry_scheduled":
            newState.retryCount++;
            newState.status = "retrying";
            break;
        case "skill:cache_miss":
            newState.cacheMissCount++;
            newState.status = "cache_miss";
            break;
        case "skill:cache_hit":
            newState.cacheHitCount++;
            newState.status = "cache_hit";
            break;
        default:
            break;
    }
    return newState;
};
/**
 * Infers invocation status from event type
 */
function inferStatus(eventType) {
    if (eventType.includes("started"))
        return "started";
    if (eventType.includes("succeeded") || eventType.includes("completed"))
        return "completed";
    if (eventType.includes("failed"))
        return "failed";
    if (eventType.includes("retry"))
        return "retrying";
    if (eventType.includes("cache_hit"))
        return "cache_hit";
    if (eventType.includes("cache_miss"))
        return "cache_miss";
    return null;
}
/**
 * Creates a ToolUsageProjection instance for use with ProjectionRebuildService
 */
export function createToolUsageProjectionHandler() {
    return toolUsageProjectionHandler;
}
//# sourceMappingURL=tool-usage-projection.js.map