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

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

/**
 * Artifact Catalog Projection State
 *
 * Tracks artifacts including:
 * - Artifact metadata and type
 * - Version tracking
 * - References from workflow runs and steps
 * - Provenance lineage
 */
export interface ArtifactCatalogState {
  /** Artifact ID */
  artifactId: string | null;
  /** Artifact type */
  artifactType: string | null;
  /** Artifact name or key */
  artifactName: string | null;
  /** Content hash for deduplication */
  contentHash: string | null;
  /** Size in bytes if known */
  sizeBytes: number | null;
  /** MIME type */
  mimeType: string | null;
  /** Current version number */
  version: number;
  /** Status of the artifact */
  status: ArtifactStatus;
  /** Associated workflow run ID */
  workflowRunId: string | null;
  /** Associated step ID */
  stepId: string | null;
  /** Associated task ID */
  taskId: string | null;
  /** Who created the artifact */
  createdBy: string | null;
  /** Creation timestamp */
  createdAt: string | null;
  /** Last update timestamp */
  updatedAt: string | null;
  /** References to this artifact from other entities */
  references: ArtifactReference[];
  /** Timeline of events in order */
  timeline: ArtifactCatalogTimelineEntry[];
  /** Count of all events processed */
  eventCount: number;
  /**
   * Set of processed event IDs for idempotency (O(1) lookup).
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
}

/**
 * Internal state with Set for O(1) idempotency checks.
 */
interface ArtifactCatalogStateInternal extends Omit<ArtifactCatalogState, "processedEventIds"> {
  _processedEventIdSet: Set<string>;
}

export type ArtifactStatus = "created" | "updated" | "sealed" | "deleted" | "archived";

/**
 * Reference to another entity
 */
export interface ArtifactReference {
  referenceType: string;
  referenceId: string;
  referencePath: string | null;
  addedAt: string;
}

/**
 * Timeline entry for artifact events
 */
export interface ArtifactCatalogTimelineEntry {
  eventId: string;
  eventType: string;
  timestamp: string;
  actorId: string | null;
  action: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Creates a new empty ArtifactCatalogState
 */
export function createEmptyArtifactCatalogState(): ArtifactCatalogState {
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
    lastProjectedAt: null,
    lagMs: null,
    stale: false,
  };
}

/**
 * Converts serialized state (with array) to internal state (with Set for O(1) lookup).
 */
function toInternalState(state: ArtifactCatalogState): ArtifactCatalogStateInternal {
  return {
    ...state,
    _processedEventIdSet: new Set(state.processedEventIds),
  };
}

/**
 * Converts internal state (with Set) back to serialized state (with array for JSON).
 */
function toSerializedState(state: ArtifactCatalogStateInternal): ArtifactCatalogState {
  const {
    _processedEventIdSet,
    processedEventIds: _staleProcessedEventIds,
    ...rest
  } = state as ArtifactCatalogStateInternal & { processedEventIds?: string[] };
  const serialized = { ...rest } as ArtifactCatalogState;
  serialized.processedEventIds = [..._processedEventIdSet];
  return serialized;
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
 * Checks if an event has already been processed (idempotency check).
 * Uses O(1) Set lookup for efficiency.
 */
function isEventProcessed(state: ArtifactCatalogStateInternal, eventId: string): boolean {
  return state._processedEventIdSet.has(eventId);
}

/**
 * Adds a unique reference to the artifact
 */
function addUniqueReference(
  existing: ArtifactReference[],
  newRef: ArtifactReference,
): ArtifactReference[] {
  const duplicate = existing.some(
    (r) => r.referenceType === newRef.referenceType && r.referenceId === newRef.referenceId,
  );
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
export const artifactCatalogProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null, convert to internal state with Set for O(1) lookup
  const currentState = state as unknown as ArtifactCatalogState | null;
  const baseState = currentState ? { ...currentState } : createEmptyArtifactCatalogState();
  const newState = toInternalState(baseState);

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return toSerializedState(newState) as unknown as Record<string, unknown>;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);

  // Update IDs if not set
  if (newState.artifactId === null) {
    newState.artifactId =
      (payload.artifactId as string | undefined) ??
      (payload.artifact_ref as string | undefined) ??
      (payload.artifactKey as string | undefined) ??
      null;
  }
  if (newState.taskId === null && event.taskId !== null) {
    newState.taskId = event.taskId;
  }
  if (newState.workflowRunId === null) {
    newState.workflowRunId = (payload.workflowRunId as string | null | undefined) ?? null;
  }
  if (newState.stepId === null) {
    newState.stepId = (payload.stepId as string | null | undefined) ?? null;
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
    newState.stale = newState.lagMs > 300000;
  }

  // Extract details for timeline
  const details: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (key !== "traceContext") {
      details[key] = payload[key];
    }
  }

  // Add to timeline
  const timelineEntry: ArtifactCatalogTimelineEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    actorId: (payload.actorId as string | null | undefined) ?? null,
    action: (payload.action as string | null | undefined) ?? event.eventType,
    details: Object.keys(details).length > 0 ? details : null,
  };
  newState.timeline = [...newState.timeline, timelineEntry];

  // Mark event as processed using O(1) Set add
  newState._processedEventIdSet.add(event.eventId);
  newState.eventCount = newState.eventCount + 1;

  // Update artifact metadata
  if (newState.artifactType === null) {
    newState.artifactType = (payload.artifactType as string | undefined) ?? null;
  }
  if (newState.artifactName === null) {
    newState.artifactName = (payload.artifactName as string | undefined) ?? null;
  }
  if (newState.contentHash === null) {
    newState.contentHash = (payload.contentHash as string | undefined) ?? null;
  }
  if (newState.sizeBytes === null) {
    const size = payload.sizeBytes ?? payload.size;
    newState.sizeBytes = typeof size === "number" ? size : null;
  }
  if (newState.mimeType === null) {
    newState.mimeType = (payload.mimeType as string | undefined) ?? null;
  }
  if (newState.createdBy === null) {
    newState.createdBy = (payload.createdBy as string | undefined) ?? null;
  }
  if (newState.createdAt === null) {
    newState.createdAt = event.createdAt;
  }
  newState.updatedAt = event.createdAt;

  // Handle artifact references
  const refType = payload.referenceType as string | undefined;
  const refId = payload.referenceId as string | undefined;
  if (refType && refId) {
    const ref: ArtifactReference = {
      referenceType: refType,
      referenceId: refId,
      referencePath: (payload.referencePath as string | undefined) ?? null,
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
      // §191-2244: Removed automatic version increment. Version should only change
      // when content实质性 changes (handled by artifact:sealed or explicit version bump),
      // not on every update event which may include metadata-only changes.
      newState.status = "updated";
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

  return toSerializedState(newState) as unknown as Record<string, unknown>;
};

/**
 * Creates an ArtifactCatalogProjection instance for use with ProjectionRebuildService
 */
export function createArtifactCatalogProjectionHandler(): ProjectionHandler {
  return artifactCatalogProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
