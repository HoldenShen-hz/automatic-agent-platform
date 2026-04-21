export interface CostOptimizationRecommendation {
    readonly recommendationId: string;
    readonly subjectId: string;
    readonly estimatedSavingsUsd: number;
    readonly riskLevel: "low" | "medium" | "high";
}
export declare function buildCostOptimizationRecommendation(subjectId: string, currentCostUsd: number): CostOptimizationRecommendation | null;
