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
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
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
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
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
export type ApprovalQueueStatus = "requested" | "confirmed" | "rejected" | "expired" | "cancelled" | "text_input";
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
export declare function createEmptyApprovalQueueState(): ApprovalQueueState;
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
export declare const approvalQueueProjectionHandler: ProjectionHandler;
/**
 * Creates an ApprovalQueueProjection instance for use with ProjectionRebuildService
 */
export declare function createApprovalQueueProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
