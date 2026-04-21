/**
 * NL Gateway Config Loader
 *
 * Loads NL Gateway configuration from config/nl-gateway/default.json
 */
/**
 * Conversation window configuration
 */
export interface ConversationWindowConfig {
    readonly defaultSize: number;
    readonly maxSize: number;
    readonly byTaskType: Readonly<Record<string, number>>;
}
/**
 * Disambiguation configuration
 */
export interface DisambiguationConfig {
    readonly threshold: number;
    readonly lowConfidenceThreshold: number;
    readonly maxClarificationQuestions: number;
    readonly enableProactiveClarification: boolean;
}
/**
 * Intent configuration
 */
export interface IntentConfig {
    readonly minConfidenceForAutoConfirm: number;
    readonly fallbackIntent: string;
}
/**
 * Entity extraction configuration
 */
export interface EntityExtractionConfig {
    readonly requiredEntityCount: number;
    readonly minMessageLength: number;
}
/**
 * NL Gateway configuration
 */
export interface NlGatewayConfig {
    readonly conversationWindow: ConversationWindowConfig;
    readonly disambiguation: DisambiguationConfig;
    readonly intent: IntentConfig;
    readonly entityExtraction: EntityExtractionConfig;
}
/**
 * Load NL Gateway config from file
 */
export declare function loadNlGatewayConfig(configPath?: string): NlGatewayConfig;
/**
 * Get conversation window size for a given task type
 */
export declare function getConversationWindowSize(config: NlGatewayConfig, taskType?: string): number;
/**
 * Check if clarification is needed based on config
 */
export declare function shouldRequestClarification(config: NlGatewayConfig, confidence: number): boolean;
