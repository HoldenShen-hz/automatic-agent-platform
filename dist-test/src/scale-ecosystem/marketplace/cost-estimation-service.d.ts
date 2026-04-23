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
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
/** Result of a cost estimation request */
export interface CostEstimate {
    /** Estimated cost in USD */
    estimatedCostUsd: number;
    /** Confidence level based on sample size */
    confidence: "high" | "medium" | "low" | "default";
    /** Number of historical samples used for this estimate */
    sampleCount: number;
    /** Division ID used for the estimate (null if global) */
    divisionId: string | null;
    /** What data source was used for this estimate */
    basedOn: "division_avg" | "global_avg" | "default";
}
/** Configuration options for cost estimation */
export interface CostEstimationConfig {
    /** Minimum sample count for high confidence (default: 20) */
    highConfidenceThreshold?: number;
    /** Minimum sample count for medium confidence (default: 5) */
    mediumConfidenceThreshold?: number;
    /** Default cost when no historical data is available (default: 0.05 USD) */
    defaultCostUsd?: number;
}
/**
 * Estimates task costs based on historical data.
 *
 * Uses a tiered approach: division-specific averages are most accurate,
 * but fall back to global averages when division data is insufficient.
 */
export declare class CostEstimationService {
    private readonly db;
    private readonly config;
    constructor(db: AuthoritativeSqlDatabase, config?: CostEstimationConfig);
    /**
     * Estimates the cost for a new task based on historical data.
     * First attempts division-specific average, then falls back to global average,
     * then to a configured default.
     *
     * @param divisionId - Optional division to scope the estimate
     * @returns Cost estimate with confidence level and source
     */
    estimate(divisionId?: string | null): CostEstimate;
    /**
     * Determines confidence level based on sample count.
     */
    private assessConfidence;
}
