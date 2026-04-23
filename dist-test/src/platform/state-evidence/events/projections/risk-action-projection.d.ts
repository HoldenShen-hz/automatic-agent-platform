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
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
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
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
}
export type RiskActionType = "allow" | "deny" | "block" | "escalate" | "review" | "quarantine";
export type RiskDecisionStatus = "pending" | "decided" | "confirmed" | "overridden" | "completed" | "expired";
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
export declare function createEmptyRiskActionState(): RiskActionState;
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
export declare const riskActionProjectionHandler: ProjectionHandler;
/**
 * Creates a RiskActionProjection instance for use with ProjectionRebuildService
 */
export declare function createRiskActionProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
