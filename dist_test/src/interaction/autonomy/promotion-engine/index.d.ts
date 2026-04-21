import type { AutonomyLevel, CapabilityTrustScore } from "../index.js";
export interface PromotionAssessment {
    readonly shouldPromote: boolean;
    readonly currentLevel: AutonomyLevel;
    readonly targetLevel: AutonomyLevel;
    readonly reasonCodes: readonly string[];
}
export declare function assessPromotion(score: CapabilityTrustScore): PromotionAssessment;
