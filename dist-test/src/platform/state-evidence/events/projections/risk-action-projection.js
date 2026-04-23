/**
 * @fileoverview Risk Action Projection
 *
 * Tracks risk engine decisions and resulting actions.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Risk actions linked to task/execution/workflow
 *
 * §28 architecture: risk_action_projection
 *
 * Note: Risk action events are emitted by the risk control plane
 * when the risk evaluation engine makes decisions. This projection
 * aggregates risk decisions across the platform.
 */
/**
 * Creates a new empty RiskActionState
 */
export function createEmptyRiskActionState() {
    return {
        riskDecisionId: null,
        taskId: null,
        executionId: null,
        workflowId: null,
        riskLevel: null,
        action: null,
        status: "pending",
        policyIds: [],
        riskScore: null,
        confirmed: false,
        overridden: false,
        overrideReason: null,
        overriddenBy: null,
        decidedAt: null,
        completedAt: null,
        timeline: [],
        eventCount: 0,
        processedEventIds: [],
        firstEventAt: null,
        lastEventAt: null,
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
 * Adds a unique policy ID
 */
function addUniquePolicyId(existing, policyId) {
    return existing.includes(policyId) ? existing : [...existing, policyId];
}
/**
 * Risk Action Projection Handler
 *
 * Implements ProjectionHandler interface for risk action tracking.
 * Handles risk decision events:
 * - risk:decision_requested - Risk evaluation requested
 * - risk:decision_made - Risk decision made
 * - risk:action_confirmed - Risk action confirmed
 * - risk:action_overridden - Risk action overridden
 * - risk:action_completed - Risk action completed
 * - risk:quota_exceeded - Risk quota exceeded
 * - compliance:violation_detected - Compliance violation detected
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const riskActionProjectionHandler = (state, event) => {
    // Initialize state if null
    const currentState = state;
    const newState = currentState ? { ...currentState } : createEmptyRiskActionState();
    // Idempotency check - skip already processed events
    if (isEventProcessed(newState, event.eventId)) {
        return newState;
    }
    // Parse payload
    const payload = parsePayload(event.payloadJson);
    // Update IDs if not set
    if (newState.riskDecisionId === null) {
        newState.riskDecisionId =
            payload.riskDecisionId ??
                payload.decisionId ??
                payload.violationId ??
                null;
    }
    if (newState.taskId === null && event.taskId !== null) {
        newState.taskId = event.taskId;
    }
    if (newState.executionId === null) {
        newState.executionId = payload.executionId ?? null;
    }
    if (newState.workflowId === null) {
        newState.workflowId = payload.workflowId ?? null;
    }
    // Update timestamps
    if (newState.firstEventAt === null) {
        newState.firstEventAt = event.createdAt;
    }
    newState.lastEventAt = event.createdAt;
    // Extract details for timeline
    const details = {};
    for (const key of Object.keys(payload)) {
        if (key !== "traceContext") {
            details[key] = payload[key];
        }
    }
    // Add to timeline
    const timelineEntry = {
        eventId: event.eventId,
        eventType: event.eventType,
        timestamp: event.createdAt,
        actorId: payload.actorId ?? null,
        action: inferAction(event.eventType),
        details: Object.keys(details).length > 0 ? details : null,
    };
    newState.timeline = [...newState.timeline, timelineEntry];
    // Mark event as processed
    newState.processedEventIds = [...newState.processedEventIds, event.eventId];
    newState.eventCount = newState.eventCount + 1;
    // Update risk metadata
    if (newState.riskLevel === null) {
        newState.riskLevel = payload.riskLevel ?? null;
    }
    if (newState.riskScore === null) {
        const score = payload.riskScore ?? payload.risk_score ?? payload.score;
        newState.riskScore = typeof score === "number" ? score : null;
    }
    // Update policy IDs
    const policyId = payload.policyId;
    if (policyId) {
        newState.policyIds = addUniquePolicyId(newState.policyIds, policyId);
    }
    const policyIds = payload.policyIds;
    if (policyIds) {
        for (const pid of policyIds) {
            newState.policyIds = addUniquePolicyId(newState.policyIds, pid);
        }
    }
    // Update state based on event type
    switch (event.eventType) {
        case "risk:decision_requested":
            newState.status = "pending";
            break;
        case "risk:decision_made":
            newState.status = "decided";
            newState.decidedAt = event.createdAt;
            const action = payload.action;
            if (action) {
                newState.action = action;
            }
            break;
        case "risk:action_confirmed":
            newState.status = "confirmed";
            newState.confirmed = true;
            break;
        case "risk:action_overridden":
            newState.status = "overridden";
            newState.overridden = true;
            newState.overrideReason = payload.reason ?? null;
            newState.overriddenBy = payload.overriddenBy ?? null;
            break;
        case "risk:action_completed":
            newState.status = "completed";
            newState.completedAt = event.createdAt;
            break;
        case "risk:quota_exceeded":
            newState.status = "decided";
            newState.action = "block";
            newState.decidedAt = event.createdAt;
            break;
        case "compliance:violation_detected":
            newState.status = "decided";
            newState.action = "quarantine";
            newState.decidedAt = event.createdAt;
            if (newState.riskLevel === null) {
                newState.riskLevel = payload.severity ?? "high";
            }
            break;
        default:
            break;
    }
    return newState;
};
/**
 * Infers action from event type
 */
function inferAction(eventType) {
    if (eventType.includes("allow"))
        return "allow";
    if (eventType.includes("deny"))
        return "deny";
    if (eventType.includes("block"))
        return "block";
    if (eventType.includes("escalate"))
        return "escalate";
    if (eventType.includes("quota"))
        return "block";
    if (eventType.includes("violation"))
        return "quarantine";
    return null;
}
/**
 * Creates a RiskActionProjection instance for use with ProjectionRebuildService
 */
export function createRiskActionProjectionHandler() {
    return riskActionProjectionHandler;
}
//# sourceMappingURL=risk-action-projection.js.map