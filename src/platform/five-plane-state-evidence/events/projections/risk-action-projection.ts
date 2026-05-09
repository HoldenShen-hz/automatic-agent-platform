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

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

/**
 * Risk Action Projection State
 *
 * Tracks risk decisions and their outcomes including:
 * - Decision details and risk level
 * - Actions taken (allow/deny/block/escalate)
 * - Outcome verification
 * - Policy matches
 */
export interface RiskActionState {
  /** Risk decision/evaluation ID */
  riskDecisionId: string | null;
  /** Associated task ID */
  taskId: string | null;
  /** Associated execution ID */
  executionId: string | null;
  /** Associated workflow ID */
  workflowId: string | null;
  /** Risk level of the action */
  riskLevel: string | null;
  /** Action taken by the risk engine */
  action: RiskActionType | null;
  /** Current status of the risk decision */
  status: RiskDecisionStatus;
  /** Matched policy IDs */
  policyIds: string[];
  /** Risk score (0-1) */
  riskScore: number | null;
  /** Whether the action was confirmed */
  confirmed: boolean;
  /** Whether the action was overridden */
  overridden: boolean;
  /** Override reason if applicable */
  overrideReason: string | null;
  /** Who overrode the decision */
  overriddenBy: string | null;
  /** When the decision was made */
  decidedAt: string | null;
  /** When the action was completed */
  completedAt: string | null;
  /** Timeline of risk events in order */
  timeline: RiskActionTimelineEntry[];
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

export type RiskActionType = "allow" | "deny" | "block" | "escalate" | "review" | "quarantine";

export type RiskDecisionStatus =
  | "pending"
  | "decided"
  | "confirmed"
  | "overridden"
  | "completed"
  | "expired";

/**
 * Timeline entry for risk events
 */
export interface RiskActionTimelineEntry {
  eventId: string;
  eventType: string;
  timestamp: string;
  actorId: string | null;
  action: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Creates a new empty RiskActionState
 */
export function createEmptyRiskActionState(): RiskActionState {
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
function isEventProcessed(state: RiskActionState, eventId: string): boolean {
  return state.processedEventIds.has(eventId);
}

/**
 * Computes freshness metadata (lagMs, stale, lastProjectedAt).
 */
function computeFreshness(state: RiskActionState, occurredAt: string): RiskActionState {
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
 * Adds a unique policy ID
 */
function addUniquePolicyId(existing: string[], policyId: string): string[] {
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
export const riskActionProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null
  const currentState = state as unknown as RiskActionState | null;
  const newState = currentState ? { ...currentState } : createEmptyRiskActionState();

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return newState as unknown as Record<string, unknown>;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);

  // Update IDs if not set
  if (newState.riskDecisionId === null) {
    newState.riskDecisionId =
      (payload.riskDecisionId as string | undefined) ??
      (payload.decisionId as string | undefined) ??
      (payload.violationId as string | undefined) ??
      null;
  }
  if (newState.taskId === null && event.taskId !== null) {
    newState.taskId = event.taskId;
  }
  if (newState.executionId === null) {
    newState.executionId = (payload.executionId as string | null | undefined) ?? null;
  }
  if (newState.workflowId === null) {
    newState.workflowId = (payload.workflowId as string | null | undefined) ?? null;
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
  const timelineEntry: RiskActionTimelineEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    actorId: (payload.actorId as string | null | undefined) ?? null,
    action: inferAction(event.eventType),
    details: Object.keys(details).length > 0 ? details : null,
  };
  newState.timeline = [...newState.timeline, timelineEntry];

  // R12-10: Mark event as processed using Set for O(1) lookup
  newState.processedEventIds = new Set([...newState.processedEventIds, event.eventId]);
  newState.eventCount = newState.eventCount + 1;

  // R12-11: Compute freshness metadata
  const stateWithFreshness = computeFreshness(newState, event.createdAt);
  Object.assign(newState, stateWithFreshness);

  // Update risk metadata
  if (newState.riskLevel === null) {
    newState.riskLevel = (payload.riskLevel as string | undefined) ?? null;
  }
  if (newState.riskScore === null) {
    const score = payload.riskScore ?? payload.risk_score ?? payload.score;
    newState.riskScore = typeof score === "number" ? score : null;
  }

  // Update policy IDs
  const policyId = payload.policyId as string | undefined;
  if (policyId) {
    newState.policyIds = addUniquePolicyId(newState.policyIds, policyId);
  }
  const policyIds = payload.policyIds as string[] | undefined;
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
      const action = payload.action as RiskActionType | undefined;
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
      newState.overrideReason = (payload.reason as string | null | undefined) ?? null;
      newState.overriddenBy = (payload.overriddenBy as string | null | undefined) ?? null;
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
        newState.riskLevel = (payload.severity as string | undefined) ?? "high";
      }
      break;

    default:
      break;
  }

  return newState as unknown as Record<string, unknown>;
};

/**
 * Infers action from event type
 */
function inferAction(eventType: string): string | null {
  if (eventType.includes("allow")) return "allow";
  if (eventType.includes("deny")) return "deny";
  if (eventType.includes("block")) return "block";
  if (eventType.includes("escalate")) return "escalate";
  if (eventType.includes("quota")) return "block";
  if (eventType.includes("violation")) return "quarantine";
  return null;
}

/**
 * Creates a RiskActionProjection instance for use with ProjectionRebuildService
 */
export function createRiskActionProjectionHandler(): ProjectionHandler {
  return riskActionProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
