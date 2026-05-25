/**
 * Promotion Gate
 *
 * Decides whether a proposal can be promoted based on evaluation
 * reports and frozen state.
 */

import type { ImprovementProposal } from './proposal-engine.js';
import type { EvaluationReport } from './benchmark-runner.js';

export interface PromotionGateConfig {
  minSuccessLift: number;      // Minimum required improvement in success rate (e.g., 0.03 = 3%)
  maxRegressionRate: number;    // Maximum allowed regression rate (e.g., 0.01 = 1%)
  maxCostIncrease: number;      // Maximum allowed cost increase (e.g., 0.10 = 10%)
  maxLatencyIncrease: number;  // Maximum allowed latency increase (e.g., 0.15 = 15%)
  maxSafetyViolations: number; // Maximum allowed safety violations (usually 0)
}

export interface PromotionDecision {
  allowed: boolean;
  reasons: string[];
  stage: 'draft' | 'reviewed' | 'staged' | 'stable' | 'retired' | 'rejected';
}

export const DEFAULT_PROMOTION_GATE_CONFIG: PromotionGateConfig = {
  minSuccessLift: 0.03,
  maxRegressionRate: 0.01,
  maxCostIncrease: 0.10,
  maxLatencyIncrease: 0.15,
  maxSafetyViolations: 0,
};

export class PromotionGate {
  constructor(private readonly config: PromotionGateConfig = DEFAULT_PROMOTION_GATE_CONFIG) {}

  decide(
    proposal: ImprovementProposal,
    report: EvaluationReport,
    frozen: boolean,
    currentStage?: string
  ): PromotionDecision {
    const reasons: string[] = [];

    // Check frozen state
    if (frozen) {
      reasons.push('Evolution system is frozen');
      return {
        allowed: false,
        reasons,
        stage: 'rejected',
      };
    }

    // High-risk proposals always require manual approval
    if (proposal.risk === 'high') {
      reasons.push('High-risk proposals require manual approval');
      return {
        allowed: false,
        reasons,
        stage: 'rejected',
      };
    }

    // Check evaluation metrics
    const successLift = report.successRateAfter - report.successRateBefore;
    if (successLift < this.config.minSuccessLift) {
      reasons.push(
        `Insufficient success lift: ${(successLift * 100).toFixed(1)}% < ${(this.config.minSuccessLift * 100).toFixed(1)}%`
      );
    }

    if (report.regressionRate > this.config.maxRegressionRate) {
      reasons.push(
        `Regression rate too high: ${(report.regressionRate * 100).toFixed(1)}% > ${(this.config.maxRegressionRate * 100).toFixed(1)}%`
      );
    }

    if (report.avgCostDelta > this.config.maxCostIncrease) {
      reasons.push(
        `Cost increase too high: ${(report.avgCostDelta * 100).toFixed(1)}% > ${(this.config.maxCostIncrease * 100).toFixed(1)}%`
      );
    }

    if (report.avgLatencyDelta > this.config.maxLatencyIncrease) {
      reasons.push(
        `Latency increase too high: ${(report.avgLatencyDelta * 100).toFixed(1)}% > ${(this.config.maxLatencyIncrease * 100).toFixed(1)}%`
      );
    }

    if (report.safetyViolations > this.config.maxSafetyViolations) {
      reasons.push(
        `Safety violations detected: ${report.safetyViolations} > ${this.config.maxSafetyViolations}`
      );
    }

    // Determine next stage
    let nextStage: PromotionDecision['stage'];
    if (reasons.length > 0) {
      nextStage = 'rejected';
    } else if (currentStage === 'reviewed') {
      nextStage = 'staged';
    } else if (currentStage === 'staged') {
      nextStage = 'stable';
    } else if (currentStage === 'stable') {
      nextStage = 'retired';
    } else {
      nextStage = 'reviewed';
    }

    // Preserve every failed criterion in `reasons` so reviewers get the full
    // diagnosis instead of only the first violated threshold.
    return {
      allowed: reasons.length === 0,
      reasons,
      stage: nextStage,
    };
  }

  canAutoPromote(proposal: ImprovementProposal): boolean {
    // Only low-risk proposals can auto-promote
    return proposal.risk === 'low';
  }

  requiresManualGate(proposal: ImprovementProposal): boolean {
    // High-risk always requires manual
    if (proposal.risk === 'high') return true;

    // Certain kinds require manual
    return ['prompt_patch', 'workflow_template', 'threshold_tuning'].includes(proposal.kind);
  }
}
