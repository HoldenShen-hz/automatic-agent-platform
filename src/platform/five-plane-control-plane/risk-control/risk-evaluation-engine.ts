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
 * | low        | ✅           | info      | no        | normal          | basic      |
 * | medium     | ✅           | warn      | no        | normal+validate | enhanced   |
 * | high       | ❌           | error     | required   | restricted     | complete   |
 * | critical   | ❌           | critical  | break-glass | prohibited    | legal-grade |
 *
 * @see docs_zh/architecture/00-platform-architecture.md §10
 */

import type {
  RiskEvaluationRequest,
  RiskEvaluationResult,
  RiskEvaluationEngineOptions,
  RiskConfig,
  RiskLevel,
  StepTypeRisk,
  TargetSystemRisk,
  DataClassRisk,
  BlastRadius,
  ConfidenceLevel,
  RiskLevelActionConfig,
} from "./types.js";

/**
 * Max possible weighted score = sum of all (weight × max_value)
 * stepTypeRisk: 3×5=15, targetSystemRisk: 4×5=20, dataClassRisk: 3×5=15
 * blastRadius: 2×5=10, priorFailureRate: 2×5=10, confidence: 1×5=5
 * Total max = 75
 */
const MAX_POSSIBLE_SCORE = 75;

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
   * Compute weighted factor breakdown per §10.2 formula
   */
  private computeFactorBreakdown(
    factors: RiskEvaluationRequest["factors"],
  ): RiskEvaluationResult["factorBreakdown"] {
    const { factorWeights } = this.config;

    const stepTypeValue = this.config.stepTypeRiskValues[factors.stepTypeRisk];
    const targetValue = this.config.targetSystemRiskValues[factors.targetSystemRisk];
    const dataClassValue = this.config.dataClassRiskValues[factors.dataClassRisk];
    const blastRadiusValue = this.config.blastRadiusValues[factors.blastRadius];
    const priorFailureValue = this.computePriorFailureValue(factors.priorFailureRatePercent);
    const confidenceValue = this.config.confidenceValues[factors.confidence];

    return [
      {
        factor: "stepTypeRisk",
        value: stepTypeValue,
        weight: factorWeights.stepTypeRisk,
        weightedValue: stepTypeValue * factorWeights.stepTypeRisk,
      },
      {
        factor: "targetSystemRisk",
        value: targetValue,
        weight: factorWeights.targetSystemRisk,
        weightedValue: targetValue * factorWeights.targetSystemRisk,
      },
      {
        factor: "dataClassRisk",
        value: dataClassValue,
        weight: factorWeights.dataClassRisk,
        weightedValue: dataClassValue * factorWeights.dataClassRisk,
      },
      {
        factor: "blastRadius",
        value: blastRadiusValue,
        weight: factorWeights.blastRadius,
        weightedValue: blastRadiusValue * factorWeights.blastRadius,
      },
      {
        factor: "priorFailureRate",
        value: priorFailureValue,
        weight: factorWeights.priorFailureRate,
        weightedValue: priorFailureValue * factorWeights.priorFailureRate,
      },
      {
        factor: "confidence",
        value: confidenceValue,
        weight: factorWeights.confidence,
        weightedValue: confidenceValue * factorWeights.confidence,
      },
    ];
  }

  /**
   * Map prior failure rate percentage to factor value per §10.2
   */
  private computePriorFailureValue(percent: number): number {
    const { priorFailureRateThresholds } = this.config;
    if (percent <= priorFailureRateThresholds.low.maxPercent) return priorFailureRateThresholds.low.value;
    if (percent <= priorFailureRateThresholds.medium.maxPercent) return priorFailureRateThresholds.medium.value;
    if (percent <= priorFailureRateThresholds.high.maxPercent) return priorFailureRateThresholds.high.value;
    return priorFailureRateThresholds.critical.value;
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
