import { type ModelMetadataRegistry } from "../../../platform/control-plane/config-center/model-metadata-registry.js";
export interface CostOptimizationRecommendation {
    readonly recommendationId: string;
    readonly subjectId: string;
    readonly estimatedSavingsUsd: number;
    readonly riskLevel: "low" | "medium" | "high";
    readonly action: "right_size" | "downgrade_model" | "increase_cache_hit" | "schedule_shift";
    readonly currentModelRef?: string;
    readonly recommendedModelRef?: string;
}
export declare function buildCostOptimizationRecommendation(subjectId: string, currentCostUsd: number, options?: {
    modelRef?: string;
    registry?: ModelMetadataRegistry;
}): CostOptimizationRecommendation | null;
export declare function prioritizeCostOptimizationRecommendations(items: readonly CostOptimizationRecommendation[]): CostOptimizationRecommendation[];
