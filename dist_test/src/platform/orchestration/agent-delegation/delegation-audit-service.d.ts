/**
 * Delegation Audit Service
 *
 * Provides persistent audit trail for delegation operations:
 * - Delegation creation and lifecycle events
 * - Governance decisions
 * - Permission changes
 *
 * Architecture: §51 Delegation Governance
 */
export type DelegationAuditEventType = "delegation.governance.evaluated" | "delegation.governance.approved" | "delegation.governance.denied" | "delegation.created" | "delegation.completed" | "delegation.failed" | "delegation.cancelled" | "delegation.expired" | "delegation.permission_narrowed";
export interface DelegationAuditEvent {
    id: string;
    eventType: DelegationAuditEventType;
    delegationId: string | null;
    parentAgentId: string;
    childAgentId: string | null;
    depth: number;
    reasonCode: string;
    metadata: Record<string, unknown>;
    actorId: string;
    actorType: "user" | "agent" | "system";
    createdAt: string;
}
export interface DelegationAuditSummary {
    totalEvents: number;
    byType: Record<DelegationAuditEventType, number>;
    byAgent: Record<string, number>;
    lastEventAt: string | null;
}
export declare class DelegationAuditService {
    private readonly events;
    record(event: Omit<DelegationAuditEvent, "id" | "createdAt">): DelegationAuditEvent;
    recordGovernanceEvaluation(params: {
        delegationId: string | null;
        parentAgentId: string;
        childAgentId: string | null;
        depth: number;
        reasonCode: string;
        decision: "allow" | "deny" | "allow_with_constraints" | "require_approval";
        evaluatedRules: string[];
        actorId: string;
        actorType: "user" | "agent" | "system";
    }): DelegationAuditEvent;
    recordDelegationCreated(params: {
        delegationId: string;
        parentAgentId: string;
        childAgentId: string;
        depth: number;
        reasonCode?: string;
        actorId: string;
        actorType: "user" | "agent" | "system";
    }): DelegationAuditEvent;
    recordDelegationCompleted(params: {
        delegationId: string;
        parentAgentId: string;
        childAgentId: string;
        durationMs: number;
        actorId: string;
        actorType: "user" | "agent" | "system";
    }): DelegationAuditEvent;
    recordDelegationFailed(params: {
        delegationId: string;
        parentAgentId: string;
        childAgentId: string;
        error: string;
        actorId: string;
        actorType: "user" | "agent" | "system";
    }): DelegationAuditEvent;
    recordPermissionNarrowed(params: {
        delegationId: string;
        parentAgentId: string;
        childAgentId: string;
        originalPermissions: Record<string, unknown>;
        narrowedPermissions: Record<string, unknown>;
        actorId: string;
        actorType: "user" | "agent" | "system";
    }): DelegationAuditEvent;
    getByDelegation(delegationId: string): DelegationAuditEvent[];
    getByAgent(agentId: string): DelegationAuditEvent[];
    getRecentEvents(limit?: number): DelegationAuditEvent[];
    getSummary(): DelegationAuditSummary;
    listEvents(): DelegationAuditEvent[];
}
export declare const delegationAuditService: DelegationAuditService;
