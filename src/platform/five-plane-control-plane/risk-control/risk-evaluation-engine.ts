/**
 * RiskEvaluationEngine
 *
 * Implements ADR-026 8-factor weighted scoring algorithm.
 *
 * ## ADR-026 8-Factor Canonical Model
 *
 * risk_score = Σ(factor_weight × factor_value) / 18
 *
 * Factor weights per ADR-026:
 *   operationRisk:             weight=3
 *   targetResourceCriticality: weight=3
 *   dataSensitivity:           weight=3
 *   autonomyModeRisk:          weight=2
 *   tenantImpact:              weight=2
 *   blastRadius:               weight=2
 *   historicalFailureRate:    weight=2
 *   evidenceConfidence:        weight=1
 *
 * Factor values are normalized to [0, 1] scale.
 * Max possible weighted score = 18 (divisor 18 produces normalized 0-1 score).
 *
 * ## Risk Level Mapping
 *
 *   0.0 - 0.25  →  low
 *   0.25 - 0.50 →  medium
 *   0.50 - 0.75 →  high
 *   0.75 - 1.00 →  critical
 *
 * ## Risk Control Actions
 *
 * | risk_level | auto_execute | log_level | approval | side_effect    | evidence |
 * |------------|--------------|-----------|----------|----------------|----------|
 * | low        | ✅           | info      | no        | normal          | basic      |
 * | medium     | ✅           | warn      | no        | normal+validate | enhanced   |
 * | high       | ❌           | error     | required   | restricted     | complete   |
 * | critical   | ❌           | critical  | break-glass | prohibited    | legal-grade |
 *
 * @see docs_en/adr/026-risk-control-architecture.md
 */

import type {
  RiskEvaluationRequest,
  RiskEvaluationResult,
  RiskEvaluationEngineOptions,
  RiskConfig,
  RiskLevel,
  OperationRisk,
  TargetResourceCriticality,
  DataSensitivity,
  AutonomyModeRisk,
  TenantImpact,
  BlastRadius,
  HistoricalFailureRate,
  EvidenceConfidence,
  RiskLevelActionConfig,
} from "./types.js";

/**
 * Max possible weighted score = 18 (ADR-026 8-factor model)
 * operationRisk: 3×5=15, targetResourceCriticality: 3×5=15, dataSensitivity: 3×5=15
 * autonomyModeRisk: 2×5=10, tenantImpact: 2×5=10, blastRadius: 2×5=10
 * historicalFailureRate: 2×5=10, evidenceConfidence: 1×5=5
 * Total max = 18
 */
const MAX_POSSIBLE_SCORE = 18;

export class RiskEvaluationEngine {
  private readonly config: RiskConfig;
  private readonly domainRiskProfiles: ReadonlyMap<string, RiskLevel>;

  public constructor(options: RiskEvaluationEngineOptions) {
    this.config = options.config;
    this.domainRiskProfiles = options.domainRiskProfiles ?? new Map();
  }

  /**
   * Evaluate risk for a given request per §10.2 and §10.3
   */
  public evaluate(request: RiskEvaluationRequest): RiskEvaluationResult {
    const { factors } = request;

    const factorBreakdown = this.computeFactorBreakdown(factors);
    const totalWeightedScore = factorBreakdown.reduce((sum, f) => sum + f.weightedValue, 0);
    const riskScore = totalWeightedScore / MAX_POSSIBLE_SCORE;

    const baseRiskLevel = this.mapScoreToLevel(riskScore);
    const riskLevel = this.applyDomainOverride(baseRiskLevel, request.domainId);

    const actions = this.determineActions(riskLevel);
    const actionConfig = this.config.riskLevelActions[riskLevel];

    const baseResult = {
      taskId: request.taskId,
      riskScore: Math.round(riskScore * 1000) / 1000,
      riskLevel,
      actions,
      evidenceLevel: actionConfig.evidenceLevel,
      logLevel: actionConfig.logLevel,
      autoExecute: actionConfig.autoExecute,
      sideEffect: actionConfig.sideEffect,
      factorBreakdown,
    };

    if (actionConfig.requiresApproval) {
      return {
        ...baseResult,
        requiresApproval: true as const,
        approvalType: actionConfig.approvalType as "standard" | "break_glass",
      };
    }

    return { ...baseResult, requiresApproval: false as const };
  }

