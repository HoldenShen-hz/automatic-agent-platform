/**
 * @fileoverview Artifact Catalog Projection
 *
 * Tracks artifact references and versions across workflow runs.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Artifact catalog linked to workflow_run/step
 *
 * §28 architecture: artifact_catalog_projection
 *
 * Note: Artifact events are not yet defined in the event registry.
 * This projection handles generic artifact events and future artifact:*
 * namespace events.
 */
/**
 * Creates a new empty ArtifactCatalogState
 */
export function createEmptyArtifactCatalogState() {
    return {
        artifactId: null,
        artifactType: null,
        artifactName: null,
        contentHash: null,
        sizeBytes: null,
        mimeType: null,
        version: 1,
        status: "created",
        workflowRunId: null,
        stepId: null,
        taskId: null,
        createdBy: null,
        createdAt: null,
        updatedAt: null,
        references: [],
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
 * Adds a unique reference to the artifact
 */
function addUniqueReference(existing, newRef) {
    const duplicate = existing.some((r) => r.referenceType === newRef.referenceType && r.referenceId === newRef.referenceId);
    return duplicate ? existing : [...existing, newRef];
}
/**
 * Artifact Catalog Projection Handler
 *
 * Implements ProjectionHandler interface for artifact catalog tracking.
 * Handles artifact-related events including:
 * - artifact:created - Artifact created
 * - artifact:updated - Artifact updated
 * - artifact:sealed - Artifact sealed (immutable)
 * - artifact:referenced - Artifact referenced by workflow/step
 * - workflow:artifact_linked - Artifact linked from workflow event
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const artifactCatalogProjectionHandler = (state, event) => {
    // Initialize state if null
    const currentState = state;
    const newState = currentState ? { ...currentState } : createEmptyArtifactCatalogState();
    // Idempotency check - skip already processed events
    if (isEventProcessed(newState, event.eventId)) {
        return newState;
    }
    // Parse payload
    const payload = parsePayload(event.payloadJson);
    // Update IDs if not set
    if (newState.artifactId === null) {
        newState.artifactId =
            payload.artifactId ??
                payload.artifact_ref ??
                payload.artifactKey ??
                null;
    }
    if (newState.taskId === null && event.taskId !== null) {
        newState.taskId = event.taskId;
    }
    if (newState.workflowRunId === null) {
        newState.workflowRunId = payload.workflowRunId ?? null;
    }
    if (newState.stepId === null) {
        newState.stepId = payload.stepId ?? null;
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
        action: payload.action ?? event.eventType,
        details: Object.keys(details).length > 0 ? details : null,
    };
    newState.timeline = [...newState.timeline, timelineEntry];
    // Mark event as processed
    newState.processedEventIds = [...newState.processedEventIds, event.eventId];
    newState.eventCount = newState.eventCount + 1;
    // Update artifact metadata
    if (newState.artifactType === null) {
        newState.artifactType = payload.artifactType ?? null;
    }
    if (newState.artifactName === null) {
        newState.artifactName = payload.artifactName ?? null;
    }
    if (newState.contentHash === null) {
        newState.contentHash = payload.contentHash ?? null;
    }
    if (newState.sizeBytes === null) {
        const size = payload.sizeBytes ?? payload.size;
        newState.sizeBytes = typeof size === "number" ? size : null;
    }
    if (newState.mimeType === null) {
        newState.mimeType = payload.mimeType ?? null;
    }
    if (newState.createdBy === null) {
        newState.createdBy = payload.createdBy ?? null;
    }
    if (newState.createdAt === null) {
        newState.createdAt = event.createdAt;
    }
    newState.updatedAt = event.createdAt;
    // Handle artifact references
    const refType = payload.referenceType;
    const refId = payload.referenceId;
    if (refType && refId) {
        const ref = {
            referenceType: refType,
            referenceId: refId,
            referencePath: payload.referencePath ?? null,
            addedAt: event.createdAt,
        };
        newState.references = addUniqueReference(newState.references, ref);
    }
    // Update state based on event type
    switch (event.eventType) {
        case "artifact:created":
        case "workflow:artifact_linked":
            newState.status = "created";
            break;
        case "artifact:updated":
            newState.status = "updated";
            newState.version++;
            break;
        case "artifact:sealed":
            newState.status = "sealed";
            break;
        case "artifact:deleted":
            newState.status = "deleted";
            break;
        case "artifact:archived":
            newState.status = "archived";
            break;
        default:
            // No specific handling for other event types
            break;
    }
    return newState;
};
/**
 * Creates an ArtifactCatalogProjection instance for use with ProjectionRebuildService
 */
export function createArtifactCatalogProjectionHandler() {
    return artifactCatalogProjectionHandler;
}
//# sourceMappingURL=artifact-catalog-projection.js.map