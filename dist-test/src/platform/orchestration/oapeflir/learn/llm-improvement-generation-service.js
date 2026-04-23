import { newId } from "../../../contracts/types/ids.js";
import { createUnifiedChatProvider, } from "../../../model-gateway/provider-registry/unified-chat-provider.js";
import { AppError } from "../../../contracts/errors.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 200 });
const DEFAULT_IMPROVEMENT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;
export class LLMImprovementGenerationService {
    model;
    maxTokens;
    temperature;
    provider;
    constructor(options = {}) {
        this.model = options.model ?? DEFAULT_IMPROVEMENT_MODEL;
        this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
        this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
        this.provider = options.provider ?? createUnifiedChatProvider();
    }
    async generateImprovements(signals) {
        if (signals.length === 0) {
            return [];
        }
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(signals);
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ];
        try {
            const result = await this.provider.createChatCompletion({
                model: this.model,
                messages,
                maxTokens: this.maxTokens,
                temperature: this.temperature,
            });
            return this.parseImprovementsFromResponse(result.content, signals);
        }
        catch (error) {
            if (error instanceof AppError && !error.retryable) {
                logger.warn("[LLMImprovementGenerationService] LLM call failed non-retryably, falling back to template-based generation", { error: error.message });
                return this.fallbackTemplateGeneration(signals);
            }
            logger.warn("[LLMImprovementGenerationService] LLM call failed, falling back to template-based generation", { error: String(error) });
            return this.fallbackTemplateGeneration(signals);
        }
    }
    buildSystemPrompt() {
        return `You are an optimization advisor for a multi-step task execution platform.
Your role is to analyze feedback signals from executed tasks and generate concrete, actionable improvement recommendations.

For each signal, you must generate a LearningObject with:
- title: A concise, descriptive title (max 80 chars)
- summary: A 1-2 sentence explanation of what happened and why
- recommendation: A specific, actionable next steps to prevent recurrence or improve performance
- confidence: A score between 0.0 and 1.0 reflecting certainty in this recommendation

Learning types:
- failure_pattern: Something went wrong; recommend prevention/mitigation
- user_correction: User provided explicit correction; recommend adopting the correct approach
- recovery_playbook: A recovery action was taken; recommend making recovery automatic

Output format: Return a JSON array of LearningObjects. Each object must have:
{"learningObjectId": "placeholder", "learningType": "...", "title": "...", "summary": "...", "confidence": 0.0-1.0, "evidenceRefs": [], "sourceSignalIds": [], "recommendation": "...", "validatedBy": "none", "promotionStatus": "draft", "createdAt": current_timestamp}

Generate one LearningObject per signal. Be specific and actionable in recommendations.`;
    }
    buildUserPrompt(signals) {
        const signalDetails = signals.map((signal, index) => {
            const evidenceJson = JSON.stringify(signal.evidence, null, 2);
            return `[Signal ${index + 1}]
Type: ${signal.learningType}
Summary: ${signal.valueSummary}
Confidence: ${signal.confidence}
Evidence: ${evidenceJson}
Generated: ${new Date(signal.generatedAt).toISOString()}`;
        }).join("\n\n");
        return `Analyze the following feedback signals and generate improvement recommendations:

${signalDetails}

Return a JSON array of LearningObjects, one per signal.`;
    }
    parseImprovementsFromResponse(content, signals) {
        try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                logger.warn("[LLMImprovementGenerationService] No JSON array found in LLM response, falling back to template");
                return this.fallbackTemplateGeneration(signals);
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.map((item, index) => {
                const signal = signals[index];
                if (!signal) {
                    return this.fallbackTemplateGeneration(signals)[0];
                }
                return this.mapParsedToLearningObject(item, signal);
            });
        }
        catch (error) {
            logger.warn("[LLMImprovementGenerationService] Failed to parse LLM response as JSON, falling back to template", { error: String(error) });
            return this.fallbackTemplateGeneration(signals);
        }
    }
    mapParsedToLearningObject(item, signal) {
        return {
            learningObjectId: newId("learning"),
            learningType: item.learningType ?? signal.learningType,
            title: item.title ?? `Improvement: ${signal.valueSummary.slice(0, 40)}`,
            summary: item.summary ?? signal.valueSummary,
            confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : signal.confidence,
            evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : signal.evidenceRefs,
            sourceSignalIds: Array.isArray(item.sourceSignalIds) ? item.sourceSignalIds : signal.sourceSignalIds,
            recommendation: item.recommendation ?? this.templateRecommendation(signal),
            validatedBy: "none",
            promotionStatus: "draft",
            createdAt: Date.now(),
        };
    }
    fallbackTemplateGeneration(signals) {
        return signals.map((signal) => ({
            learningObjectId: newId("learning"),
            learningType: signal.learningType,
            title: `${signal.learningType.replace("_", " ")}: ${signal.valueSummary.slice(0, 40)}`,
            summary: signal.valueSummary,
            confidence: signal.confidence,
            evidenceRefs: signal.evidenceRefs,
            sourceSignalIds: signal.sourceSignalIds,
            recommendation: this.templateRecommendation(signal),
            validatedBy: "none",
            promotionStatus: "draft",
            createdAt: signal.generatedAt,
        }));
    }
    templateRecommendation(signal) {
        switch (signal.learningType) {
            case "failure_pattern":
                return "Analyze the root cause and implement preventive measures to avoid recurrence.";
            case "user_correction":
                return "Adopt the user's correction as the canonical approach and update planning guidance accordingly.";
            case "recovery_playbook":
                return "Automate the recovery steps to reduce mean time to recovery on similar failures.";
            case "model_retraining":
                return "Initiate model retraining with corrected dataset to improve future performance.";
            case "dataset_gap":
                return "Collect training data for the identified gap to enhance model capabilities.";
        }
    }
}
//# sourceMappingURL=llm-improvement-generation-service.js.map