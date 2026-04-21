import type { Plan, UnifiedAssessment } from "../oapeflir/types/index.js";
export interface PlanEvaluation {
    viable: boolean;
    riskLevel: UnifiedAssessment["risk"];
    issues: string[];
}
export declare class PlanEvaluator {
    private readonly dagValidator;
    evaluate(plan: Plan, assessment: UnifiedAssessment): PlanEvaluation;
}
