/**
 * @fileoverview Ops Maturity Score
 *
 * Provides cross-dimensional scoring for drift, compliance, cost, and explainability
 * per §69 requirements.
 */

import { newId, nowIso } from "../platform/contracts/types/ids.js";

export type OpsMaturityDimension = "drift" | "compliance" | "cost" | "explainability";

export interface OpsMaturityScore {
  readonly scoreId: string;
  readonly agentId?: string;
  readonly domainId?: string;
  readonly dimensions: Readonly<Record<OpsMaturityDimension, number>>;
  readonly overallScore: number;
  readonly riskFlags: readonly string[];
  readonly assessedAt: string;
  readonly nextAssessmentDueAt: string;
}

export interface OpsMaturityDimensionDetail {
  readonly dimension: OpsMaturityDimension;
  readonly score: number;
  readonly contributingFactors: readonly string[];
  readonly recommendedActions: readonly string[];
}

export interface OpsMaturityAssessmentInput {
  readonly driftScore: number;
  readonly complianceScore: number;
  readonly costScore: number;
  readonly explainabilityScore: number;
  readonly agentId?: string;
  readonly domainId?: string;
  readonly riskFlags?: readonly string[];
}

export class OpsMaturityScoreService {
  private readonly assessments = new Map<string, OpsMaturityScore[]>();

  public assess(input: OpsMaturityAssessmentInput): OpsMaturityScore {
    const dimensions: Record<OpsMaturityDimension, number> = {
      drift: Math.min(100, Math.max(0, input.driftScore)),
      compliance: Math.min(100, Math.max(0, input.complianceScore)),
      cost: Math.min(100, Math.max(0, input.costScore)),
      explainability: Math.min(100, Math.max(0, input.explainabilityScore)),
    };

    // Weighted overall score (compliance and explainability weighted higher for trust)
    const overallScore = Number((
      dimensions.drift * 0.2 +
      dimensions.compliance * 0.3 +
      dimensions.cost * 0.25 +
      dimensions.explainability * 0.25
    ).toFixed(2));

    const riskFlags = [...(input.riskFlags ?? [])];
    if (dimensions.drift < 50) riskFlags.push("drift_critical");
    if (dimensions.compliance < 60) riskFlags.push("compliance_gap");
    if (dimensions.cost < 50) riskFlags.push("cost_overrun");
    if (dimensions.explainability < 50) riskFlags.push("explainability_insufficient");

    const assessedAt = nowIso();
    const nextAssessmentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const score: OpsMaturityScore = {
      scoreId: newId("maturity_score"),
      ...(input.agentId !== undefined && { agentId: input.agentId }),
      ...(input.domainId !== undefined && { domainId: input.domainId }),
      dimensions,
      overallScore,
      riskFlags,
      assessedAt,
      nextAssessmentDueAt,
    };

    const key = input.agentId ?? input.domainId ?? "global";
    const existing = this.assessments.get(key) ?? [];
    this.assessments.set(key, [...existing, score]);

    return score;
  }

  public getLatestScore(key: string): OpsMaturityScore | null {
    const scores = this.assessments.get(key);
    if (!scores || scores.length === 0) return null;
    return scores.at(-1) ?? null;
  }

  public getScoreHistory(key: string): readonly OpsMaturityScore[] {
    return [...(this.assessments.get(key) ?? [])];
  }

  public getDimensionDetails(score: OpsMaturityScore): OpsMaturityDimensionDetail[] {
    const factors: Record<OpsMaturityDimension, readonly string[]> = {
      drift: score.dimensions.drift < 50 ? ["divergence_detected", "anti_gaming_possible"] : ["drift_within_tolerance"],
      compliance: score.dimensions.compliance < 60 ? ["control_gaps_found", "evidence_insufficient"] : ["compliance_satisfied"],
      cost: score.dimensions.cost < 50 ? ["budget_overrun", "optimization_needed"] : ["cost_optimal"],
      explainability: score.dimensions.explainability < 50 ? ["rationale_insufficient", "audit_trail_incomplete"] : ["explainability_satisfied"],
    };

    const actions: Record<OpsMaturityDimension, readonly string[]> = {
      drift: score.dimensions.drift < 50 ? ["immediate_rebalance_required", "monitor_agent_behavior"] : ["continue_monitoring"],
      compliance: score.dimensions.compliance < 60 ? ["address_control_gaps", "improve_evidence_collection"] : ["maintain_evidence_pipeline"],
      cost: score.dimensions.cost < 50 ? ["optimize_resource_usage", "review_pricing_model"] : ["cost_controls_effective"],
      explainability: score.dimensions.explainability < 50 ? ["improve_stage_rationale", "enhance_audit_trail"] : ["explainability_meets_requirements"],
    };

    return (["drift", "compliance", "cost", "explainability"] as const).map((dim) => ({
      dimension: dim,
      score: score.dimensions[dim],
      contributingFactors: factors[dim],
      recommendedActions: actions[dim],
    }));
  }
}