/**
 * Promotion Gate
 *
 * Decides whether a proposal can be promoted based on evaluation
 * reports and frozen state.
 */
import type { ImprovementProposal } from './proposal-engine.js';
import type { EvaluationReport } from './benchmark-runner.js';
export interface PromotionGateConfig {
    minSuccessLift: number;
    maxRegressionRate: number;
    maxCostIncrease: number;
    maxLatencyIncrease: number;
    maxSafetyViolations: number;
}
export interface PromotionDecision {
    allowed: boolean;
    reasons: string[];
    stage: 'proposed' | 'testing' | 'canary' | 'active' | 'rejected';
}
export declare const DEFAULT_PROMOTION_GATE_CONFIG: PromotionGateConfig;
export declare class PromotionGate {
    private readonly config;
    constructor(config?: PromotionGateConfig);
    decide(proposal: ImprovementProposal, report: EvaluationReport, frozen: boolean, currentStage?: string): PromotionDecision;
    canAutoPromote(proposal: ImprovementProposal): boolean;
    requiresManualGate(proposal: ImprovementProposal): boolean;
}
