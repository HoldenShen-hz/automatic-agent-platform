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
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
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
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
}
export type GovernanceActionType = "policy_created" | "policy_updated" | "policy_deleted" | "approval_granted" | "approval_denied" | "delegation_created" | "delegation_completed" | "delegation_failed" | "compliance_violation" | "compliance_resolved" | "permission_granted" | "permission_revoked" | "role_assigned" | "role_removed" | "config_changed" | "escalation_triggered";
export type GovernanceStatus = "pending" | "active" | "approved" | "denied" | "resolved" | "completed" | "failed" | "cancelled";
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
export declare function createEmptyGovernanceState(): GovernanceState;
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
export declare const governanceProjectionHandler: ProjectionHandler;
/**
 * Creates a GovernanceProjection instance for use with ProjectionRebuildService
 */
export declare function createGovernanceProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
