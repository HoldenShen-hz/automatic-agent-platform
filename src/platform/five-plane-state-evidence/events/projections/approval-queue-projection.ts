/**
 * @fileoverview Approval Queue Projection
 *
 * Tracks approval queue state with pending/decided/expired items.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Approval queue items linked to task/execution
 *
 * §28 architecture: approval_queue_projection
 */

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

// R20-07: Maximum size for processedEventIds before eviction
const MAX_PROCESSED_EVENT_IDS = 10_000;

/**
 * Approval Queue Projection State
 *
 * Tracks the complete lifecycle of an approval queue including:
 * - Queue items with status
 * - Approval decisions
 * - Quorum tracking for multi-party approvals
 * - Timeout and expiration
 */
export interface ApprovalQueueState {
  /** Approval ID */
  approvalId: string | null;
  /** Task ID associated with this approval */
  taskId: string | null;
  /** Execution ID associated with this approval */
  executionId: string | null;
  /** Current status of the approval request */
  status: ApprovalQueueStatus;
  /** Risk level of the request */
  riskLevel: string | null;
  /** Number of approvals received (for multi-party) */
  approvalsReceived: number;
  /** Number of approvals required (for multi-party) */
  approvalsRequired: number;
  /** Rejection count */
  rejectionsReceived: number;
  /** Who responded */
  respondedBy: string | null;
  /** When the request was created */
  createdAt: string | null;
  /** When the request was responded to */
  respondedAt: string | null;
  /** When the request expires */
  expiresAt: string | null;
  /** Timeline of events in order */
  timeline: ApprovalQueueTimelineEntry[];
  /** Count of all events processed */
  eventCount: number;
  // R12-10: Set of processed event IDs for O(1) idempotency check
  processedEventIds: ReadonlySet<string>;
  /** First event timestamp */
  firstEventAt: string | null;
  /** Last event timestamp */
  lastEventAt: string | null;
  /** R12-11: Timestamp when projection was last updated */
  lastProjectedAt: string | null;
  /** R12-11: Lag in milliseconds between event time and projection update */
  lagMs: number | null;
  /** R12-11: Whether this projection is considered stale (lag > 5 minutes) */
  stale: boolean;
  /** Decision type */
  decisionType: string | null;
  /** Selected option ID */
  selectedOptionId: string | null;
  /** Input text (for text_input decision type) */
  inputText: string | null;
  /** Whether this was a cascade denial */
  cascadeDeny: boolean;
  /** Source approval ID for cascade denials */
  cascadeSourceApprovalId: string | null;
  /** Session ID for cascade denials */
  cascadeSessionId: string | null;
}

export type ApprovalQueueStatus =
  | "requested"
  | "confirmed"
  | "rejected"
  | "expired"
  | "cancelled"
  | "text_input";

/**
 * Timeline entry for approval events
 */
export interface ApprovalQueueTimelineEntry {
  eventId: string;
  eventType: string;
  timestamp: string;
  actorId: string | null;
  decisionType: string | null;
}

/**
 * Creates a new empty ApprovalQueueState
 */
export function createEmptyApprovalQueueState(): ApprovalQueueState {
  return {
    approvalId: null,
    taskId: null,
    executionId: null,
    status: "requested",
    riskLevel: null,
    approvalsReceived: 0,
    approvalsRequired: 1,
    rejectionsReceived: 0,
    respondedBy: null,
    createdAt: null,
    respondedAt: null,
    expiresAt: null,
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
    decisionType: null,
    selectedOptionId: null,
    inputText: null,
    cascadeDeny: false,
    cascadeSourceApprovalId: null,
    cascadeSessionId: null,
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
 * R12-10: Uses Set.has() for O(1) lookup instead of O(n) array.includes()
 */
function isEventProcessed(state: ApprovalQueueState, eventId: string): boolean {
  return state.processedEventIds.has(eventId);
}

/**
 * Computes freshness metadata (lagMs, stale, lastProjectedAt).
 */
function computeFreshness(state: ApprovalQueueState, occurredAt: string): ApprovalQueueState {
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
 * Approval Queue Projection Handler
 *
 * Implements ProjectionHandler interface for approval queue state management.
 * Handles events:
 * - decision:requested - New approval request created
 * - decision:responded - Approval responded to
 * - decision:partial_approval - Partial approval received (multi-party)
 * - decision:approved - Final approval granted (multi-party)
 * - decision:rejected - Final rejection (multi-party)
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const approvalQueueProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null
  const currentState = state as unknown as ApprovalQueueState | null;
  const newState = currentState ? { ...currentState } : createEmptyApprovalQueueState();

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return newState as unknown as Record<string, unknown>;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);

  // Update approvalId if not set
  if (newState.approvalId === null) {
    newState.approvalId = (payload.approvalId as string | undefined) ?? null;
  }

  // Update taskId and executionId if not set
  if (newState.taskId === null && event.taskId !== null) {
    newState.taskId = event.taskId;
  }
  if (newState.executionId === null) {
    newState.executionId = (payload.executionId as string | null | undefined) ?? null;
  }

  // Update timestamps
  if (newState.firstEventAt === null) {
    newState.firstEventAt = event.createdAt;
  }
  newState.lastEventAt = event.createdAt;

  // Add to timeline
  const timelineEntry: ApprovalQueueTimelineEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    actorId: (payload.respondedBy as string | null | undefined) ?? null,
    decisionType: (payload.decisionType as string | null | undefined) ?? null,
  };
  newState.timeline = [...newState.timeline, timelineEntry];

  // R12-10: Mark event as processed using Set for O(1) lookup
  // R20-07: Evict oldest entries when size exceeds limit to prevent unbounded growth
  const processedEventIds = new Set(newState.processedEventIds);
  while (processedEventIds.size >= MAX_PROCESSED_EVENT_IDS) {
    const oldestKey = processedEventIds.keys().next().value;
    if (oldestKey !== undefined) {
      processedEventIds.delete(oldestKey);
    }
  }
  processedEventIds.add(event.eventId);
  newState.processedEventIds = processedEventIds;
  newState.eventCount = newState.eventCount + 1;

  // R12-11: Compute freshness metadata (direct assignment to avoid stale reference)
  newState.lastProjectedAt = event.createdAt;
  newState.lagMs = Date.now() - new Date(event.createdAt).getTime();
  newState.stale = newState.lagMs > 300_000;

  // Extract multi-party counts from context if available
  const context = payload.context as Record<string, unknown> | null | undefined;
  if (context) {
    if (newState.approvalsRequired === 1) {
      const origRequired = context.originalRequiredApprovals as number | undefined;
      if (origRequired !== undefined) {
        newState.approvalsRequired = origRequired;
      }
    }
  }

  // Update state based on event type
  switch (event.eventType) {
    case "decision:requested":
      handleDecisionRequested(newState, payload, event.createdAt);
      break;

    case "decision:responded":
      handleDecisionResponded(newState, payload, event.createdAt);
      break;

    case "decision:partial_approval":
      handlePartialApproval(newState, payload, event.createdAt);
      break;

    case "decision:approved":
      handleDecisionApproved(newState, payload, event.createdAt);
      break;

    case "decision:rejected":
      handleDecisionRejected(newState, payload, event.createdAt);
      break;

    default:
      // No specific handling for other event types
      break;
  }

  return newState as unknown as Record<string, unknown>;
};

