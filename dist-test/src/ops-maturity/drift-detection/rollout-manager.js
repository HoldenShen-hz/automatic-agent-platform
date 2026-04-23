/**
 * Rollout Manager
 *
 * Manages staged rollout of proposals through shadow, canary,
 * and partial stages to stable release.
 */
export class SimpleRolloutManager {
    rollouts = new Map();
    async start(proposal, stage, percentage) {
        const record = {
            proposalId: proposal.id,
            stage,
            percentage,
            startedAt: new Date().toISOString(),
            status: 'running',
        };
        this.rollouts.set(proposal.id, record);
        return record;
    }
    async updateMetrics(proposalId, metrics) {
        const record = this.rollouts.get(proposalId);
        if (record) {
            record.metrics = metrics;
        }
    }
    async complete(proposalId) {
        const record = this.rollouts.get(proposalId);
        if (record) {
            record.status = 'succeeded';
            record.completedAt = new Date().toISOString();
        }
    }
    async fail(proposalId, reason) {
        const record = this.rollouts.get(proposalId);
        if (record) {
            record.status = 'failed';
            record.failureReason = reason;
            record.completedAt = new Date().toISOString();
        }
    }
    async rollback(proposalId, reason) {
        const record = this.rollouts.get(proposalId);
        if (record) {
            record.status = 'rolled_back';
            record.failureReason = reason;
            record.completedAt = new Date().toISOString();
        }
    }
    async getRollout(proposalId) {
        return this.rollouts.get(proposalId) ?? null;
    }
    async getActiveRollouts() {
        return Array.from(this.rollouts.values()).filter((r) => r.status === 'running');
    }
    getDefaultStageSequence() {
        return ['shadow', 'canary', 'partial', 'stable'];
    }
    getStagePercentage(stage) {
        switch (stage) {
            case 'shadow': return 0; // 0% - observe only
            case 'canary': return 5; // 5% of traffic
            case 'partial': return 25; // 25% of traffic
            case 'stable': return 100; // 100% - full rollout
        }
    }
}
//# sourceMappingURL=rollout-manager.js.map