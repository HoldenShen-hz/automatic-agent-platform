/**
 * RiskEvaluationEngine
 *
 * Implements §10 risk scoring algorithm and automated risk control engine.
 *
 * ## §10.2 Risk Scoring Algorithm (ADR-026 v4.3 canonical 8-factor model)
 *
 * The engine implements the canonical 8-factor model, but the exact factor
 * weights are sourced from `config/risk/default.json` through `RiskConfig`.
 * Keep documentation aligned with the config loader instead of duplicating a
 * stale hard-coded formula here.
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
 * @see docs_zh/adr/026-risk-control-architecture.md ADR-026 v4.3
 */

import type {
  RiskEvaluationRequest,
  RiskEvaluationResult,
  RiskEvaluationEngineOptions,
  RiskConfig,
  RiskLevel,
  RiskLevelActionConfig,
} from "./types.js";

/**
 * ADR-026 v4.3 canonical config currently normalizes the weighted raw score to
 * a 0-1 range by dividing by the configured maximum possible score.
 */
const MAX_POSSIBLE_SCORE = 100;

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
   * Compute weighted factor breakdown per ADR-026 v4.3 8-factor formula
   */
  private computeFactorBreakdown(
    factors: RiskEvaluationRequest["factors"],
  ): RiskEvaluationResult["factorBreakdown"] {
    const { factorWeights } = this.config;

    // Map evidenceConfidence string to numeric value
    const evidenceConfidenceMap: Record<string, number> = {
      high: 1,
      medium: 3,
      low: 5,
    };
    const evidenceValue = evidenceConfidenceMap[factors.evidenceConfidence] ?? 3;

    // Map historicalFailureRate (0-100%) to 1-5 scale
    const historicalFailureValue = this.computeHistoricalFailureValue(factors.historicalFailureRate);

    return [
      {
        factor: "impact",
        value: factors.impact,
        weight: factorWeights.impact,
        weightedValue: factors.impact * factorWeights.impact,
      },
      {
        factor: "irreversibility",
        value: factors.irreversibility,
        weight: factorWeights.irreversibility,
        weightedValue: factors.irreversibility * factorWeights.irreversibility,
      },
      {
        factor: "dataSensitivity",
        value: factors.dataSensitivity,
        weight: factorWeights.dataSensitivity,
        weightedValue: factors.dataSensitivity * factorWeights.dataSensitivity,
      },
      {
        factor: "autonomyModeRisk",
        value: factors.autonomyModeRisk,
        weight: factorWeights.autonomyModeRisk,
        weightedValue: factors.autonomyModeRisk * factorWeights.autonomyModeRisk,
      },
      {
        factor: "tenantImpact",
        value: factors.tenantImpact,
        weight: factorWeights.tenantImpact,
        weightedValue: factors.tenantImpact * factorWeights.tenantImpact,
      },
      {
        factor: "blastRadius",
        value: factors.blastRadius,
        weight: factorWeights.blastRadius,
        weightedValue: factors.blastRadius * factorWeights.blastRadius,
      },
      {
        factor: "historicalFailureRate",
        value: historicalFailureValue,
        weight: factorWeights.historicalFailureRate,
        weightedValue: historicalFailureValue * factorWeights.historicalFailureRate,
      },
      {
        factor: "evidenceConfidence",
        value: evidenceValue,
        weight: factorWeights.evidenceConfidence,
        weightedValue: evidenceValue * factorWeights.evidenceConfidence,
      },
    ];
  }

  /**
   * Map historical failure rate percentage to factor value (1-5 scale) per ADR-026 v4.3
   */
  private computeHistoricalFailureValue(percent: number): number {
    const { historicalFailureRateThresholds } = this.config;
    if (percent <= historicalFailureRateThresholds.low.maxPercent) return historicalFailureRateThresholds.low.value;
    if (percent <= historicalFailureRateThresholds.medium.maxPercent) return historicalFailureRateThresholds.medium.value;
    if (percent <= historicalFailureRateThresholds.high.maxPercent) return historicalFailureRateThresholds.high.value;
    return historicalFailureRateThresholds.critical.value;
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
