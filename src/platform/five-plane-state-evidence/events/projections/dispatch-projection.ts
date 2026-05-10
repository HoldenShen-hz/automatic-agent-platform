/**
 * @fileoverview Dispatch Projection
 *
 * Tracks dispatch ticket lifecycle and decision state.
 * Implements projection for dispatch events:
 * - dispatch:ticket_created
 * - dispatch:ticket_claimed
 * - dispatch:decision_recorded
 *
 * This addresses the P5 blind spot where dispatch events had no projection.
 */

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

// R20-07: Maximum size for processedEventIds before eviction
const MAX_PROCESSED_EVENT_IDS = 10_000;

/**
 * Dispatch Ticket Projection State
 *
 * Tracks the lifecycle of a dispatch ticket including:
 * - Ticket creation and assignment
 * - Worker claim state
 * - Decision recording
 */
export interface DispatchTicketState {
  /** Ticket ID */
  ticketId: string | null;
  /** Execution ID */
  executionId: string | null;
  /** Task ID */
  taskId: string | null;
  /** Worker ID (when claimed) */
  workerId: string | null;
  /** Ticket status */
  status: "pending" | "claimed" | "consumed" | "invalidated";
  /** Queue name */
  queueName: string | null;
  /** Dispatch target */
  dispatchTarget: string | null;
  /** Priority */
  priority: string | null;
  /** Claim timestamp */
  claimedAt: string | null;
  /** Decision outcome */
  decisionOutcome: string | null;
  /** Decision reason code */
  decisionReasonCode: string | null;
  /** Selected worker ID from decision */
  decisionSelectedWorkerId: string | null;
  /** Decision trace */
  decisionTraceJson: string | null;
  /** Timeline of events in order */
  timeline: DispatchTicketTimelineEntry[];
  /** Count of all events processed */
  eventCount: number;
  /**
   * Set of processed event IDs for idempotency (O(1) lookup).
   * Uses Set for O(1) contains() instead of O(n) array.includes().
   */
  processedEventIds: ReadonlySet<string>;
  /** First event timestamp */
  firstEventAt: string | null;
  /** Last event timestamp */
  lastEventAt: string | null;
  /** Timestamp when projection was last updated */
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
 * Timeline entry for dispatch ticket events.
 */
export interface DispatchTicketTimelineEntry {
  readonly eventType: string;
  readonly occurredAt: string;
  readonly details?: string;
}

/**
 * Payload for dispatch:ticket_created event.
 */
export interface DispatchTicketCreatedPayload {
  ticketId: string;
  queueName: string | null;
  dispatchTarget: string | null;
  requiredIsolationLevel: string | null;
  requiredRepoVersion: string | null;
  attempt: number;
  priority: string;
  requiredCapabilities: string[];
}

/**
 * Payload for dispatch:ticket_claimed event.
 */
export interface DispatchTicketClaimedPayload {
  ticketId: string;
  workerId: string;
  leaseId: string | null;
  queueName: string | null;
  dispatchTarget: string | null;
  remoteAvailability: string | null;
  requiredIsolationLevel: string | null;
  requiredRepoVersion: string | null;
  fallbackApplied: boolean;
  requiredCapabilities: string[];
}

/**
 * Payload for dispatch:decision_recorded event.
 */
export interface DispatchDecisionRecordedPayload {
  ticketId: string;
  executionId: string;
  taskId: string;
  queueName: string | null;
  outcome: string;
  reasonCode: string | null;
  selectedWorkerId: string | null;
  leaseId: string | null;
  fallbackApplied: boolean;
  preemption: unknown | null;
}

/**
 * Event types handled by this projection.
 */
export const DISPATCH_EVENT_TYPES = [
  "dispatch:ticket_created",
  "dispatch:ticket_claimed",
  "dispatch:decision_recorded",
] as const;

/**
 * Creates the initial state for a dispatch ticket projection.
 */
export function createInitialDispatchTicketState(): DispatchTicketState {
  return {
    ticketId: null,
    executionId: null,
    taskId: null,
    workerId: null,
    status: "pending",
    queueName: null,
    dispatchTarget: null,
    priority: null,
    claimedAt: null,
    decisionOutcome: null,
    decisionReasonCode: null,
    decisionSelectedWorkerId: null,
    decisionTraceJson: null,
    timeline: [],
    eventCount: 0,
    processedEventIds: new Set<string>(),
    firstEventAt: null,
    lastProjectedAt: null,
    lastEventAt: null,
    lagMs: null,
    stale: false,
  };
}

/**
 * Checks if an event has already been processed (idempotency check).
 * Uses O(1) Set lookup for efficiency.
 * R20-07: Set with eviction when size exceeds MAX_PROCESSED_EVENT_IDS to prevent unbounded growth.
 */
function isEventProcessed(state: DispatchTicketState, eventId: string): boolean {
  return state.processedEventIds.has(eventId);
}

/**
 * Dispatch Projection Handler
 *
 * Handles dispatch events and maintains dispatch ticket state.
 */
export const dispatchProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Cast state to DispatchTicketState | null
  const currentState = state as DispatchTicketState | null;
  const baseState = currentState ? { ...currentState } : createInitialDispatchTicketState();

