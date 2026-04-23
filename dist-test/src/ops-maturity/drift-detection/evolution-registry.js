/**
 * Evolution Registry
 *
 * Central registry for tracking all proposals, their status,
 * evaluations, and rollout records.
 */
export class InMemoryEvolutionRegistry {
    proposals = new Map();
    evaluations = new Map();
    rollouts = new Map();
    reflections = [];
    maxEntries = 500;
    cleanupAt = 0;
    evictExpired() {
        const now = Date.now();
        if (now - this.cleanupAt < 60000)
            return;
        this.cleanupAt = now;
        if (this.proposals.size <= this.maxEntries)
            return;
        const keys = Array.from(this.proposals.keys());
        const toRemove = keys.slice(0, Math.floor(this.maxEntries * 0.2));
        for (const k of toRemove)
            this.proposals.delete(k);
    }
    async saveProposal(proposal) {
        this.proposals.set(proposal.id, proposal);
    }
    async updateProposalStatus(id, status) {
        const proposal = this.proposals.get(id);
        if (proposal) {
            this.proposals.set(id, { ...proposal, status, updatedAt: new Date().toISOString() });
        }
    }
    async getProposal(id) {
        return this.proposals.get(id) ?? null;
    }
    async listProposals(status) {
        const all = Array.from(this.proposals.values());
        return status ? all.filter((p) => p.status === status) : all;
    }
    async saveEvaluation(report) {
        this.evaluations.set(report.proposalId, report);
    }
    async getEvaluation(proposalId) {
        return this.evaluations.get(proposalId) ?? null;
    }
    async listEvaluations() {
        return Array.from(this.evaluations.values());
    }
    async saveRollout(record) {
        this.rollouts.set(record.proposalId, record);
    }
    async getRollout(proposalId) {
        return this.rollouts.get(proposalId) ?? null;
    }
    async listActiveRollouts() {
        return Array.from(this.rollouts.values()).filter((r) => r.status === 'running');
    }
    async saveReflection(reflection) {
        this.reflections.push(reflection);
    }
    async listReflections(taskType) {
        return taskType
            ? this.reflections.filter((r) => r.taskType === taskType)
            : this.reflections;
    }
    async getStatistics() {
        const proposals = Array.from(this.proposals.values());
        const byStatus = {
            proposed: 0,
            testing: 0,
            canary: 0,
            active: 0,
            rejected: 0,
            rolled_back: 0,
        };
        for (const proposal of proposals) {
            byStatus[proposal.status] = (byStatus[proposal.status] ?? 0) + 1;
        }
        const activeCount = byStatus.testing + byStatus.canary;
        const rejectedCount = byStatus.rejected + byStatus.rolled_back;
        const evaluations = Array.from(this.evaluations.values());
        const averageSuccessLift = evaluations.length > 0
            ? evaluations.reduce((sum, e) => sum + (e.successRateAfter - e.successRateBefore), 0) / evaluations.length
            : 0;
        return {
            totalProposals: proposals.length,
            byStatus,
            activeCount,
            rejectedCount,
            averageSuccessLift,
        };
    }
}
//# sourceMappingURL=evolution-registry.js.map