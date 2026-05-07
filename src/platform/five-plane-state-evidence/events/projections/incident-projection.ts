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

import type { UnifiedSeverity } from "../../../contracts/types/unified-severity.js";
import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

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

/**
 * Internal state with Set for O(1) idempotency checks.
 */
interface IncidentStateInternal extends Omit<IncidentState, "processedEventIds"> {
  _processedEventIdSet: Set<string>;
}

// R14-02: Use unified SEV naming per §12.2 (SEV1-4 instead of low/medium/high/critical)
export type IncidentSeverity = UnifiedSeverity;
export type IncidentStatus =
  | "detected"
  | "acknowledged"
  | "investigating"
  | "mitigated"
  | "resolved"
  | "cancelled"
  | "dismissed"; // R14-24: Added dismissed status alongside acknowledged

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
export function createEmptyIncidentState(): IncidentState {
  return {
    incidentId: null,
    severity: null,
    status: "detected",
    timeline: [],
    affectedWorkflows: [],
    affectedExecutions: [],
    affectedWorkers: [],
    affectedRollouts: [],
    affectedRepairJobs: [],
    eventCount: 0,
    processedEventIds: [],
    firstEventAt: null,
    lastEventAt: null,
    lastProjectedAt: null,
    lagMs: null,
    stale: false,
    detectedAt: null,
    resolvedAt: null,
    acknowledgedAt: null,
    rootCause: null,
    description: null,
    complianceFramework: null,
  };
}

/**
 * Converts serialized state (with array) to internal state (with Set for O(1) lookup).
 */
function toInternalState(state: IncidentState): IncidentStateInternal {
  return {
    ...state,
    _processedEventIdSet: new Set(state.processedEventIds),
  };
}

/**
 * Converts internal state (with Set) back to serialized state (with array for JSON).
 */
function toSerializedState(state: IncidentStateInternal): IncidentState {
  return {
    ...state,
    processedEventIds: Array.from(state._processedEventIdSet),
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
 * Checks if an event has already been processed (idempotency check).
 * Uses O(1) Set lookup for efficiency.
 */
function isEventProcessed(state: IncidentStateInternal, eventId: string): boolean {
  return state._processedEventIdSet.has(eventId);
}

/**
 * Extracts affected entity IDs from event payload
 */
function extractAffectedEntities(
  payload: Record<string, unknown>,
): {
  workflows: string[];
  executions: string[];
  workers: string[];
  rollouts: string[];
  repairJobs: string[];
} {
  return {
    workflows: extractStringArray(payload.affectedWorkflows ?? payload.workflowIds),
    executions: extractStringArray(payload.affectedExecutions ?? payload.executionIds),
    workers: extractStringArray(payload.affectedWorkers ?? payload.workerIds),
    rollouts: extractStringArray(payload.affectedRollouts ?? payload.rolloutIds),
    repairJobs: extractStringArray(payload.affectedRepairJobs ?? payload.repairJobIds),
  };
}

/**
 * Safely extracts a string array from a payload field
 */
function extractStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

/**
 * Adds an entity ID to an array if not already present
 */
function addUniqueEntity(existing: string[], newId: string): string[] {
  return existing.includes(newId) ? existing : [...existing, newId];
}

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
export const incidentProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null, convert to internal state with Set for O(1) lookup
  const currentState = state as unknown as IncidentState | null;
  const baseState = currentState ? { ...currentState } : createEmptyIncidentState();
  const newState = toInternalState(baseState);

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return toSerializedState(newState) as unknown as Record<string, unknown>;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);

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

  // Add to timeline
  const timelineEntry: IncidentTimelineEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    actorId: (payload.actorId as string | null) ?? null,
    action: (payload.action as string | null) ?? null,
    details: payload.actionDetails ? (payload.actionDetails as Record<string, unknown>) : null,
  };
  newState.timeline = [...newState.timeline, timelineEntry];

  // Mark event as processed using O(1) Set add
  newState._processedEventIdSet.add(event.eventId);
  newState.eventCount = newState.eventCount + 1;

  // Extract and link affected entities
  const affected = extractAffectedEntities(payload);
  for (const workflowId of affected.workflows) {
    newState.affectedWorkflows = addUniqueEntity(newState.affectedWorkflows, workflowId);
  }
  for (const executionId of affected.executions) {
    newState.affectedExecutions = addUniqueEntity(newState.affectedExecutions, executionId);
  }
  for (const workerId of affected.workers) {
    newState.affectedWorkers = addUniqueEntity(newState.affectedWorkers, workerId);
  }
  for (const rolloutId of affected.rollouts) {
    newState.affectedRollouts = addUniqueEntity(newState.affectedRollouts, rolloutId);
  }
  for (const repairJobId of affected.repairJobs) {
    newState.affectedRepairJobs = addUniqueEntity(newState.affectedRepairJobs, repairJobId);
  }

  // Update state based on event type
  switch (event.eventType) {
    case "incident:created":
      handleIncidentCreated(newState, payload, event.createdAt);
      break;

    case "incident:acknowledged":
      handleIncidentAcknowledged(newState, payload, event.createdAt);
      break;

    case "incident:investigating":
      handleIncidentInvestigating(newState, payload, event.createdAt);
      break;

    case "incident:mitigated":
      handleIncidentMitigated(newState, payload, event.createdAt);
      break;

    case "incident:resolved":
      handleIncidentResolved(newState, payload, event.createdAt);
      break;

    case "incident:cancelled":
      handleIncidentCancelled(newState, payload, event.createdAt);
      break;

    // R14-24: Handle dismissed status for incidents
    case "incident:dismissed":
      handleIncidentDismissed(newState, payload, event.createdAt);
      break;

    case "compliance:violation_detected":
      handleComplianceViolation(newState, payload, event.createdAt);
      break;

    case "slo:breached":
      handleSloBreached(newState, payload, event.createdAt);
      break;

    default:
      // No specific handling for other event types
      break;
  }

  return newState as unknown as Record<string, unknown>;
};