  // Idempotency check - skip already processed events using O(1) Set lookup
  if (isEventProcessed(baseState, event.eventId)) {
    return baseState as unknown as Record<string, unknown>;
  }

  const occurredAt = event.createdAt;
  const timelineEntry: DispatchTicketTimelineEntry = {
    eventType: event.eventType,
    occurredAt,
  };

  // Compute lagMs and stale flag per §28.6/§25.5
  let lagMs: number | null = null;
  let stale = false;
  if (occurredAt) {
    const eventTime = new Date(occurredAt).getTime();
    const now = Date.now();
    lagMs = now - eventTime;
    stale = lagMs > 300000;
  }

  // R12-10: Mark event as processed using O(1) Set add - create new Set with existing + new eventId
  // R20-07: Evict oldest entries when size exceeds limit to prevent unbounded growth
  // Set preserves insertion order, so iterators give the oldest entry first
  const newProcessedEventIds = new Set(baseState.processedEventIds);
  while (newProcessedEventIds.size >= MAX_PROCESSED_EVENT_IDS) {
    const oldestKey = newProcessedEventIds.keys().next().value;
    if (oldestKey !== undefined) {
      newProcessedEventIds.delete(oldestKey);
    }
  }
  newProcessedEventIds.add(event.eventId);
  const newState: DispatchTicketState = {
    ...baseState,
    processedEventIds: newProcessedEventIds,
    eventCount: baseState.eventCount + 1,
  };

  switch (event.eventType) {
    case "dispatch:ticket_created": {
      const payload = JSON.parse(event.payloadJson as string) as DispatchTicketCreatedPayload;
      const newTimeline = [...newState.timeline];
      newTimeline.push({ ...timelineEntry, details: `ticket_created:${payload.ticketId}` });
      return {
        ...newState,
        ticketId: payload.ticketId,
        executionId: event.taskId,
        taskId: event.taskId,
        queueName: payload.queueName,
        dispatchTarget: payload.dispatchTarget,
        priority: payload.priority,
        status: "pending",
        timeline: newTimeline,
        firstEventAt: newState.firstEventAt ?? occurredAt,
        lastEventAt: occurredAt,
        lastProjectedAt: occurredAt,
        lagMs,
        stale,
      };
    }

    case "dispatch:ticket_claimed": {
      const payload = JSON.parse(event.payloadJson as string) as DispatchTicketClaimedPayload;
      const newTimeline = [...newState.timeline];
      newTimeline.push({ ...timelineEntry, details: `ticket_claimed:${payload.ticketId} by ${payload.workerId}` });
      return {
        ...newState,
        workerId: payload.workerId,
        status: "claimed",
        claimedAt: occurredAt,
        timeline: newTimeline,
        lastEventAt: occurredAt,
        lastProjectedAt: occurredAt,
        lagMs,
        stale,
      };
    }

    case "dispatch:decision_recorded": {
      const payload = JSON.parse(event.payloadJson as string) as DispatchDecisionRecordedPayload;
      const newTimeline = [...newState.timeline];
      newTimeline.push({ ...timelineEntry, details: `decision_recorded:${payload.outcome}` });
      return {
        ...newState,
        decisionOutcome: payload.outcome,
        decisionReasonCode: payload.reasonCode,
        decisionSelectedWorkerId: payload.selectedWorkerId,
        decisionTraceJson: JSON.stringify(payload),
        timeline: newTimeline,
        lastEventAt: occurredAt,
        lastProjectedAt: occurredAt,
        lagMs,
        stale,
      };
    }

    default:
      return newState as unknown as Record<string, unknown>;
  }
};
