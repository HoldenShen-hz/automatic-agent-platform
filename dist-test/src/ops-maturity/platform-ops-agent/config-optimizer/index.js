export function buildConfigOptimizationSuggestion(key, currentValue, recommendedValue) {
    return `${key}: ${currentValue} -> ${recommendedValue}`;
}
export function estimateConfigOptimizationSavings(currentValue, recommendedValue) {
    return Number(Math.max(0, currentValue - recommendedValue).toFixed(2));
}
export class ConfigOptimizerService {
    optimize(input) {
        const estimatedSavings = estimateConfigOptimizationSavings(input.currentValue, input.recommendedValue);
        const savingsPercent = input.currentValue <= 0
            ? 0
            : Number(((estimatedSavings / input.currentValue) * 100).toFixed(2));
        const delta = input.projectedLoad != null && input.currentLoad != null
            ? input.projectedLoad - input.currentLoad
            : 0;
        const urgency = delta > 50
            ? "high"
            : delta > 10
                ? "medium"
                : "low";
        const reasonCodes = [
            estimatedSavings > 0 ? "config.optimization.cost_reduction" : "config.optimization.capacity_alignment",
            `config.optimization.urgency.${urgency}`,
        ];
        return {
            summary: buildConfigOptimizationSuggestion(input.key, input.currentValue, input.recommendedValue),
            estimatedSavings: input.unitCostUsd == null
                ? estimatedSavings
                : Number((estimatedSavings * input.unitCostUsd).toFixed(2)),
            savingsPercent,
            urgency,
            reasonCodes,
        };
    }
}
//# sourceMappingURL=index.js.map