  /**
   * Compute weighted factor breakdown per ADR-026 8-factor formula
   */
  private computeFactorBreakdown(
    factors: RiskEvaluationRequest["factors"],
  ): RiskEvaluationResult["factorBreakdown"] {
    const { factorWeights } = this.config;

    const operationRiskValue = this.config.operationRiskValues[factors.operationRisk];
    const targetResourceValue = this.config.targetResourceCriticalityValues[factors.targetResourceCriticality];
    const dataSensitivityValue = this.config.dataSensitivityValues[factors.dataSensitivity];
    const autonomyModeValue = this.config.autonomyModeRiskValues[factors.autonomyModeRisk];
    const tenantImpactValue = this.config.tenantImpactValues[factors.tenantImpact];
    const blastRadiusValue = this.config.blastRadiusValues[factors.blastRadius];
    const historicalFailureValue = this.computeHistoricalFailureValue(factors.historicalFailureRate);
    const evidenceConfidenceValue = this.config.evidenceConfidenceValues[factors.evidenceConfidence];

    return [
      {
        factor: "operationRisk",
        value: operationRiskValue,
        weight: factorWeights.operationRisk,
        weightedValue: operationRiskValue * factorWeights.operationRisk,
      },
      {
        factor: "targetResourceCriticality",
        value: targetResourceValue,
        weight: factorWeights.targetResourceCriticality,
        weightedValue: targetResourceValue * factorWeights.targetResourceCriticality,
      },
      {
        factor: "dataSensitivity",
        value: dataSensitivityValue,
        weight: factorWeights.dataSensitivity,
        weightedValue: dataSensitivityValue * factorWeights.dataSensitivity,
      },
      {
        factor: "autonomyModeRisk",
        value: autonomyModeValue,
        weight: factorWeights.autonomyModeRisk,
        weightedValue: autonomyModeValue * factorWeights.autonomyModeRisk,
      },
      {
        factor: "tenantImpact",
        value: tenantImpactValue,
        weight: factorWeights.tenantImpact,
        weightedValue: tenantImpactValue * factorWeights.tenantImpact,
      },
      {
        factor: "blastRadius",
        value: blastRadiusValue,
        weight: factorWeights.blastRadius,
        weightedValue: blastRadiusValue * factorWeights.blastRadius,
      },
      {
        factor: "historicalFailureRate",
        value: historicalFailureValue,
        weight: factorWeights.historicalFailureRate,
        weightedValue: historicalFailureValue * factorWeights.historicalFailureRate,
      },
      {
        factor: "evidenceConfidence",
        value: evidenceConfidenceValue,
        weight: factorWeights.evidenceConfidence,
        weightedValue: evidenceConfidenceValue * factorWeights.evidenceConfidence,
      },
    ];
  }

  /**
   * Map historical failure rate category to factor value per ADR-026
   */
  private computeHistoricalFailureValue(category: HistoricalFailureRate): number {
    const { historicalFailureRateThresholds } = this.config;
    switch (category) {
      case "low":
        return historicalFailureRateThresholds.low.value;
      case "medium":
        return historicalFailureRateThresholds.medium.value;
      case "high":
        return historicalFailureRateThresholds.high.value;
      case "critical":
        return historicalFailureRateThresholds.critical.value;
    }
  }

  /**
   * Map normalized score to risk level per §10.2 thresholds
   */
  private mapScoreToLevel(score: number): RiskLevel {
    const { riskLevelThresholds } = this.config;
    if (score >= riskLevelThresholds.critical) return "critical";
    if (score >= riskLevelThresholds.high) return "high";
    if (score >= riskLevelThresholds.medium) return "medium";
    return "low";
  }

  /**
   * Apply domain-level risk profile override if configured
   * Domain profiles can raise (but not lower) the risk level
   */
  private applyDomainOverride(baseLevel: RiskLevel, domainId?: string): RiskLevel {
    if (!domainId) return baseLevel;

    const domainOverride = this.domainRiskProfiles.get(domainId);
    if (!domainOverride) return baseLevel;

    const levelOrder: RiskLevel[] = ["low", "medium", "high", "critical"];
    const baseIndex = levelOrder.indexOf(baseLevel);
    const overrideIndex = levelOrder.indexOf(domainOverride);

    return overrideIndex > baseIndex ? domainOverride : baseLevel;
  }

  /**
   * Determine risk control actions based on level per §10.3 matrix
   */
  private determineActions(level: RiskLevel): readonly string[] {
    const actions: string[] = [];

    switch (level) {
      case "low":
        actions.push("log", "proceed");
        break;
      case "medium":
        actions.push("log", "proceed_with_validation", "enhanced_monitoring");
        break;
      case "high":
        actions.push("log", "block", "require_approval", "full_evidence");
        break;
      case "critical":
        actions.push("log", "block", "require_break_glass_approval", "legal_evidence", "incident_create");
        break;
    }

    return actions;
  }
}

/**
 * Risk evaluation engine error
 */
export class RiskEvaluationError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "RiskEvaluationError";
  }
}
