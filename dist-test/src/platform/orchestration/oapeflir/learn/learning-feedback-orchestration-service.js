import { KnowledgePromotionService } from "./knowledge-promotion-service.js";
import { StrategyLearningService } from "./strategy-learning-service.js";
const EMPTY_PROMOTION_RESULT = {
    promotedCount: 0,
    failedCount: 0,
    knowledgeDocumentIds: [],
};
export class LearningFeedbackOrchestrationService {
    strategyLearning;
    knowledgePromotion;
    memoryService;
    constructor(options = {}) {
        this.strategyLearning = options.strategyLearning ?? new StrategyLearningService();
        this.knowledgePromotion = options.knowledgePromotion ?? new KnowledgePromotionService();
        this.memoryService = options.memoryService ?? null;
    }
    process(input) {
        const learned = this.strategyLearning.learnSync(input.signals);
        const learningObjects = dedupeLearningObjects(learned);
        const skippedDuplicateCount = learned.length - learningObjects.length;
        const promotedKnowledge = input.promoteToKnowledge === false
            ? EMPTY_PROMOTION_RESULT
            : this.knowledgePromotion.promote(learningObjects, input.taskId);
        const rememberedMemories = input.rememberValidatedLearnings === false || this.memoryService == null
            ? []
            : learningObjects.map((learningObject) => this.rememberLearning(input, learningObject));
        return {
            taskId: input.taskId,
            learningObjects,
            promotedKnowledge,
            rememberedMemories,
            learningTypeCounts: countByLearningType(learningObjects),
            skippedDuplicateCount,
        };
    }
    rememberLearning(input, learningObject) {
        return this.memoryService.remember({
            taskId: input.taskId,
            executionId: input.executionId ?? null,
            sessionId: input.sessionId ?? null,
            agentId: input.agentId ?? null,
            scope: "evolution",
            memoryLayer: "layer_5",
            classification: "learning",
            sourceTrustLevel: "trusted",
            qualityScore: learningObject.confidence,
            kind: learningObject.learningType === "recovery_playbook" ? "decision" : "rule",
            content: [
                `Learning: ${learningObject.title}`,
                `Summary: ${learningObject.summary}`,
                `Recommendation: ${learningObject.recommendation}`,
                `Evidence: ${learningObject.evidenceRefs.join(", ") || "none"}`,
            ].join("\n"),
        });
    }
}
function dedupeLearningObjects(learningObjects) {
    const seen = new Set();
    const deduped = [];
    for (const learningObject of learningObjects) {
        const key = [
            learningObject.learningType,
            learningObject.summary.trim().toLowerCase(),
            learningObject.recommendation.trim().toLowerCase(),
            [...learningObject.evidenceRefs].sort().join(","),
        ].join("|");
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(learningObject);
    }
    return deduped;
}
function countByLearningType(learningObjects) {
    const counts = {
        failure_pattern: 0,
        user_correction: 0,
        recovery_playbook: 0,
        model_retraining: 0,
        dataset_gap: 0,
    };
    for (const learningObject of learningObjects) {
        counts[learningObject.learningType] += 1;
    }
    return counts;
}
//# sourceMappingURL=learning-feedback-orchestration-service.js.map