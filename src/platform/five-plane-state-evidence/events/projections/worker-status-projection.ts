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

// R20-07: Maximum size for processedEventIds before eviction
const MAX_PROCESSED_EVENT_IDS = 10_000;

/**
 * Worker Status Projection State
 *
 * Tracks the lifecycle of a worker including:
 * - Registration and claim state
 * - Heartbeat activity
 * - Writeback status
 * - Lease release
 */
export interface WorkerStatusState extends Record<string, unknown> {
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
  /** First claim accepted timestamp */
  firstClaimAcceptedAt: string | null;
  /** Last claim accepted timestamp */
  lastClaimAcceptedAt: string | null;
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
    // R12-10: Use Set instead of array for O(1) idempotency lookup
    processedEventIds: new Set<string>(),
    firstEventAt: null,
    lastEventAt: null,
    // R12-11: Initialize freshness tracking
    lastProjectedAt: null,
    lagMs: null,
    stale: false,
    firstClaimAcceptedAt: null,
    lastClaimAcceptedAt: null,
  };
}

/**
 * Checks if an event has already been processed (idempotency check).
 * R12-10: Uses Set.has() for O(1) lookup instead of O(n) array.includes()
 */
function isEventProcessed(state: WorkerStatusState, eventId: string): boolean {
  return state.processedEventIds.has(eventId);
}

/**
 * Computes freshness metadata (lagMs, stale, lastProjectedAt).
 */
function computeFreshness(state: WorkerStatusState, occurredAt: string): WorkerStatusState {
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
  // Initialize state if null
  const currentState = state as WorkerStatusState | null;
  const newState = currentState ? { ...currentState } : createEmptyWorkerStatusState();

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return newState;
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

    default:
      break;
  }

  return newState;
};

/**
 * Creates a WorkerStatusProjection instance for use with ProjectionRebuildService
 */
export function createWorkerStatusProjectionHandler(): ProjectionHandler {
  return workerStatusProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
