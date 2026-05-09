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
  // R12-10: Set of processed event IDs for O(1) idempotency check
  processedEventIds: ReadonlySet<string>;
  /** First event timestamp */
  firstEventAt: string | null;
  /** Last event timestamp */
  lastEventAt: string | null;
  // R12-11: Freshness tracking
  lastProjectedAt: string | null;
  lagMs: number | null;
  stale: boolean;
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
    // R12-10: Use Set instead of array for O(1) idempotency lookup
    processedEventIds: new Set<string>(),
    firstEventAt: null,
    lastEventAt: null,
    // R12-11: Initialize freshness tracking
    lastProjectedAt: null,
    lagMs: null,
    stale: false,
  };
}

/**
 * Checks if an event has already been processed (idempotency check).
 * R12-10: Uses Set.has() for O(1) lookup instead of O(n) array.includes()
 */
function isEventProcessed(state: ArtifactCatalogState, eventId: string): boolean {
  return state.processedEventIds.has(eventId);
}

/**
 * Computes freshness metadata (lagMs, stale, lastProjectedAt).
 */
function computeFreshness(state: ArtifactCatalogState, occurredAt: string): ArtifactCatalogState {
  const nowMs = Date.now();
  const eventTimeMs = new Date(occurredAt).getTime();
  const lagMs = nowMs - eventTimeMs;
  const STALE_THRESHOLD_MS = 300_000; // 5 minutes

  return {
    ...state,
    lastProjectedAt: occurredAt,
    lagMs,
    stale: lagMs > STALE_THRESHOLD_MS,
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
  // Initialize state if null
  const currentState = state as unknown as ArtifactCatalogState | null;
  const newState = currentState ? { ...currentState } : createEmptyArtifactCatalogState();

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return newState as unknown as Record<string, unknown>;
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

  // R12-10: Mark event as processed using Set for O(1) lookup
  newState.processedEventIds = new Set([...newState.processedEventIds, event.eventId]);
  newState.eventCount = newState.eventCount + 1;

  // R12-11: Compute freshness metadata
  const stateWithFreshness = computeFreshness(newState, event.createdAt);
  Object.assign(newState, stateWithFreshness);

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

  return newState as unknown as Record<string, unknown>;
};

/**
 * Creates an ArtifactCatalogProjection instance for use with ProjectionRebuildService
 */
export function createArtifactCatalogProjectionHandler(): ProjectionHandler {
  return artifactCatalogProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
