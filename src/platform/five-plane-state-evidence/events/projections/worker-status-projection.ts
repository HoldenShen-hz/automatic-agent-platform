/**
 * @fileoverview Worker Status Projection
 *
 * Tracks worker lifecycle and heartbeat state.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Worker status linked to execution and task
 *
 * §28 architecture: worker_status_projection
 */

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

/**
 * Worker Status Projection State
 *
 * Tracks the lifecycle of a worker including:
 * - Registration and claim state
 * - Heartbeat activity
 * - Writeback status
 * - Lease release
 */
export interface WorkerStatusState {
  /** Worker ID (from event) */
  workerId: string | null;
  /** Current status of the worker */
  status: WorkerLifecycleStatus;
  /** Associated task ID */
  taskId: string | null;
  /** Associated execution ID */
  executionId: string | null;
  /** Tenant ID */
  tenantId: string | null;
  /** Claims accepted count */
  claimsAccepted: number;
  /** Claims rejected count */
  claimsRejected: number;
  /** Heartbeats received count */
  heartbeatsReceived: number;
  /** Last heartbeat timestamp */
  lastHeartbeatAt: string | null;
  /** Writebacks recorded count */
  writebacksRecorded: number;
  /** Writebacks rejected count */
  writebacksRejected: number;
  /** Last writeback timestamp */
  lastWritebackAt: string | null;
  /** Last writeback rejection timestamp */
  lastWritebackRejectedAt: string | null;
  /** Lease releases after writeback count */
  leaseReleasesAfterWriteback: number;
  /** Timeline of events in order */
  timeline: WorkerStatusTimelineEntry[];
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
  /** First claim accepted timestamp */
  firstClaimAcceptedAt: string | null;
  /** Last claim accepted timestamp */
  lastClaimAcceptedAt: string | null;
}

/**
 * Internal state with Set for O(1) idempotency checks.
 */
interface WorkerStatusStateInternal extends Omit<WorkerStatusState, "processedEventIds"> {
  _processedEventIdSet: Set<string>;
}

export type WorkerLifecycleStatus =
  | "idle"
  | "claiming"
  | "active"
  | "writeback"
  | "completed"
  | "rejected"
  | "dead";

/**
 * Timeline entry for worker events
 */
export interface WorkerStatusTimelineEntry {
  eventId: string;
  eventType: string;
  timestamp: string;
  executionId: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Creates a new empty WorkerStatusState
 */
export function createEmptyWorkerStatusState(): WorkerStatusState {
  return {
    workerId: null,
    status: "idle",
    taskId: null,
    executionId: null,
    tenantId: null,
    claimsAccepted: 0,
    claimsRejected: 0,
    heartbeatsReceived: 0,
    lastHeartbeatAt: null,
    writebacksRecorded: 0,
    writebacksRejected: 0,
    lastWritebackAt: null,
    lastWritebackRejectedAt: null,
    leaseReleasesAfterWriteback: 0,
    timeline: [],
    eventCount: 0,
    processedEventIds: [],
    firstEventAt: null,
    lastEventAt: null,
    lastProjectedAt: null,
    lagMs: null,
    stale: false,
    firstClaimAcceptedAt: null,
    lastClaimAcceptedAt: null,
  };
}

/**
 * Converts serialized state (with array) to internal state (with Set for O(1) lookup).
 */
function toInternalState(state: WorkerStatusState): WorkerStatusStateInternal {
  return {
    ...state,
    _processedEventIdSet: new Set(state.processedEventIds),
  };
}

/**
 * Converts internal state (with Set) back to serialized state (with array for JSON).
 */
function toSerializedState(state: WorkerStatusStateInternal): WorkerStatusState {
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
function isEventProcessed(state: WorkerStatusStateInternal, eventId: string): boolean {
  return state._processedEventIdSet.has(eventId);
}

/**
 * Worker Status Projection Handler
 *
 * Implements ProjectionHandler interface for worker status tracking.
 * Handles events:
 * - worker:claim_accepted - Worker accepted a claim
 * - worker:claim_rejected - Worker rejected a claim
 * - worker:heartbeat_recorded - Worker heartbeat received
 * - worker:writeback_recorded - Writeback recorded
 * - worker:writeback_rejected - Writeback rejected
 * - worker:lease_released_after_writeback - Lease released after writeback
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const workerStatusProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null, convert to internal state with Set for O(1) lookup
  const currentState = state as unknown as WorkerStatusState | null;
  const baseState = currentState ? { ...currentState } : createEmptyWorkerStatusState();
  const newState = toInternalState(baseState);

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return toSerializedState(newState) as unknown as Record<string, unknown>;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);

  // Update IDs if not set
  if (newState.workerId === null) {
    newState.workerId = (payload.workerId as string | undefined) ?? null;
  }
  if (newState.taskId === null && event.taskId !== null) {
    newState.taskId = event.taskId;
  }
  if (newState.executionId === null) {
    newState.executionId = (payload.executionId as string | null | undefined) ?? event.taskId;
  }
  if (newState.tenantId === null) {
    newState.tenantId = (payload.tenantId as string | null | undefined) ?? null;
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
  const timelineEntry: WorkerStatusTimelineEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    executionId: event.taskId,
    details: Object.keys(details).length > 0 ? details : null,
  };
  newState.timeline = [...newState.timeline, timelineEntry];

  // Mark event as processed using O(1) Set add
  newState._processedEventIdSet.add(event.eventId);
  newState.eventCount = newState.eventCount + 1;

  // Update state based on event type
  switch (event.eventType) {
    case "worker:claim_accepted":
      newState.claimsAccepted++;
      newState.status = "active";
      if (newState.firstClaimAcceptedAt === null) {
        newState.firstClaimAcceptedAt = event.createdAt;
      }
      newState.lastClaimAcceptedAt = event.createdAt;
      break;

    case "worker:claim_rejected":
      newState.claimsRejected++;
      newState.status = "rejected";
      break;

    case "worker:heartbeat_recorded":
      newState.heartbeatsReceived++;
      newState.lastHeartbeatAt = event.createdAt;
      // Keep status active on heartbeat
      if (newState.status === "idle" || newState.status === "claiming") {
        newState.status = "active";
      }
      break;

    case "worker:writeback_recorded":
      newState.writebacksRecorded++;
      newState.lastWritebackAt = event.createdAt;
      newState.status = "writeback";
      break;

    case "worker:writeback_rejected":
      newState.writebacksRejected++;
      newState.lastWritebackRejectedAt = event.createdAt;
      newState.status = "rejected";
      break;

    case "worker:lease_released_after_writeback":
      newState.leaseReleasesAfterWriteback++;
      newState.status = "completed";
      break;

    case "worker:registered":
      newState.status = "idle";
      break;

    case "worker:deregistered":
      newState.status = "dead";
      break;

    case "worker:drain_started":
      newState.status = "idle";
      break;

    default:
      break;
  }

  return toSerializedState(newState) as unknown as Record<string, unknown>;
};

/**
 * Creates a WorkerStatusProjection instance for use with ProjectionRebuildService
 */
export function createWorkerStatusProjectionHandler(): ProjectionHandler {
  return workerStatusProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
