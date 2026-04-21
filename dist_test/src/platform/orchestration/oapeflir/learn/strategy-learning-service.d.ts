import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";
import { LLMImprovementGenerationService } from "./llm-improvement-generation-service.js";
export interface StrategyLearningServiceOptions {
    llmImprovementService?: LLMImprovementGenerationService;
}
export declare class StrategyLearningService {
    private readonly miner;
    private readonly llmImprovement;
    private readonly validator;
    constructor(options?: StrategyLearningServiceOptions);
    learn(signals: readonly LearningSignal[]): Promise<LearningObject[]>;
    learnSync(signals: readonly LearningSignal[]): LearningObject[];
}
