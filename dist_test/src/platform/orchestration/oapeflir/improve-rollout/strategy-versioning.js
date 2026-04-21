import { newId } from "../../../contracts/types/ids.js";
export function createStrategyVersion(title, learningObjects, releaseLevel = "suggest") {
    return {
        strategyVersionId: newId("strategy_version"),
        title,
        sourceLearningObjectIds: learningObjects.map((item) => item.learningObjectId),
        releaseLevel,
        createdAt: Date.now(),
    };
}
//# sourceMappingURL=strategy-versioning.js.map