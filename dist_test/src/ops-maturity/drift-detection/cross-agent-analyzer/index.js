export class CrossAgentAnalyzerService {
    analyze(metrics) {
        if (metrics.length === 0) {
            return {
                bestAgentId: null,
                worstAgentId: null,
                divergenceScore: 0,
                recommendation: "insufficient_data",
            };
        }
        const ranked = [...metrics].sort((left, right) => scoreMetric(right) - scoreMetric(left));
        const best = ranked[0];
        const worst = ranked.at(-1);
        const divergenceScore = Math.max(0, scoreMetric(best) - scoreMetric(worst));
        return {
            bestAgentId: best.agentId,
            worstAgentId: worst.agentId,
            divergenceScore,
            recommendation: divergenceScore >= 0.2 ? "rebalance_or_rollout_review" : "agents_are_consistent",
        };
    }
}
function scoreMetric(metric) {
    return metric.successRate - metric.averageCostUsd * 0.1 - metric.averageLatencyMs / 10_000;
}
//# sourceMappingURL=index.js.map