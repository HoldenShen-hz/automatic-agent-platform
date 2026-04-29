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
  /** Set of processed event IDs for idempotency */
  processedEventIds: string[];
  /** First event timestamp */
  firstEventAt: string | null;
  /** Last event timestamp */
  lastEventAt: string | null;
  /** Timestamp when projection was last updated */
  lastProjectedAt: string | null;
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
    processedEventIds: [],
    firstEventAt: null,
    lastProjectedAt: null,
    lastEventAt: null,
  };
}

/**
 * Dispatch Projection Handler
 *
 * Handles dispatch events and maintains dispatch ticket state.
 */
export const dispatchProjectionHandler: ProjectionHandler<DispatchTicketState> = {
  name: "dispatch-ticket-projection",

  initialState: createInitialDispatchTicketState,

  apply(state: DispatchTicketState, event: ProjectionInputEvent): DispatchTicketState {
    // Idempotency check
    if (state.processedEventIds.includes(event.event.id)) {
      return state;
    }

    const occurredAt = event.event.createdAt;
    const timelineEntry: DispatchTicketTimelineEntry = {
      eventType: event.event.eventType,
      occurredAt,
    };

    switch (event.event.eventType) {
      case "dispatch:ticket_created": {
        const payload = JSON.parse(event.event.payloadJson as string) as DispatchTicketCreatedPayload;
        const newTimeline = [...state.timeline];
        newTimeline.push({ ...timelineEntry, details: `ticket_created:${payload.ticketId}` });
        const newProcessedEventIds = [...state.processedEventIds, event.event.id];
        return {
          ...state,
          ticketId: payload.ticketId,
          executionId: event.event.executionId,
          taskId: event.event.taskId,
          queueName: payload.queueName,
          dispatchTarget: payload.dispatchTarget,
          priority: payload.priority,
          status: "pending",
          timeline: newTimeline,
          eventCount: state.eventCount + 1,
          processedEventIds: newProcessedEventIds,
          firstEventAt: state.firstEventAt ?? occurredAt,
          lastEventAt: occurredAt,
          lastProjectedAt: occurredAt,
        };
      }

      case "dispatch:ticket_claimed": {
        const payload = JSON.parse(event.event.payloadJson as string) as DispatchTicketClaimedPayload;
        const newTimeline = [...state.timeline];
        newTimeline.push({ ...timelineEntry, details: `ticket_claimed:${payload.ticketId} by ${payload.workerId}` });
        const newProcessedEventIds = [...state.processedEventIds, event.event.id];
        return {
          ...state,
          workerId: payload.workerId,
          status: "claimed",
          claimedAt: occurredAt,
          timeline: newTimeline,
          eventCount: state.eventCount + 1,
          processedEventIds: newProcessedEventIds,
          lastEventAt: occurredAt,
          lastProjectedAt: occurredAt,
        };
      }

      case "dispatch:decision_recorded": {
        const payload = JSON.parse(event.event.payloadJson as string) as DispatchDecisionRecordedPayload;
        const newTimeline = [...state.timeline];
        newTimeline.push({ ...timelineEntry, details: `decision_recorded:${payload.outcome}` });
        const newProcessedEventIds = [...state.processedEventIds, event.event.id];
        return {
          ...state,
          decisionOutcome: payload.outcome,
          decisionReasonCode: payload.reasonCode,
          decisionSelectedWorkerId: payload.selectedWorkerId,
          decisionTraceJson: JSON.stringify(payload),
          timeline: newTimeline,
          eventCount: state.eventCount + 1,
          processedEventIds: newProcessedEventIds,
          lastEventAt: occurredAt,
          lastProjectedAt: occurredAt,
        };
      }

      default:
        return state;
    }
  },
};
