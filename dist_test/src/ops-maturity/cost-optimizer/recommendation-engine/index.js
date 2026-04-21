export function buildCostOptimizationRecommendation(subjectId, currentCostUsd) {
    if (currentCostUsd < 10) {
        return null;
    }
    return {
        recommendationId: `rec_${subjectId}`,
        subjectId,
        estimatedSavingsUsd: Number((currentCostUsd * 0.15).toFixed(2)),
        riskLevel: currentCostUsd > 100 ? "medium" : "low",
    };
}
//# sourceMappingURL=index.js.map