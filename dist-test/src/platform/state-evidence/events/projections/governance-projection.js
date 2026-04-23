/**
 * @fileoverview Governance Projection
 *
 * Tracks governance events including policy changes, compliance decisions,
 * and permission modifications.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Governance events linked to tenant/policy/principal
 *
 * §28 architecture: governance_projection
 *
 * Note: This projection aggregates governance-relevant events across
 * multiple event namespaces (approval_flow, compliance, policy changes)
 * to provide a unified view of governance decisions.
 */
/**
 * Creates a new empty GovernanceState
 */
export function createEmptyGovernanceState() {
    return {
        entityId: null,
        entityKind: null,
        tenantId: null,
        taskId: null,
        executionId: null,
        actionType: null,
        status: "pending",
        principal: null,
        policyId: null,
        complianceFramework: null,
        approved: null,
        reason: null,
        occurredAt: null,
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
 * Maps event type to governance action type
 */
function mapEventToActionType(eventType, payload) {
    switch (eventType) {
        case "policy:created":
        case "config:policy_created":
            return "policy_created";
        case "policy:updated":
        case "config:policy_changed":
        case "policy:changed":
            return "policy_updated";
        case "policy:deleted":
            return "policy_deleted";
        case "approval_flow:approved":
        case "decision:approved":
        case "decision:confirmed":
            return "approval_granted";
        case "approval_flow:rejected":
        case "decision:rejected":
            return "approval_denied";
        case "delegation:created":
            return "delegation_created";
        case "delegation:completed":
            return "delegation_completed";
        case "delegation:failed":
            return "delegation_failed";
        case "compliance:violation_detected":
            return "compliance_violation";
        case "compliance:resolved":
        case "compliance:violation_resolved":
            return "compliance_resolved";
        case "permission:granted":
            return "permission_granted";
        case "permission:revoked":
            return "permission_revoked";
        case "role:assigned":
            return "role_assigned";
        case "role:removed":
            return "role_removed";
        case "config:changed":
            return "config_changed";
        case "approval_flow:escalated":
        case "decision:escalated":
            return "escalation_triggered";
        default:
            // Try to infer from payload
            if (eventType.includes("policy"))
                return "policy_updated";
            if (eventType.includes("approval") || eventType.includes("decision"))
                return "approval_granted";
            if (eventType.includes("delegation"))
                return "delegation_created";
            if (eventType.includes("compliance") || eventType.includes("violation"))
                return "compliance_violation";
            if (eventType.includes("permission"))
                return "permission_granted";
            if (eventType.includes("role"))
                return "role_assigned";
            return null;
    }
}
/**
 * Governance Projection Handler
 *
 * Implements ProjectionHandler interface for governance tracking.
 * Handles governance-related events:
 * - Policy events (policy:created, policy:updated, etc.)
 * - Compliance events (compliance:violation_detected, etc.)
 * - Approval events (decision:approved, decision:rejected)
 * - Delegation events (delegation:created, etc.)
 * - Config events (config:changed)
 * - Permission events
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const governanceProjectionHandler = (state, event) => {
    // Initialize state if null
    const currentState = state;
    const newState = currentState ? { ...currentState } : createEmptyGovernanceState();
    // Idempotency check - skip already processed events
    if (isEventProcessed(newState, event.eventId)) {
        return newState;
    }
    // Parse payload
    const payload = parsePayload(event.payloadJson);
    // Update IDs if not set
    if (newState.entityId === null) {
        newState.entityId =
            payload.policyId ??
                payload.approvalId ??
                payload.delegationId ??
                payload.configId ??
                payload.violationId ??
                null;
    }
    if (newState.entityKind === null) {
        newState.entityKind = payload.entityKind ?? inferEntityKind(event.eventType);
    }
    if (newState.taskId === null && event.taskId !== null) {
        newState.taskId = event.taskId;
    }
    if (newState.executionId === null) {
        newState.executionId = payload.executionId ?? null;
    }
    if (newState.tenantId === null) {
        newState.tenantId = payload.tenantId ?? null;
    }
    // Update timestamps
    if (newState.firstEventAt === null) {
        newState.firstEventAt = event.createdAt;
    }
    newState.lastEventAt = event.createdAt;
    // Update action type
    if (newState.actionType === null) {
        newState.actionType = mapEventToActionType(event.eventType, payload);
    }
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
        actorId: payload.actorId ?? payload.principal ?? null,
        actionType: newState.actionType,
        details: Object.keys(details).length > 0 ? details : null,
    };
    newState.timeline = [...newState.timeline, timelineEntry];
    // Mark event as processed
    newState.processedEventIds = [...newState.processedEventIds, event.eventId];
    newState.eventCount = newState.eventCount + 1;
    // Update metadata
    if (newState.principal === null) {
        newState.principal =
            payload.actorId ??
                payload.principal ??
                payload.respondedBy ??
                null;
    }
    if (newState.policyId === null) {
        newState.policyId = payload.policyId ?? null;
    }
    if (newState.complianceFramework === null) {
        newState.complianceFramework = payload.framework ?? payload.complianceFramework ?? null;
    }
    if (newState.reason === null) {
        newState.reason = payload.reason ?? payload.reasonCode ?? null;
    }
    if (newState.occurredAt === null) {
        newState.occurredAt = payload.occurredAt ?? event.createdAt;
    }
    // Update state based on event type
    switch (event.eventType) {
        case "policy:created":
        case "config:policy_created":
            newState.status = "active";
            break;
        case "policy:updated":
        case "policy:changed":
        case "config:policy_changed":
            newState.status = "active";
            break;
        case "policy:deleted":
            newState.status = "cancelled";
            break;
        case "approval_flow:approved":
        case "decision:approved":
        case "decision:confirmed":
            newState.status = "approved";
            newState.approved = true;
            break;
        case "approval_flow:rejected":
        case "decision:rejected":
            newState.status = "denied";
            newState.approved = false;
            break;
        case "delegation:created":
            newState.status = "pending";
            break;
        case "delegation:completed":
            newState.status = "completed";
            break;
        case "delegation:failed":
            newState.status = "failed";
            break;
        case "compliance:violation_detected":
            newState.status = "pending";
            newState.approved = false;
            break;
        case "compliance:resolved":
        case "compliance:violation_resolved":
            newState.status = "resolved";
            break;
        case "permission:granted":
            newState.status = "approved";
            newState.approved = true;
            break;
        case "permission:revoked":
            newState.status = "denied";
            newState.approved = false;
            break;
        case "role:assigned":
            newState.status = "approved";
            break;
        case "role:removed":
            newState.status = "denied";
            break;
        case "config:changed":
            newState.status = "active";
            break;
        case "approval_flow:escalated":
        case "decision:escalated":
            newState.status = "pending";
            break;
        default:
            // No specific handling
            break;
    }
    return newState;
};
/**
 * Infers entity kind from event type
 */
function inferEntityKind(eventType) {
    if (eventType.includes("policy"))
        return "policy";
    if (eventType.includes("approval") || eventType.includes("decision"))
        return "approval";
    if (eventType.includes("delegation"))
        return "delegation";
    if (eventType.includes("compliance") || eventType.includes("violation"))
        return "compliance";
    if (eventType.includes("permission"))
        return "permission";
    if (eventType.includes("role"))
        return "role";
    if (eventType.includes("config"))
        return "config";
    return null;
}
/**
 * Creates a GovernanceProjection instance for use with ProjectionRebuildService
 */
export function createGovernanceProjectionHandler() {
    return governanceProjectionHandler;
}
//# sourceMappingURL=governance-projection.js.map