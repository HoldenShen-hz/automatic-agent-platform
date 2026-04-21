import type { LearningObject } from "../learn/learning-object-model.js";
export type StrategyReleaseLevel = "off" | "suggest" | "shadow" | "canary_5" | "partial_25" | "partial_50" | "partial_75" | "stable";
export interface StrategyVersion {
    strategyVersionId: string;
    title: string;
    sourceLearningObjectIds: string[];
    releaseLevel: StrategyReleaseLevel;
    createdAt: number;
}
export declare function createStrategyVersion(title: string, learningObjects: readonly LearningObject[], releaseLevel?: StrategyReleaseLevel): StrategyVersion;
