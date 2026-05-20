export interface RiskFactors {
  readonly impact: number;
  readonly irreversibility: number;
  readonly dataSensitivity: number;
  readonly autonomyModeRisk: number;
  readonly tenantImpact: number;
  readonly blastRadius: number;
  readonly historicalFailureRate: number;
  readonly evidenceConfidence: "low" | "medium" | "high";
}

export interface RiskEvaluationDecision {
  readonly riskScore: number;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
}

export interface RiskEvaluationProvider {
  evaluate(input: {
    taskId: string;
    factors: RiskFactors;
  }): RiskEvaluationDecision;
}

export class DefaultRiskEvaluationProvider implements RiskEvaluationProvider {
  public evaluate(input: { taskId: string; factors: RiskFactors }): RiskEvaluationDecision {
    void input.taskId;
    const confidencePenalty =
      input.factors.evidenceConfidence === "low"
        ? 0.12
        : input.factors.evidenceConfidence === "medium"
          ? 0.05
          : 0;
    const weightedScore = (
      input.factors.impact * 0.16
      + input.factors.irreversibility * 0.16
      + input.factors.dataSensitivity * 0.12
      + input.factors.autonomyModeRisk * 0.14
      + input.factors.tenantImpact * 0.12
      + input.factors.blastRadius * 0.15
      + Math.min(5, input.factors.historicalFailureRate / 20) * 0.15
    ) / 5;
    const riskScore = Math.max(0, Math.min(1, weightedScore + confidencePenalty));
    const riskLevel =
      riskScore >= 0.85
        ? "critical"
        : riskScore >= 0.65
          ? "high"
          : riskScore >= 0.4
            ? "medium"
            : "low";
    return {
      riskScore,
      riskLevel,
    };
  }
}
