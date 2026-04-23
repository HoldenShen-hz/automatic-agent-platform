/**
 * @fileoverview Incident Projection
 *
 * Tracks incident state with affected entity linking.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Incident linking: affected workflows, executions, workers, rollouts, repair jobs
 *
 * @see ProjectionRebuildService: ../../projections/projection-rebuild-service.ts
 * @see event-registry: ../event-registry.ts
 */
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
/**
 * Incident Projection State
 *
 * Tracks the complete lifecycle of an incident including:
 * - Incident metadata (incidentId, severity, status)
 * - Affected entity linking (workflows, executions, workers, rollouts, repair jobs)
 * - Timeline of events
 * - Resolution tracking
 */
export interface IncidentState {
    /** Unique identifier for this incident */
    incidentId: string | null;
    /** Incident severity level */
    severity: IncidentSeverity | null;
    /** Current status of the incident */
    status: IncidentStatus;
    /** Timeline of events in order */
    timeline: IncidentTimelineEntry[];
    /** Affected workflow IDs */
    affectedWorkflows: string[];
    /** Affected execution IDs */
    affectedExecutions: string[];
    /** Affected worker IDs */
    affectedWorkers: string[];
    /** Affected rollout IDs */
    affectedRollouts: string[];
    /** Affected repair job IDs */
    affectedRepairJobs: string[];
    /** Count of all events processed */
    eventCount: number;
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
    /** Detected timestamp */
    detectedAt: string | null;
    /** Resolved timestamp */
    resolvedAt: string | null;
    /** Acknowledged timestamp */
    acknowledgedAt: string | null;
    /** Root cause if determined */
    rootCause: string | null;
    /** Incident description */
    description: string | null;
    /** Compliance framework if applicable */
    complianceFramework: string | null;
}
export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "detected" | "acknowledged" | "investigating" | "mitigated" | "resolved" | "cancelled";
/**
 * Timeline entry for incident events
 */
export interface IncidentTimelineEntry {
    eventId: string;
    eventType: string;
    timestamp: string;
    actorId: string | null;
    action: string | null;
    details: Record<string, unknown> | null;
}
/**
 * Operator action log entry for audit trail
 */
export interface OperatorActionLogEntry {
    actionId: string;
    operatorId: string;
    action: string;
    timestamp: string;
    details: Record<string, unknown> | null;
}
/**
 * Creates a new empty IncidentState
 */
export declare function createEmptyIncidentState(): IncidentState;
/**
 * Incident Projection Handler
 *
 * Implements ProjectionHandler interface for incident state management.
 * Handles events:
 * - incident:created - New incident detection
 * - incident:acknowledged - Incident acknowledged by operator
 * - incident:investigating - Investigation started
 * - incident:mitigated - Mitigation applied
 * - incident:resolved - Incident resolved
 * - incident:cancelled - Incident cancelled
 * - compliance:violation_detected - Compliance violation (creates incident)
 * - slo:breached - SLO breach (creates incident)
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export declare const incidentProjectionHandler: ProjectionHandler;
/**
 * Creates an IncidentProjection instance for use with ProjectionRebuildService
 */
export declare function createIncidentProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
