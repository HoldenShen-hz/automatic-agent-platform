/**
 * Cost Estimation Contract Types
 *
 * Defines the inter-plane contract for cost estimation.
 * This allows P1 (Interaction) and P2 (Control Plane) to consume
 * cost estimation without direct coupling to scale-ecosystem.
 *
 * @see docs_zh/architecture/00-platform-architecture.md
 */

/**
 * Result of a cost estimation request.
 */
export interface CostEstimate {
  /** Estimated cost in USD */
  readonly estimatedCostUsd: number;
  /** Confidence level based on sample size */
  readonly confidence: "high" | "medium" | "low" | "default";
  /** Number of historical samples used for this estimate */
  readonly sampleCount: number;
  /** Division ID used for the estimate (null if global) */
  readonly divisionId: string | null;
  /** What data source was used for this estimate */
  readonly basedOn: "division_avg" | "global_avg" | "default" | "llm_estimate";
}

/**
 * Configuration options for cost estimation.
 */
export interface CostEstimationConfig {
  /** Minimum sample count for high confidence (default: 20) */
  readonly highConfidenceThreshold?: number;
  /** Minimum sample count for medium confidence (default: 5) */
  readonly mediumConfidenceThreshold?: number;
  /** Default cost when no historical data is available (default: 0.05 USD) */
  readonly defaultCostUsd?: number;
}

/**
 * Port interface for cost estimation service.
 */
export interface CostEstimationServicePort {
  /**
   * Estimates the cost for a new task based on historical data.
   */
  estimate(divisionId?: string | null): CostEstimate;
}
