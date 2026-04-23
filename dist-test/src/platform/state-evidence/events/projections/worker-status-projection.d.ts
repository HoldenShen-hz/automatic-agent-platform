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
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
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
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
    /** First claim accepted timestamp */
    firstClaimAcceptedAt: string | null;
    /** Last claim accepted timestamp */
    lastClaimAcceptedAt: string | null;
}
export type WorkerLifecycleStatus = "idle" | "claiming" | "active" | "writeback" | "completed" | "rejected" | "dead";
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
export declare function createEmptyWorkerStatusState(): WorkerStatusState;
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
export declare const workerStatusProjectionHandler: ProjectionHandler;
/**
 * Creates a WorkerStatusProjection instance for use with ProjectionRebuildService
 */
export declare function createWorkerStatusProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