/**
 * Handle decision:requested event
 */
function handleDecisionRequested(
  state: ApprovalQueueState,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  state.status = "requested";
  if (state.createdAt === null) {
    state.createdAt = timestamp;
  }
  if (state.riskLevel === null) {
    state.riskLevel = (payload.riskLevel as string | undefined) ?? null;
  }
  // Required approvals from context
  const ctx = payload.context as Record<string, unknown> | null | undefined;
  if (ctx) {
    const reqApprovals = ctx.originalRequiredApprovals as number | undefined;
    if (reqApprovals !== undefined) {
      state.approvalsRequired = reqApprovals;
    }
  }
}

/**
 * Handle decision:responded event
 */
function handleDecisionResponded(
  state: ApprovalQueueState,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  const decisionType = payload.decisionType as string | null | undefined;

  if (decisionType === "confirmed" || decisionType === "option_selected") {
    state.status = "confirmed";
    state.approvalsReceived = 1;
  } else if (decisionType === "rejected") {
    state.status = "rejected";
    state.rejectionsReceived = 1;
  } else if (decisionType === "expired") {
    state.status = "expired";
  } else if (decisionType === "text_input") {
    state.status = "text_input";
  } else {
    // Default to confirmed for backward compatibility
    state.status = "confirmed";
  }

  state.respondedAt = timestamp;
  state.respondedBy = (payload.respondedBy as string | null | undefined) ?? null;
  state.decisionType = decisionType ?? null;
  state.selectedOptionId = (payload.selectedOptionId as string | null | undefined) ?? null;
  state.inputText = (payload.inputText as string | null | undefined) ?? null;
  state.cascadeDeny = payload.cascadeDeny === true;
  state.cascadeSourceApprovalId = (payload.cascadeSourceApprovalId as string | null | undefined) ?? null;
  state.cascadeSessionId = (payload.cascadeSessionId as string | null | undefined) ?? null;
}

/**
 * Handle decision:partial_approval event (multi-party progress)
 */
function handlePartialApproval(
  state: ApprovalQueueState,
  payload: Record<string, unknown>,
  _timestamp: string,
): void {
  const approvalsReceived = payload.approvalsReceived as number | undefined;
  const requiredApprovals = payload.requiredApprovals as number | undefined;

  if (approvalsReceived !== undefined) {
    state.approvalsReceived = approvalsReceived;
  }
  if (requiredApprovals !== undefined) {
    state.approvalsRequired = requiredApprovals;
  }
  state.status = "requested"; // Still pending more approvals
}

/**
 * Handle decision:approved event (multi-party final)
 */
function handleDecisionApproved(
  state: ApprovalQueueState,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  state.status = "confirmed";
  state.approvalsReceived = state.approvalsRequired;
  if (state.respondedAt === null) {
    state.respondedAt = timestamp;
  }
  state.respondedBy = (payload.respondedBy as string | null | undefined) ?? null;
  state.decisionType = "approved";
}

/**
 * Handle decision:rejected event (multi-party final)
 */
function handleDecisionRejected(
  state: ApprovalQueueState,
  payload: Record<string, unknown>,
  timestamp: string,
): void {
  state.status = "rejected";
  state.rejectionsReceived = state.approvalsRequired;
  if (state.respondedAt === null) {
    state.respondedAt = timestamp;
  }
  state.respondedBy = (payload.respondedBy as string | null | undefined) ?? null;
  state.decisionType = "rejected";
}

/**
 * Creates an ApprovalQueueProjection instance for use with ProjectionRebuildService
 */
export function createApprovalQueueProjectionHandler(): ProjectionHandler {
  return approvalQueueProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
