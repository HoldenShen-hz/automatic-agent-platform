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
import { newId, nowIso } from "../../contracts/types/ids.js";
export class DelegationAuditService {
    events = [];
    record(event) {
        const record = {
            ...event,
            id: newId("dlg_audit"),
            createdAt: nowIso(),
        };
        this.events.push(record);
        return record;
    }
    recordGovernanceEvaluation(params) {
        return this.record({
            eventType: params.decision === "deny"
                ? "delegation.governance.denied"
                : params.decision === "require_approval"
                    ? "delegation.governance.evaluated"
                    : "delegation.governance.approved",
            delegationId: params.delegationId,
            parentAgentId: params.parentAgentId,
            childAgentId: params.childAgentId,
            depth: params.depth,
            reasonCode: params.reasonCode,
            metadata: { evaluatedRules: params.evaluatedRules },
            actorId: params.actorId,
            actorType: params.actorType,
        });
    }
    recordDelegationCreated(params) {
        return this.record({
            eventType: "delegation.created",
            delegationId: params.delegationId,
            parentAgentId: params.parentAgentId,
            childAgentId: params.childAgentId,
            depth: params.depth,
            reasonCode: params.reasonCode ?? "delegation.created",
            metadata: {},
            actorId: params.actorId,
            actorType: params.actorType,
        });
    }
    recordDelegationCompleted(params) {
        return this.record({
            eventType: "delegation.completed",
            delegationId: params.delegationId,
            parentAgentId: params.parentAgentId,
            childAgentId: params.childAgentId,
            depth: 0,
            reasonCode: "delegation.completed",
            metadata: { durationMs: params.durationMs },
            actorId: params.actorId,
            actorType: params.actorType,
        });
    }
    recordDelegationFailed(params) {
        return this.record({
            eventType: "delegation.failed",
            delegationId: params.delegationId,
            parentAgentId: params.parentAgentId,
            childAgentId: params.childAgentId,
            depth: 0,
            reasonCode: "delegation.failed",
            metadata: { error: params.error },
            actorId: params.actorId,
            actorType: params.actorType,
        });
    }
    recordPermissionNarrowed(params) {
        return this.record({
            eventType: "delegation.permission_narrowed",
            delegationId: params.delegationId,
            parentAgentId: params.parentAgentId,
            childAgentId: params.childAgentId,
            depth: 0,
            reasonCode: "delegation.permission_narrowed",
            metadata: {
                originalPermissions: params.originalPermissions,
                narrowedPermissions: params.narrowedPermissions,
            },
            actorId: params.actorId,
            actorType: params.actorType,
        });
    }
    getByDelegation(delegationId) {
        return this.events.filter((e) => e.delegationId === delegationId);
    }
    getByAgent(agentId) {
        return this.events.filter((e) => e.parentAgentId === agentId || e.childAgentId === agentId);
    }
    getRecentEvents(limit = 50) {
        return [...this.events]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, limit);
    }
    getSummary() {
        const byType = {
            "delegation.governance.evaluated": 0,
            "delegation.governance.approved": 0,
            "delegation.governance.denied": 0,
            "delegation.created": 0,
            "delegation.completed": 0,
            "delegation.failed": 0,
            "delegation.cancelled": 0,
            "delegation.expired": 0,
            "delegation.permission_narrowed": 0,
        };
        const byAgent = {};
        let lastEventAt = null;
        for (const event of this.events) {
            byType[event.eventType]++;
            byAgent[event.parentAgentId] = (byAgent[event.parentAgentId] ?? 0) + 1;
            if (!lastEventAt || event.createdAt > lastEventAt) {
                lastEventAt = event.createdAt;
            }
        }
        return {
            totalEvents: this.events.length,
            byType,
            byAgent,
            lastEventAt,
        };
    }
    listEvents() {
        return [...this.events];
    }
}
export const delegationAuditService = new DelegationAuditService();
//# sourceMappingURL=delegation-audit-service.js.map