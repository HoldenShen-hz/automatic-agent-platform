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

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

/**
 * Governance Projection State
 *
 * Tracks governance decisions and changes including:
 * - Policy modifications
 * - Compliance events
 * - Approval flow state changes
 * - Delegation changes
 */
export interface GovernanceState {
  /** Entity ID this governance event applies to */
  entityId: string | null;
  /** Entity kind (policy, approval, delegation, compliance, etc.) */
  entityKind: string | null;
  /** Associated tenant ID */
  tenantId: string | null;
  /** Associated task ID */
  taskId: string | null;
  /** Associated execution ID */
  executionId: string | null;
  /** Type of governance action */
  actionType: GovernanceActionType | null;
  /** Current status */
  status: GovernanceStatus;
  /** Principal (user/system) that triggered the action */
  principal: string | null;
  /** Policy ID if applicable */
  policyId: string | null;
  /** Compliance framework if applicable */
  complianceFramework: string | null;
  /** Whether the action was approved */
  approved: boolean | null;
  /** Reason or justification */
  reason: string | null;
  /** When the governance action occurred */
  occurredAt: string | null;
  /** Timeline of governance events in order */
  timeline: GovernanceTimelineEntry[];
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

export type GovernanceActionType =
  | "policy_created"
  | "policy_updated"
  | "policy_deleted"
  | "approval_granted"
  | "approval_denied"
  | "delegation_created"
  | "delegation_completed"
  | "delegation_failed"
  | "compliance_violation"
  | "compliance_resolved"
  | "permission_granted"
  | "permission_revoked"
  | "role_assigned"
  | "role_removed"
  | "config_changed"
  | "escalation_triggered";

export type GovernanceStatus =
  | "pending"
  | "active"
  | "approved"
  | "denied"
  | "resolved"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Timeline entry for governance events
 */
export interface GovernanceTimelineEntry {
  eventId: string;
  eventType: string;
  timestamp: string;
  actorId: string | null;
  actionType: GovernanceActionType | null;
  details: Record<string, unknown> | null;
}

/**
 * Creates a new empty GovernanceState
 */
export function createEmptyGovernanceState(): GovernanceState {
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
function isEventProcessed(state: GovernanceState, eventId: string): boolean {
  return state.processedEventIds.has(eventId);
}

/**
 * Computes freshness metadata (lagMs, stale, lastProjectedAt).
 */
function computeFreshness(state: GovernanceState, occurredAt: string): GovernanceState {
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
 * Maps event type to governance action type
 */
function mapEventToActionType(eventType: string, payload: Record<string, unknown>): GovernanceActionType | null {
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
      if (eventType.includes("policy")) return "policy_updated";
      if (eventType.includes("approval") || eventType.includes("decision")) return "approval_granted";
      if (eventType.includes("delegation")) return "delegation_created";
      if (eventType.includes("compliance") || eventType.includes("violation")) return "compliance_violation";
      if (eventType.includes("permission")) return "permission_granted";
      if (eventType.includes("role")) return "role_assigned";
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
export const governanceProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null
  const currentState = state as unknown as GovernanceState | null;
  const newState = currentState ? { ...currentState } : createEmptyGovernanceState();

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return newState as unknown as Record<string, unknown>;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);

  // Update IDs if not set
  if (newState.entityId === null) {
    newState.entityId =
      (payload.policyId as string | undefined) ??
      (payload.approvalId as string | undefined) ??
      (payload.delegationId as string | undefined) ??
      (payload.configId as string | undefined) ??
      (payload.violationId as string | undefined) ??
      null;
  }
  if (newState.entityKind === null) {
    newState.entityKind = (payload.entityKind as string | undefined) ?? inferEntityKind(event.eventType);
  }
  if (newState.taskId === null && event.taskId !== null) {
    newState.taskId = event.taskId;
  }
  if (newState.executionId === null) {
    newState.executionId = (payload.executionId as string | null | undefined) ?? null;
  }
  if (newState.tenantId === null) {
    newState.tenantId = (payload.tenantId as string | null | undefined) ?? null;
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
  const details: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (key !== "traceContext") {
      details[key] = payload[key];
    }
  }

  // Add to timeline
  const timelineEntry: GovernanceTimelineEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    actorId: (payload.actorId as string | null | undefined) ?? (payload.principal as string | null | undefined) ?? null,
    actionType: newState.actionType,
    details: Object.keys(details).length > 0 ? details : null,
  };
  newState.timeline = [...newState.timeline, timelineEntry];

  // R12-10: Mark event as processed using Set for O(1) lookup
  newState.processedEventIds = new Set([...newState.processedEventIds, event.eventId]);
  newState.eventCount = newState.eventCount + 1;

  // R12-11: Compute freshness metadata
  const stateWithFreshness = computeFreshness(newState, event.createdAt);
  Object.assign(newState, stateWithFreshness);

  // Update metadata
  if (newState.principal === null) {
    newState.principal =
      (payload.actorId as string | undefined) ??
      (payload.principal as string | undefined) ??
      (payload.respondedBy as string | undefined) ??
      null;
  }
  if (newState.policyId === null) {
    newState.policyId = (payload.policyId as string | undefined) ?? null;
  }
  if (newState.complianceFramework === null) {
    newState.complianceFramework = (payload.framework as string | undefined) ?? (payload.complianceFramework as string | undefined) ?? null;
  }
  if (newState.reason === null) {
    newState.reason = (payload.reason as string | undefined) ?? (payload.reasonCode as string | undefined) ?? null;
  }
  if (newState.occurredAt === null) {
    newState.occurredAt = (payload.occurredAt as string | undefined) ?? event.createdAt;
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

  return newState as unknown as Record<string, unknown>;
};

/**
 * Infers entity kind from event type
 */
function inferEntityKind(eventType: string): string | null {
  if (eventType.includes("policy")) return "policy";
  if (eventType.includes("approval") || eventType.includes("decision")) return "approval";
  if (eventType.includes("delegation")) return "delegation";
  if (eventType.includes("compliance") || eventType.includes("violation")) return "compliance";
  if (eventType.includes("permission")) return "permission";
  if (eventType.includes("role")) return "role";
  if (eventType.includes("config")) return "config";
  return null;
}

/**
 * Creates a GovernanceProjection instance for use with ProjectionRebuildService
 */
export function createGovernanceProjectionHandler(): ProjectionHandler {
  return governanceProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
