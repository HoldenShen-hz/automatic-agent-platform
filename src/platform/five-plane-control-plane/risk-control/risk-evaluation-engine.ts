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
    if (this.isLegacyRequest(request)) {
      return this.evaluateLegacy(request);
    }
    if (this.isSixFactorRequest(request)) {
      return this.evaluateSixFactor(request);
    }
    const { factors } = request;

    const factorBreakdown = this.computeFactorBreakdown(factors);
    const totalWeightedScore = factorBreakdown.reduce((sum, f) => sum + f.weightedValue, 0);
    const riskScore = totalWeightedScore / MAX_POSSIBLE_SCORE;

    const baseRiskLevel = this.isCriticalCanonicalFactorSet(factors) ? "critical" : this.mapScoreToLevel(riskScore);
    const riskLevel = this.applyDomainOverride(baseRiskLevel, request.domainId);

    const actionConfig = this.config.riskLevelActions[riskLevel];
    const actions = this.determineActions(riskLevel, actionConfig);

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

  private evaluateLegacy(request: RiskEvaluationRequest): RiskEvaluationResult {
    const factors = request.factors as Record<string, unknown>;
    const factorWeights = this.config.factorWeights;
    const factorBreakdown = [
      this.makeLegacyFactor("operationRisk", this.mapLegacyOperationRisk(String(factors.operationRisk ?? "read")), factorWeights.impact),
      this.makeLegacyFactor("targetResourceCriticality", this.mapLegacyTargetResourceCriticality(String(factors.targetResourceCriticality ?? "internal")), factorWeights.irreversibility),
      this.makeLegacyFactor("dataSensitivity", this.mapLegacyDataSensitivity(String(factors.dataSensitivity ?? "public")), factorWeights.dataSensitivity),
      this.makeLegacyFactor("autonomyModeRisk", this.mapLegacyAutonomyModeRisk(String(factors.autonomyModeRisk ?? "suggestion")), factorWeights.autonomyModeRisk),
      this.makeLegacyFactor("tenantImpact", this.mapLegacyTenantImpact(String(factors.tenantImpact ?? "single_task")), factorWeights.tenantImpact),
      this.makeLegacyFactor("blastRadius", this.mapLegacyBlastRadius(String(factors.blastRadius ?? "single_task")), factorWeights.blastRadius),
      this.makeLegacyFactor("historicalFailureRate", this.mapLegacyHistoricalFailureRate(String(factors.historicalFailureRate ?? "low")), factorWeights.historicalFailureRate),
      this.makeLegacyFactor("evidenceConfidence", this.mapLegacyEvidenceConfidence(String(factors.evidenceConfidence ?? "high")), factorWeights.evidenceConfidence),
    ];
    const totalWeightedScore = factorBreakdown.reduce((sum, factor) => sum + factor.weightedValue, 0);
    const riskScore = Math.min(1, Math.max(0, totalWeightedScore / MAX_POSSIBLE_SCORE));
    const riskLevel = this.mapScoreToLevel(riskScore);
    const actionConfig = this.config.riskLevelActions[riskLevel];
    const baseResult = {
      taskId: request.taskId,
      riskScore: Math.round(riskScore * 1000) / 1000,
      riskLevel,
      actions: this.determineActions(riskLevel, actionConfig),
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

  private evaluateSixFactor(request: RiskEvaluationRequest): RiskEvaluationResult {
    const factors = request.factors as Record<string, unknown>;
    const factorWeights = this.config.factorWeights;
    const factorBreakdown = [
      this.makeLegacyFactor(
        "stepTypeRisk",
        this.lookupLegacyMappedValue(this.config.stepTypeRiskValues, String(factors.stepTypeRisk ?? "read"), 1),
        factorWeights.stepTypeRisk ?? 0,
      ),
      this.makeLegacyFactor(
        "targetSystemRisk",
        this.lookupLegacyMappedValue(this.config.targetSystemRiskValues, String(factors.targetSystemRisk ?? "internal"), 1),
        factorWeights.targetSystemRisk ?? 0,
      ),
      this.makeLegacyFactor(
        "dataClassRisk",
        this.lookupLegacyMappedValue(this.config.dataClassRiskValues, String(factors.dataClassRisk ?? "public"), 1),
        factorWeights.dataClassRisk ?? 0,
      ),
      this.makeLegacyFactor(
        "blastRadius",
        this.lookupLegacyMappedValue(this.config.blastRadiusValues, String(factors.blastRadius ?? "single_task"), 1),
        factorWeights.blastRadius ?? 0,
      ),
      this.makeLegacyFactor(
        "priorFailureRate",
        this.computeLegacyPriorFailureRateValue(Number(factors.priorFailureRatePercent ?? 0)),
        factorWeights.priorFailureRate ?? 0,
      ),
      this.makeLegacyFactor(
        "confidence",
        this.lookupLegacyMappedValue(this.config.confidenceValues, String(factors.confidence ?? "high"), 1),
        factorWeights.confidence ?? 0,
      ),
    ];

    const totalWeightedScore = factorBreakdown.reduce((sum, factor) => sum + factor.weightedValue, 0);
    const maxPossibleScore = (factorWeights.stepTypeRisk ?? 0) * 5
      + (factorWeights.targetSystemRisk ?? 0) * 5
      + (factorWeights.dataClassRisk ?? 0) * 5
      + (factorWeights.blastRadius ?? 0) * 5
      + (factorWeights.priorFailureRate ?? 0) * 5
      + (factorWeights.confidence ?? 0) * 5;
    const denominator = maxPossibleScore > 0 ? maxPossibleScore : MAX_POSSIBLE_SCORE;
    const riskScore = Math.min(1, Math.max(0, totalWeightedScore / denominator));
    const baseRiskLevel = this.mapScoreToLevel(riskScore);
    const riskLevel = this.applyDomainOverride(baseRiskLevel, request.domainId);
    const actionConfig = this.config.riskLevelActions[riskLevel];
    const baseResult = {
      taskId: request.taskId,
      riskScore: Math.round(riskScore * 1000) / 1000,
      riskLevel,
      actions: this.determineActions(riskLevel, actionConfig),
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
    const canonicalFactors = factors as {
      impact: number;
      irreversibility: number;
      dataSensitivity: number;
      autonomyModeRisk: number;
      tenantImpact: number;
      blastRadius: number;
      historicalFailureRate: number;
      evidenceConfidence: "high" | "medium" | "low";
    };

    // Map evidenceConfidence string to numeric value
    const evidenceConfidenceMap: Record<string, number> = {
      high: 1,
      medium: 3,
      low: 5,
    };
    const evidenceValue = evidenceConfidenceMap[canonicalFactors.evidenceConfidence] ?? 3;

    // Map historicalFailureRate (0-100%) to 1-5 scale
    const historicalFailureValue = this.computeHistoricalFailureValue(canonicalFactors.historicalFailureRate);

    return [
      {
        factor: "impact",
        value: canonicalFactors.impact,
        weight: factorWeights.impact,
        weightedValue: canonicalFactors.impact * factorWeights.impact,
      },
      {
        factor: "irreversibility",
        value: canonicalFactors.irreversibility,
        weight: factorWeights.irreversibility,
        weightedValue: canonicalFactors.irreversibility * factorWeights.irreversibility,
      },
      {
        factor: "dataSensitivity",
        value: canonicalFactors.dataSensitivity,
        weight: factorWeights.dataSensitivity,
        weightedValue: canonicalFactors.dataSensitivity * factorWeights.dataSensitivity,
      },
      {
        factor: "autonomyModeRisk",
        value: canonicalFactors.autonomyModeRisk,
        weight: factorWeights.autonomyModeRisk,
        weightedValue: canonicalFactors.autonomyModeRisk * factorWeights.autonomyModeRisk,
      },
      {
        factor: "tenantImpact",
        value: canonicalFactors.tenantImpact,
        weight: factorWeights.tenantImpact,
        weightedValue: canonicalFactors.tenantImpact * factorWeights.tenantImpact,
      },
      {
        factor: "blastRadius",
        value: canonicalFactors.blastRadius,
        weight: factorWeights.blastRadius,
        weightedValue: canonicalFactors.blastRadius * factorWeights.blastRadius,
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
    const historicalFailureRateThresholds = this.config.historicalFailureRateThresholds ?? this.config.priorFailureRateThresholds;
    if (historicalFailureRateThresholds == null) {
      return 1;
    }
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
  private determineActions(level: RiskLevel, actionConfig?: RiskLevelActionConfig): readonly string[] {
    const actions: string[] = [];

    switch (level) {
      case "low":
        actions.push("log", "proceed");
        break;
      case "medium":
        actions.push("log");
        if (actionConfig?.requiresApproval) {
          actions.push("require_approval");
        }
        actions.push("proceed_with_validation", "enhanced_monitoring");
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

  private isCriticalCanonicalFactorSet(factors: RiskEvaluationRequest["factors"]): boolean {
    const canonicalFactors = factors as Partial<{
      impact: number;
      irreversibility: number;
      dataSensitivity: number;
      autonomyModeRisk: number;
      tenantImpact: number;
      blastRadius: number;
      historicalFailureRate: number;
      evidenceConfidence: "high" | "medium" | "low";
    }>;
    return canonicalFactors.impact === 5
      && canonicalFactors.irreversibility === 5
      && canonicalFactors.dataSensitivity === 5
      && canonicalFactors.autonomyModeRisk === 5
      && canonicalFactors.tenantImpact === 5
      && canonicalFactors.blastRadius === 5
      && (canonicalFactors.historicalFailureRate ?? 0) >= 50
      && canonicalFactors.evidenceConfidence === "low";
  }

  private isLegacyRequest(request: RiskEvaluationRequest): boolean {
    const factors = request.factors as Record<string, unknown>;
    return "operationRisk" in factors || "targetResourceCriticality" in factors;
  }

  private isSixFactorRequest(request: RiskEvaluationRequest): boolean {
    const factors = request.factors as Record<string, unknown>;
    return "stepTypeRisk" in factors
      || "targetSystemRisk" in factors
      || "dataClassRisk" in factors
      || "priorFailureRatePercent" in factors
      || "confidence" in factors;
  }

  private makeLegacyFactor(factor: string, value: number, weight: number) {
    return {
      factor,
      value,
      weight,
      weightedValue: value * weight,
    };
  }

  private lookupLegacyMappedValue(
    values: Readonly<Record<string, number>> | undefined,
    key: string,
    fallback: number,
  ): number {
    return values?.[key] ?? fallback;
  }

  private computeLegacyPriorFailureRateValue(percent: number): number {
    const thresholds = this.config.priorFailureRateThresholds ?? this.config.historicalFailureRateThresholds;
    if (thresholds == null) {
      return 1;
    }
    if (percent <= thresholds.low.maxPercent) return thresholds.low.value;
    if (percent <= thresholds.medium.maxPercent) return thresholds.medium.value;
    if (percent <= thresholds.high.maxPercent) return thresholds.high.value;
    return thresholds.critical.value;
  }

  private mapLegacyOperationRisk(value: string): number {
    switch (value) {
      case "delete":
        return 5;
      case "external_call":
        return 3;
      case "write":
        return 2;
      case "read":
      default:
        return 1;
    }
  }

  private mapLegacyTargetResourceCriticality(value: string): number {
    switch (value) {
      case "production":
        return 5;
      case "staging":
        return 3;
      case "internal":
      default:
        return 1;
    }
  }

  private mapLegacyDataSensitivity(value: string): number {
    switch (value) {
      case "restricted":
        return 4;
      case "confidential":
        return 3;
      case "internal":
        return 2;
      case "public":
      default:
        return 1;
    }
  }

  private mapLegacyAutonomyModeRisk(value: string): number {
    switch (value) {
      case "supervised":
        return 3;
      case "semi_auto":
        return 2;
      case "full_auto":
      case "suggestion":
      default:
        return 1;
    }
  }

  private mapLegacyTenantImpact(value: string): number {
    switch (value) {
      case "platform":
        return 5;
      case "tenant":
        return 3;
      case "workflow":
        return 2;
      case "single_task":
      default:
        return 1;
    }
  }

  private mapLegacyBlastRadius(value: string): number {
    switch (value) {
      case "platform":
        return 5;
      case "tenant":
        return 3;
      case "workflow":
        return 2;
      case "single_task":
      default:
        return 1;
    }
  }

  private mapLegacyHistoricalFailureRate(value: string): number {
    switch (value) {
      case "critical":
        return 5;
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
      default:
        return 1;
    }
  }

  private mapLegacyEvidenceConfidence(value: string): number {
    switch (value) {
      case "low":
        return 5;
      case "medium":
        return 3;
      case "high":
      default:
        return 1;
    }
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
