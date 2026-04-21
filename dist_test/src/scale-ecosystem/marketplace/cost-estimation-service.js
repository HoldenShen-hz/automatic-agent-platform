/**
 * Cost Estimation Service
 *
 * Provides cost estimates for tasks based on historical data from completed tasks.
 * Uses AVG(cost_usd) grouped by division to predict costs for new tasks, with
 * fallback defaults when insufficient historical data is available.
 *
 * The estimation strategy:
 * 1. Division-specific average: most accurate when a division has enough samples
 * 2. Global average: fallback when division data is sparse
 * 3. Default cost: used when no historical data exists at all
 *
 * Confidence levels reflect sample size:
 * - high: 20+ samples (default threshold)
 * - medium: 5-19 samples
 * - low: 1-4 samples
 * - default: no samples available
 *
 * @see docs_zh/contracts/billing_contract.md
 */
/** Default configuration values */
const DEFAULT_CONFIG = {
    highConfidenceThreshold: 20,
    mediumConfidenceThreshold: 5,
    defaultCostUsd: 0.05,
};
/**
 * Estimates task costs based on historical data.
 *
 * Uses a tiered approach: division-specific averages are most accurate,
 * but fall back to global averages when division data is insufficient.
 */
export class CostEstimationService {
    db;
    config;
    constructor(db, config) {
        this.db = db;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Estimates the cost for a new task based on historical data.
     * First attempts division-specific average, then falls back to global average,
     * then to a configured default.
     *
     * @param divisionId - Optional division to scope the estimate
     * @returns Cost estimate with confidence level and source
     */
    estimate(divisionId) {
        // Try division-specific average first
        if (divisionId) {
            const divisionResult = this.db.connection
                .prepare(`SELECT AVG(ce.cost_usd) AS avg_cost, COUNT(*) AS sample_count
           FROM cost_events ce
           INNER JOIN tasks t ON ce.task_id = t.id
           WHERE t.division_id = ?
             AND t.status IN ('done', 'failed')
             AND ce.cost_usd > 0`)
                .get(divisionId);
            if (divisionResult?.avg_cost != null && divisionResult.sample_count > 0) {
                return {
                    estimatedCostUsd: Math.round(divisionResult.avg_cost * 10000) / 10000,
                    confidence: this.assessConfidence(divisionResult.sample_count),
                    sampleCount: divisionResult.sample_count,
                    divisionId,
                    basedOn: "division_avg",
                };
            }
        }
        // Fallback to global average
        const globalResult = this.db.connection
            .prepare(`SELECT AVG(cost_usd) AS avg_cost, COUNT(*) AS sample_count
         FROM cost_events
         WHERE cost_usd > 0`)
            .get();
        if (globalResult?.avg_cost != null && globalResult.sample_count > 0) {
            return {
                estimatedCostUsd: Math.round(globalResult.avg_cost * 10000) / 10000,
                confidence: this.assessConfidence(globalResult.sample_count),
                sampleCount: globalResult.sample_count,
                divisionId: null,
                basedOn: "global_avg",
            };
        }
        // No historical data — return default
        return {
            estimatedCostUsd: this.config.defaultCostUsd,
            confidence: "default",
            sampleCount: 0,
            divisionId: null,
            basedOn: "default",
        };
    }
    /**
     * Determines confidence level based on sample count.
     */
    assessConfidence(sampleCount) {
        if (sampleCount >= this.config.highConfidenceThreshold)
            return "high";
        if (sampleCount >= this.config.mediumConfidenceThreshold)
            return "medium";
        return "low";
    }
}
//# sourceMappingURL=cost-estimation-service.js.map