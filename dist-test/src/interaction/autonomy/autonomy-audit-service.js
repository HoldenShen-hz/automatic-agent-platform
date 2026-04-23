/**
 * Autonomy Audit Service
 *
 * Persists autonomy level change events to an audit trail.
 * Provides query interface for autonomy change history.
 */
export class AutonomyAuditService {
    records = [];
    recordChange(event) {
        const record = {
            id: `autonomy_audit_${this.records.length + 1}`,
            agentId: event.agentId,
            capabilityId: event.capabilityId,
            eventType: event.eventType,
            fromLevel: event.fromLevel,
            toLevel: event.toLevel,
            trigger: event.trigger,
            approvedBy: event.approvedBy,
            successRate: event.evidence.successRate,
            totalExecutions: event.evidence.totalExecutions,
            incidentCount: event.evidence.incidentCount,
            evaluationWindow: event.evidence.evaluationWindow,
            createdAt: new Date().toISOString(),
        };
        this.records.push(record);
        return record;
    }
    getByAgent(agentId) {
        return this.records.filter((r) => r.agentId === agentId);
    }
    getByCapability(agentId, capabilityId) {
        return this.records.filter((r) => r.agentId === agentId && r.capabilityId === capabilityId);
    }
    getRecentChanges(limit = 50) {
        return [...this.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    }
    getSummary(agentId) {
        const agentRecords = this.getByAgent(agentId);
        if (agentRecords.length === 0) {
            return {
                totalChanges: 0,
                promotions: 0,
                demotions: 0,
                freezes: 0,
                lastChangeAt: null,
            };
        }
        return {
            totalChanges: agentRecords.length,
            promotions: agentRecords.filter((r) => r.eventType === "agent.autonomy.promoted").length,
            demotions: agentRecords.filter((r) => r.eventType === "agent.autonomy.demoted").length,
            freezes: agentRecords.filter((r) => r.eventType === "agent.autonomy.frozen").length,
            lastChangeAt: agentRecords.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt,
        };
    }
    listRecords() {
        return [...this.records];
    }
}
export const autonomyAuditService = new AutonomyAuditService();
//# sourceMappingURL=autonomy-audit-service.js.map