/**
 * Execution Outcome Evaluator
 *
 * Evaluates execution outcomes based on feedback signals and quality thresholds.
 * Quality thresholds are loaded from config/quality/default.json for runtime flexibility.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §17
 */
import type { Plan } from "../../orchestration/oapeflir/types/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { QualityGateConfig } from "./types.js";
export interface ExecutionOutcomeEvaluation {
    evaluationId: string;
    taskId: string;
    passed: boolean;
    qualityScore: number;
    nextAction: "complete" | "retry" | "replan" | "approve" | "escalate";
    reasons: string[];
    evaluatedAt: number;
    /** Detailed breakdown of score calculation */
    factorBreakdown: {
        successSignals: number;
        failureSignals: number;
        partialSignals: number;
        completionBonus: number;
        failurePenalty: number;
        partialPenalty: number;
    };
}
export interface ExecutionOutcomeEvaluatorOptions {
    readonly config?: QualityGateConfig;
}
export declare class ExecutionOutcomeEvaluator {
    private readonly config;
    constructor(options?: ExecutionOutcomeEvaluatorOptions);
    evaluate(plan: Plan, feedback: FeedbackBatch): ExecutionOutcomeEvaluation;
}
