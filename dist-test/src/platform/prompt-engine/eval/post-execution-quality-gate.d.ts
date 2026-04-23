import type { ExecutionOutcomeEvaluation } from "./execution-outcome-evaluator.js";
export interface PostExecutionQualityGateDecision {
    accepted: boolean;
    releaseStage: "released" | "repair" | "approval" | "blocked";
    reasonCodes: string[];
}
export declare class PostExecutionQualityGate {
    decide(evaluation: ExecutionOutcomeEvaluation): PostExecutionQualityGateDecision;
}
