/**
 * @fileoverview Worker Status Projection
 *
 * Tracks worker lifecycle and heartbeat state.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Worker status linked to execution and task
 *
 * §28 architecture: worker_status_projection
 */
/**
 * Creates a new empty WorkerStatusState
 */
export function createEmptyWorkerStatusState() {
    return {
        workerId: null,
        status: "idle",
        taskId: null,
        executionId: null,
        tenantId: null,
        claimsAccepted: 0,
        claimsRejected: 0,
        heartbeatsReceived: 0,
        lastHeartbeatAt: null,
        writebacksRecorded: 0,
        writebacksRejected: 0,
        lastWritebackAt: null,
        lastWritebackRejectedAt: null,
        leaseReleasesAfterWriteback: 0,
        timeline: [],
        eventCount: 0,
        processedEventIds: [],
        firstEventAt: null,
        lastEventAt: null,
        firstClaimAcceptedAt: null,
        lastClaimAcceptedAt: null,
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
 * Worker Status Projection Handler
 *
 * Implements ProjectionHandler interface for worker status tracking.
 * Handles events:
 * - worker:claim_accepted - Worker accepted a claim
 * - worker:claim_rejected - Worker rejected a claim
 * - worker:heartbeat_recorded - Worker heartbeat received
 * - worker:writeback_recorded - Writeback recorded
 * - worker:writeback_rejected - Writeback rejected
 * - worker:lease_released_after_writeback - Lease released after writeback
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const workerStatusProjectionHandler = (state, event) => {
    // Initialize state if null
    const currentState = state;
    const newState = currentState ? { ...currentState } : createEmptyWorkerStatusState();
    // Idempotency check - skip already processed events
    if (isEventProcessed(newState, event.eventId)) {
        return newState;
    }
    // Parse payload
    const payload = parsePayload(event.payloadJson);
    // Update IDs if not set
    if (newState.workerId === null) {
        newState.workerId = payload.workerId ?? null;
    }
    if (newState.taskId === null && event.taskId !== null) {
        newState.taskId = event.taskId;
    }
    if (newState.executionId === null) {
        newState.executionId = payload.executionId ?? event.taskId;
    }
    if (newState.tenantId === null) {
        newState.tenantId = payload.tenantId ?? null;
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
        executionId: event.taskId,
        details: Object.keys(details).length > 0 ? details : null,
    };
    newState.timeline = [...newState.timeline, timelineEntry];
    // Mark event as processed
    newState.processedEventIds = [...newState.processedEventIds, event.eventId];
    newState.eventCount = newState.eventCount + 1;
    // Update state based on event type
    switch (event.eventType) {
        case "worker:claim_accepted":
            newState.claimsAccepted++;
            newState.status = "active";
            if (newState.firstClaimAcceptedAt === null) {
                newState.firstClaimAcceptedAt = event.createdAt;
            }
            newState.lastClaimAcceptedAt = event.createdAt;
            break;
        case "worker:claim_rejected":
            newState.claimsRejected++;
            newState.status = "rejected";
            break;
        case "worker:heartbeat_recorded":
            newState.heartbeatsReceived++;
            newState.lastHeartbeatAt = event.createdAt;
            // Keep status active on heartbeat
            if (newState.status === "idle" || newState.status === "claiming") {
                newState.status = "active";
            }
            break;
        case "worker:writeback_recorded":
            newState.writebacksRecorded++;
            newState.lastWritebackAt = event.createdAt;
            newState.status = "writeback";
            break;
        case "worker:writeback_rejected":
            newState.writebacksRejected++;
            newState.lastWritebackRejectedAt = event.createdAt;
            newState.status = "rejected";
            break;
        case "worker:lease_released_after_writeback":
            newState.leaseReleasesAfterWriteback++;
            newState.status = "completed";
            break;
        default:
            break;
    }
    return newState;
};
/**
 * Creates a WorkerStatusProjection instance for use with ProjectionRebuildService
 */
export function createWorkerStatusProjectionHandler() {
    return workerStatusProjectionHandler;
}
//# sourceMappingURL=worker-status-projection.js.map