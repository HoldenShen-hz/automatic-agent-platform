/**
 * Disambiguation Handler
 *
 * Implements intent disambiguation when confidence is below threshold.
 * Generates clarification questions to help users refine their intent.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §39
 */
import type { DetectedIntent, ExtractedEntity } from "../index.js";
/**
 * Configuration for disambiguation behavior
 */
export interface DisambiguationConfig {
    /** Confidence threshold below which disambiguation is triggered */
    readonly threshold: number;
    /** Low confidence threshold for severe disambiguation */
    readonly lowConfidenceThreshold: number;
    /** Maximum number of clarification questions to generate */
    readonly maxClarificationQuestions: number;
    /** Whether to proactively ask for clarification */
    readonly enableProactiveClarification: boolean;
}
/**
 * Disambiguation question structure
 */
export interface ClarificationQuestion {
    readonly question: string;
    readonly options?: readonly string[];
    readonly entityType?: string;
    readonly intentHint?: string;
}
/**
 * Disambiguation result
 */
export interface DisambiguationResult {
    readonly requiresClarification: boolean;
    readonly questions: readonly ClarificationQuestion[];
    readonly suggestedIntents?: readonly string[];
    readonly confidenceLevel: "high" | "medium" | "low" | "very_low";
    readonly reason: string;
}
/**
 * Check if disambiguation is needed based on confidence and entities
 */
export declare function detectAmbiguity(message: string, confidence: number, requiredEntityCount: number, extractedEntityCount: number): boolean;
/**
 * Disambiguation Handler for NL Gateway
 *
 * Generates clarification questions when intent confidence is low.
 */
export declare class DisambiguationHandler {
    private readonly config;
    constructor(config?: Partial<DisambiguationConfig>);
    /**
     * Determine if clarification is needed for the given intent
     */
    requiresClarification(confidence: number, message: string, entityCount: number): boolean;
    /**
     * Get the confidence level category
     */
    getConfidenceLevel(confidence: number): DisambiguationResult["confidenceLevel"];
    /**
     * Generate clarification questions for low-confidence intents
     */
    generateClarification(message: string, confidence: number, detectedIntent: DetectedIntent, entities: readonly ExtractedEntity[]): DisambiguationResult;
    /**
     * Build a disambiguation result from intent detection
     */
    disambiguate(message: string, confidence: number, intent: DetectedIntent, allIntents: readonly DetectedIntent[]): DisambiguationResult;
    /**
     * Format an intent type for user display
     */
    private formatIntentOption;
    /**
     * Generate questions for very low confidence (< 0.5)
     */
    private generateVeryLowConfidenceQuestions;
    /**
     * Generate questions for low confidence (0.5 - 0.7)
     */
    private generateLowConfidenceQuestions;
    /**
     * Generate questions for missing entities
     */
    private generateEntityQuestions;
    /**
     * Check if the message contains a vague action
     */
    private isVagueAction;
    /**
     * Check if the message has vague scope
     */
    private isVagueScope;
    /**
     * Check if intent typically requires entities
     */
    private requiresEntities;
    /**
     * Suggest alternative intents
     */
    private suggestAlternativeIntents;
    /**
     * Build human-readable reason for disambiguation
     */
    private buildReason;
}
