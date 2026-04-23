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
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
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
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
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
export declare function createEmptyArtifactCatalogState(): ArtifactCatalogState;
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
export declare const artifactCatalogProjectionHandler: ProjectionHandler;
/**
 * Creates an ArtifactCatalogProjection instance for use with ProjectionRebuildService
 */
export declare function createArtifactCatalogProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
