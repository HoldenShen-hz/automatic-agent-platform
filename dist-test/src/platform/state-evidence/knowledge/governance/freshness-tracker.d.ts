import type { KnowledgeSource, KnowledgeNamespace, TrustLevel } from "../knowledge-model.js";
export interface FreshnessAssessment {
    stale: boolean;
    daysOld: number;
    effectiveTrustLevel: TrustLevel;
    action: KnowledgeNamespace["freshnessPolicy"]["staleAction"] | null;
}
export declare class FreshnessTracker {
    assess(source: KnowledgeSource, namespace: KnowledgeNamespace, now?: Date): FreshnessAssessment;
}