/**
 * Handle incident:created event
 */
function handleIncidentCreated(
  state: IncidentStateInternal,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  if (state.incidentId === null) {
    state.incidentId = (payload.incidentId as string | undefined) ?? null;
  }
  if (state.severity === null) {
    const severity = payload.severity as IncidentSeverity | undefined;
    if (severity) {
      state.severity = severity;
    }
  }
  if (state.description === null) {
    state.description = (payload.description as string | null) ?? null;
  }
  if (state.detectedAt === null) {
    state.detectedAt = timestamp;
  }
  state.status = "detected";
}

/**
 * Handle incident:acknowledged event
 */
function handleIncidentAcknowledged(
  state: IncidentStateInternal,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  if (state.acknowledgedAt === null) {
    state.acknowledgedAt = timestamp;
  }
  state.status = "acknowledged";
}

/**
 * Handle incident:investigating event
 */
function handleIncidentInvestigating(
  state: IncidentStateInternal,
  payload: Record<string, unknown>,
  _timestamp: string,
): void {
  state.status = "investigating";
  if (state.rootCause === null) {
    state.rootCause = (payload.rootCause as string | null) ?? null;
  }
}

/**
 * Handle incident:mitigated event
 */
function handleIncidentMitigated(
  state: IncidentStateInternal,
  payload: Record<string, unknown>,
  _timestamp: string,
): void {
  state.status = "mitigated";
  if (state.rootCause === null) {
    state.rootCause = (payload.rootCause as string | null) ?? null;
  }
}

/**
 * Handle incident:resolved event
 */
function handleIncidentResolved(
  state: IncidentStateInternal,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  state.status = "resolved";
  state.resolvedAt = timestamp;
  if (state.rootCause === null) {
    state.rootCause = (payload.rootCause as string | null) ?? null;
  }
}

/**
 * Handle incident:cancelled event
 */
function handleIncidentCancelled(
  state: IncidentStateInternal,
  _payload: Record<string, unknown>,
  timestamp: string,
): void {
  state.status = "cancelled";
  state.resolvedAt = timestamp;
}

/**
 * R14-24: Handle incident:dismissed event
 * Dismissed is a terminal state like resolved/cancelled but doesn't set resolvedAt
 * since the incident was not actually resolved, just dismissed as not requiring action.
 */
function handleIncidentDismissed(
  state: IncidentStateInternal,
  _payload: Record<string, unknown>,
  timestamp: string,
): void {
  state.status = "dismissed";
  state.lastProjectedAt = timestamp;
}

/**
 * Handle compliance:violation_detected event (creates incident)
 */
function handleComplianceViolation(
  state: IncidentStateInternal,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  if (state.incidentId === null) {
    state.incidentId = (payload.violationId as string | undefined) ?? null;
  }
  if (state.severity === null) {
    const severity = payload.severity as IncidentSeverity | undefined;
    if (severity) {
      state.severity = severity;
    }
  }
  if (state.description === null) {
    state.description = (payload.description as string | null) ?? null;
  }
  if (state.complianceFramework === null) {
    state.complianceFramework = (payload.framework as string | null) ?? null;
  }
  if (state.detectedAt === null) {
    state.detectedAt = timestamp;
  }
  // Link affected resource
  const resourceId = payload.resourceId as string | undefined;
  if (resourceId && !state.affectedExecutions.includes(resourceId)) {
    state.affectedExecutions = [...state.affectedExecutions, resourceId];
  }
}

/**
 * Handle slo:breached event (creates incident)
 */
function handleSloBreached(
  state: IncidentStateInternal,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  if (state.incidentId === null) {
    state.incidentId = (payload.sloId as string | undefined) ?? null;
  }
  // R14-02: SLO breaches are typically SEV2 (high) severity
  if (state.severity === null) {
    state.severity = "SEV2";
  }
  if (state.description === null) {
    const sloName = payload.sloName as string | undefined;
    const metricName = payload.metricName as string | undefined;
    const currentValue = payload.currentValue;
    const targetValue = payload.targetValue;
    state.description = `SLO breach: ${sloName ?? "unknown"} (${metricName ?? "metric"}: ${currentValue} vs ${targetValue} target)`;
  }
  if (state.detectedAt === null) {
    state.detectedAt = timestamp;
  }
}

/**
 * Creates an IncidentProjection instance for use with ProjectionRebuildService
 */
export function createIncidentProjectionHandler(): ProjectionHandler {
  return incidentProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
