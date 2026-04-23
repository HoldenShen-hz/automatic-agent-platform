/**
 * @fileoverview Approval Queue Projection
 *
 * Tracks approval queue state with pending/decided/expired items.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Approval queue items linked to task/execution
 *
 * §28 architecture: approval_queue_projection
 */
/**
 * Creates a new empty ApprovalQueueState
 */
export function createEmptyApprovalQueueState() {
    return {
        approvalId: null,
        taskId: null,
        executionId: null,
        status: "requested",
        riskLevel: null,
        approvalsReceived: 0,
        approvalsRequired: 1,
        rejectionsReceived: 0,
        respondedBy: null,
        createdAt: null,
        respondedAt: null,
        expiresAt: null,
        timeline: [],
        eventCount: 0,
        processedEventIds: [],
        firstEventAt: null,
        lastEventAt: null,
        decisionType: null,
        selectedOptionId: null,
        inputText: null,
        cascadeDeny: false,
        cascadeSourceApprovalId: null,
        cascadeSessionId: null,
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
 * Approval Queue Projection Handler
 *
 * Implements ProjectionHandler interface for approval queue state management.
 * Handles events:
 * - decision:requested - New approval request created
 * - decision:responded - Approval responded to
 * - decision:partial_approval - Partial approval received (multi-party)
 * - decision:approved - Final approval granted (multi-party)
 * - decision:rejected - Final rejection (multi-party)
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const approvalQueueProjectionHandler = (state, event) => {
    // Initialize state if null
    const currentState = state;
    const newState = currentState ? { ...currentState } : createEmptyApprovalQueueState();
    // Idempotency check - skip already processed events
    if (isEventProcessed(newState, event.eventId)) {
        return newState;
    }
    // Parse payload
    const payload = parsePayload(event.payloadJson);
    // Update approvalId if not set
    if (newState.approvalId === null) {
        newState.approvalId = payload.approvalId ?? null;
    }
    // Update taskId and executionId if not set
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
    // Add to timeline
    const timelineEntry = {
        eventId: event.eventId,
        eventType: event.eventType,
        timestamp: event.createdAt,
        actorId: payload.respondedBy ?? null,
        decisionType: payload.decisionType ?? null,
    };
    newState.timeline = [...newState.timeline, timelineEntry];
    // Mark event as processed
    newState.processedEventIds = [...newState.processedEventIds, event.eventId];
    newState.eventCount = newState.eventCount + 1;
    // Extract multi-party counts from context if available
    const context = payload.context;
    if (context) {
        if (newState.approvalsRequired === 1) {
            const origRequired = context.originalRequiredApprovals;
            if (origRequired !== undefined) {
                newState.approvalsRequired = origRequired;
            }
        }
    }
    // Update state based on event type
    switch (event.eventType) {
        case "decision:requested":
            handleDecisionRequested(newState, payload, event.createdAt);
            break;
        case "decision:responded":
            handleDecisionResponded(newState, payload, event.createdAt);
            break;
        case "decision:partial_approval":
            handlePartialApproval(newState, payload, event.createdAt);
            break;
        case "decision:approved":
            handleDecisionApproved(newState, payload, event.createdAt);
            break;
        case "decision:rejected":
            handleDecisionRejected(newState, payload, event.createdAt);
            break;
        default:
            // No specific handling for other event types
            break;
    }
    return newState;
};
/**
 * Handle decision:requested event
 */
function handleDecisionRequested(state, payload, timestamp) {
    state.status = "requested";
    if (state.createdAt === null) {
        state.createdAt = timestamp;
    }
    if (state.riskLevel === null) {
        state.riskLevel = payload.riskLevel ?? null;
    }
    // Required approvals from context
    const ctx = payload.context;
    if (ctx) {
        const reqApprovals = ctx.originalRequiredApprovals;
        if (reqApprovals !== undefined) {
            state.approvalsRequired = reqApprovals;
        }
    }
}
/**
 * Handle decision:responded event
 */
function handleDecisionResponded(state, payload, timestamp) {
    const decisionType = payload.decisionType;
    if (decisionType === "confirmed" || decisionType === "option_selected") {
        state.status = "confirmed";
        state.approvalsReceived = 1;
    }
    else if (decisionType === "rejected") {
        state.status = "rejected";
        state.rejectionsReceived = 1;
    }
    else if (decisionType === "expired") {
        state.status = "expired";
    }
    else if (decisionType === "text_input") {
        state.status = "text_input";
    }
    else {
        // Default to confirmed for backward compatibility
        state.status = "confirmed";
    }
    state.respondedAt = timestamp;
    state.respondedBy = payload.respondedBy ?? null;
    state.decisionType = decisionType ?? null;
    state.selectedOptionId = payload.selectedOptionId ?? null;
    state.inputText = payload.inputText ?? null;
    state.cascadeDeny = payload.cascadeDeny === true;
    state.cascadeSourceApprovalId = payload.cascadeSourceApprovalId ?? null;
    state.cascadeSessionId = payload.cascadeSessionId ?? null;
}
/**
 * Handle decision:partial_approval event (multi-party progress)
 */
function handlePartialApproval(state, payload, _timestamp) {
    const approvalsReceived = payload.approvalsReceived;
    const requiredApprovals = payload.requiredApprovals;
    if (approvalsReceived !== undefined) {
        state.approvalsReceived = approvalsReceived;
    }
    if (requiredApprovals !== undefined) {
        state.approvalsRequired = requiredApprovals;
    }
    state.status = "requested"; // Still pending more approvals
}
/**
 * Handle decision:approved event (multi-party final)
 */
function handleDecisionApproved(state, payload, timestamp) {
    state.status = "confirmed";
    state.approvalsReceived = state.approvalsRequired;
    if (state.respondedAt === null) {
        state.respondedAt = timestamp;
    }
    state.respondedBy = payload.respondedBy ?? null;
    state.decisionType = "approved";
}
/**
 * Handle decision:rejected event (multi-party final)
 */
function handleDecisionRejected(state, payload, timestamp) {
    state.status = "rejected";
    state.rejectionsReceived = state.approvalsRequired;
    if (state.respondedAt === null) {
        state.respondedAt = timestamp;
    }
    state.respondedBy = payload.respondedBy ?? null;
    state.decisionType = "rejected";
}
/**
 * Creates an ApprovalQueueProjection instance for use with ProjectionRebuildService
 */
export function createApprovalQueueProjectionHandler() {
    return approvalQueueProjectionHandler;
}
//# sourceMappingURL=approval-queue-projection.js.map