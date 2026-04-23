/**
 * Promotion Gate
 *
 * Decides whether a proposal can be promoted based on evaluation
 * reports and frozen state.
 */
export const DEFAULT_PROMOTION_GATE_CONFIG = {
    minSuccessLift: 0.03,
    maxRegressionRate: 0.01,
    maxCostIncrease: 0.10,
    maxLatencyIncrease: 0.15,
    maxSafetyViolations: 0,
};
export class PromotionGate {
    config;
    constructor(config = DEFAULT_PROMOTION_GATE_CONFIG) {
        this.config = config;
    }
    decide(proposal, report, frozen, currentStage) {
        const reasons = [];
        // Check frozen state
        if (frozen) {
            reasons.push('Evolution system is frozen');
            return {
                allowed: false,
                reasons,
                stage: 'rejected',
            };
        }
        // High-risk proposals always require manual approval
        if (proposal.risk === 'high') {
            reasons.push('High-risk proposals require manual approval');
            return {
                allowed: false,
                reasons,
                stage: 'rejected',
            };
        }
        // Check evaluation metrics
        const successLift = report.successRateAfter - report.successRateBefore;
        if (successLift < this.config.minSuccessLift) {
            reasons.push(`Insufficient success lift: ${(successLift * 100).toFixed(1)}% < ${(this.config.minSuccessLift * 100).toFixed(1)}%`);
        }
        if (report.regressionRate > this.config.maxRegressionRate) {
            reasons.push(`Regression rate too high: ${(report.regressionRate * 100).toFixed(1)}% > ${(this.config.maxRegressionRate * 100).toFixed(1)}%`);
        }
        if (report.avgCostDelta > this.config.maxCostIncrease) {
            reasons.push(`Cost increase too high: ${(report.avgCostDelta * 100).toFixed(1)}% > ${(this.config.maxCostIncrease * 100).toFixed(1)}%`);
        }
        if (report.avgLatencyDelta > this.config.maxLatencyIncrease) {
            reasons.push(`Latency increase too high: ${(report.avgLatencyDelta * 100).toFixed(1)}% > ${(this.config.maxLatencyIncrease * 100).toFixed(1)}%`);
        }
        if (report.safetyViolations > this.config.maxSafetyViolations) {
            reasons.push(`Safety violations detected: ${report.safetyViolations} > ${this.config.maxSafetyViolations}`);
        }
        // Determine next stage
        let nextStage;
        if (reasons.length > 0) {
            nextStage = 'rejected';
        }
        else if (currentStage === 'testing') {
            nextStage = 'canary';
        }
        else if (currentStage === 'canary') {
            nextStage = 'active';
        }
        else {
            nextStage = 'testing';
        }
        return {
            allowed: reasons.length === 0,
            reasons,
            stage: nextStage,
        };
    }
    canAutoPromote(proposal) {
        // Only low-risk proposals can auto-promote
        return proposal.risk === 'low';
    }
    requiresManualGate(proposal) {
        // High-risk always requires manual
        if (proposal.risk === 'high')
            return true;
        // Certain kinds require manual
        return ['prompt_patch', 'workflow_template', 'threshold_tuning'].includes(proposal.kind);
    }
}
//# sourceMappingURL=promotion-gate.js.map