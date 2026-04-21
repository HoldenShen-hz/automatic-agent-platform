/**
 * RiskEvaluationEngine
 *
 * Implements §10 risk scoring algorithm and automated risk control engine.
 *
 * ## §10.2 Risk Scoring Algorithm
 *
 * risk_score = Σ(factor_weight × factor_value) / max_possible_score
 *
 * Factor weights per §10.2:
 *   step_type_risk:      weight=3  (read=1, write=3, delete=5, external_call=4)
 *   target_system_risk:  weight=4  (internal=1, staging=2, production=5)
 *   data_class_risk:     weight=3  (public=1, internal=2, confidential=4, restricted=5)
 *   blast_radius:        weight=2  (single_task=1, workflow=2, tenant=3, platform=5)
 *   prior_failure_rate:  weight=2  (0-10%=1, 10-30%=2, 30-50%=3, >50%=5)
 *   confidence:          weight=1  (high=1, medium=3, low=5)
 *
 * ## §10.3 Risk Level Mapping
 *
 *   0.0 - 0.25  →  low
 *   0.25 - 0.50 →  medium
 *   0.50 - 0.75 →  high
 *   0.75 - 1.00 →  critical
 *
 * ## §10.3 Risk Control Actions
 *
 * | risk_level | auto_execute | log_level | approval | side_effect    | evidence |
 * |------------|--------------|-----------|----------|----------------|----------|
 * | low        | ✅           | info      | 否       | 正常           | 基础      |
 * | medium     | ✅           | warn      | 否       | 正常+校验      | 增强      |
 * | high       | ❌           | error     | 必须      | 受限           | 完整      |
 * | critical   | ❌           | critical  | break-glass | 禁止        | 法务级   |
 *
 * @see docs_zh/architecture/00-platform-architecture.md §10
 */
import type { RiskEvaluationRequest, RiskEvaluationResult, RiskEvaluationEngineOptions } from "./types.js";
export declare class RiskEvaluationEngine {
    private readonly config;
    private readonly domainRiskProfiles;
    constructor(options: RiskEvaluationEngineOptions);
    /**
     * Evaluate risk for a given request per §10.2 and §10.3
     */
    evaluate(request: RiskEvaluationRequest): RiskEvaluationResult;
    /**
     * Compute weighted factor breakdown per §10.2 formula
     */
    private computeFactorBreakdown;
    /**
     * Map prior failure rate percentage to factor value per §10.2
     */
    private computePriorFailureValue;
    /**
     * Map normalized score to risk level per §10.2 thresholds
     */
    private mapScoreToLevel;
    /**
     * Apply domain-level risk profile override if configured
     * Domain profiles can raise (but not lower) the risk level
     */
    private applyDomainOverride;
    /**
     * Determine risk control actions based on level per §10.3 matrix
     */
    private determineActions;
}
/**
 * Risk evaluation engine error
 */
export declare class RiskEvaluationError extends Error {
    readonly code: string;
    constructor(message: string, code: string, details?: unknown);
}
