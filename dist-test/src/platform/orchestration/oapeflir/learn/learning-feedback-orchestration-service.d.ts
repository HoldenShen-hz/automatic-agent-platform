import type { MemoryRecord } from "../../../contracts/types/domain.js";
import type { MemoryService } from "../../../state-evidence/memory/memory-service.js";
import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
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
export declare class LearningFeedbackOrchestrationService {
    private readonly strategyLearning;
    private readonly knowledgePromotion;
    private readonly memoryService;
    constructor(options?: LearningFeedbackOrchestrationServiceOptions);
    process(input: LearningFeedbackOrchestrationInput): LearningFeedbackOrchestrationResult;
    private rememberLearning;
}
