import type { LearningSignal } from "../../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "./learning-object-model.js";
import { type UnifiedChatProvider } from "../../../model-gateway/provider-registry/unified-chat-provider.js";
export interface LLMImprovementGenerationServiceOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    provider?: UnifiedChatProvider;
}
export declare class LLMImprovementGenerationService {
    private readonly model;
    private readonly maxTokens;
    private readonly temperature;
    private readonly provider;
    constructor(options?: LLMImprovementGenerationServiceOptions);
    generateImprovements(signals: readonly LearningSignal[]): Promise<LearningObject[]>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private parseImprovementsFromResponse;
    private mapParsedToLearningObject;
    private fallbackTemplateGeneration;
    private templateRecommendation;
}
