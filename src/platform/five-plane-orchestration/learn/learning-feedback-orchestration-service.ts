import type { MemoryRecord } from "../../contracts/types/domain.js";
import type { MemoryService } from "../../five-plane-state-evidence/memory/memory-service.js";
import type { LearningSignal } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { KnowledgePromotionService, type KnowledgePromotionResult } from "./knowledge-promotion-service.js";
import type { LearningObject } from "./learning-object-model.js";
import { StrategyLearningService } from "./strategy-learning-service.js";

export interface LearningFeedbackOrchestrationInput {
  taskId: string;
  executionId?: string | null;
  sessionId?: string | null;
  agentId?: string | null;
  signals: readonly LearningSignal[];
  promoteToKnowledge?: boolean;
  rememberValidatedLearnings?: boolean;
}

export interface LearningFeedbackOrchestrationResult {
  taskId: string;
  learningObjects: LearningObject[];
  promotedKnowledge: KnowledgePromotionResult;
  rememberedMemories: MemoryRecord[];
  learningTypeCounts: Record<LearningObject["learningType"], number>;
  skippedDuplicateCount: number;
}

export interface LearningFeedbackOrchestrationServiceOptions {
  strategyLearning?: StrategyLearningService;
  knowledgePromotion?: KnowledgePromotionService;
  memoryService?: MemoryService | null;
}

const EMPTY_PROMOTION_RESULT: KnowledgePromotionResult = {
  promotedCount: 0,
  failedCount: 0,
  knowledgeDocumentIds: [],
};

export class LearningFeedbackOrchestrationService {
  private readonly strategyLearning: StrategyLearningService;
  private readonly knowledgePromotion: KnowledgePromotionService;
  private readonly memoryService: MemoryService | null;

  public constructor(options: LearningFeedbackOrchestrationServiceOptions = {}) {
    this.strategyLearning = options.strategyLearning ?? new StrategyLearningService();
    this.knowledgePromotion = options.knowledgePromotion ?? new KnowledgePromotionService();
    this.memoryService = options.memoryService ?? null;
  }

  public process(input: LearningFeedbackOrchestrationInput): LearningFeedbackOrchestrationResult {
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

  private rememberLearning(
    input: LearningFeedbackOrchestrationInput,
    learningObject: LearningObject,
  ): MemoryRecord {
    return this.memoryService!.remember({
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

function dedupeLearningObjects(learningObjects: readonly LearningObject[]): LearningObject[] {
  const seen = new Set<string>();
  const deduped: LearningObject[] = [];
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

function countByLearningType(
  learningObjects: readonly LearningObject[],
): Record<LearningObject["learningType"], number> {
  const counts: Record<LearningObject["learningType"], number> = {
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
