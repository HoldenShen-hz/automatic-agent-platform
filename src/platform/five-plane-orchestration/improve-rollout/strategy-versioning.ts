import { newId } from "../../contracts/types/ids.js";
import type { LearningObject } from "../learn/learning-object-model.js";
import type { RolloutLevel } from "../oapeflir/types/rollout-record.js";

export type StrategyReleaseLevel =
  | RolloutLevel
  | "off"
  | "suggest"
  | "shadow"
  | "canary_5"
  | "partial_25"
  | "partial_50"
  | "partial_75"
  | "stable";

export interface StrategyVersion {
  strategyVersionId: string;
  title: string;
  sourceLearningObjectIds: string[];
  releaseLevel: StrategyReleaseLevel;
  createdAt: number;
}

export function createStrategyVersion(
  title: string,
  learningObjects: readonly LearningObject[],
  releaseLevel: StrategyReleaseLevel = "suggest",
): StrategyVersion {
  return {
    strategyVersionId: newId("strategy_version"),
    title,
    sourceLearningObjectIds: learningObjects.map((item) => item.learningObjectId),
    releaseLevel,
    createdAt: Date.now(),
  };
}
