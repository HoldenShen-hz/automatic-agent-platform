/**
 * NL Gateway Config Loader
 *
 * Loads NL Gateway configuration from config/nl-gateway/default.json
 */
import { readFileSync } from "fs";
import { resolve } from "path";
const DEFAULT_NL_CONFIG_PATH = "config/nl-gateway/default.json";
const DEFAULT_NL_GATEWAY_CONFIG = {
    conversationWindow: {
        defaultSize: 10,
        maxSize: 20,
        byTaskType: {
            task_create: 15,
            task_query: 8,
            task_modify: 12,
            status_inquiry: 5,
            approval_action: 6,
        },
    },
    disambiguation: {
        threshold: 0.7,
        lowConfidenceThreshold: 0.5,
        maxClarificationQuestions: 3,
        enableProactiveClarification: true,
    },
    intent: {
        minConfidenceForAutoConfirm: 0.85,
        fallbackIntent: "task_query",
    },
    entityExtraction: {
        requiredEntityCount: 1,
        minMessageLength: 6,
    },
};
/**
 * Load NL Gateway config from file
 */
export function loadNlGatewayConfig(configPath) {
    try {
        const resolvedPath = resolve(configPath ?? DEFAULT_NL_CONFIG_PATH);
        const content = readFileSync(resolvedPath, "utf-8");
        const parsed = JSON.parse(content);
        return {
            conversationWindow: {
                ...DEFAULT_NL_GATEWAY_CONFIG.conversationWindow,
                ...parsed.conversationWindow,
                byTaskType: {
                    ...DEFAULT_NL_GATEWAY_CONFIG.conversationWindow.byTaskType,
                    ...parsed.conversationWindow?.byTaskType,
                },
            },
            disambiguation: {
                ...DEFAULT_NL_GATEWAY_CONFIG.disambiguation,
                ...parsed.disambiguation,
            },
            intent: {
                ...DEFAULT_NL_GATEWAY_CONFIG.intent,
                ...parsed.intent,
            },
            entityExtraction: {
                ...DEFAULT_NL_GATEWAY_CONFIG.entityExtraction,
                ...parsed.entityExtraction,
            },
        };
    }
    catch {
        return DEFAULT_NL_GATEWAY_CONFIG;
    }
}
/**
 * Get conversation window size for a given task type
 */
export function getConversationWindowSize(config, taskType) {
    if (taskType && config.conversationWindow.byTaskType[taskType] !== undefined) {
        return config.conversationWindow.byTaskType[taskType];
    }
    return config.conversationWindow.defaultSize;
}
/**
 * Check if clarification is needed based on config
 */
export function shouldRequestClarification(config, confidence) {
    return (config.disambiguation.enableProactiveClarification &&
        confidence < config.disambiguation.threshold);
}
//# sourceMappingURL=nl-gateway-config-loader.js.map