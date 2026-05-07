/**
 * NL Gateway Config Loader
 *
 * Loads NL Gateway configuration from config/nl-gateway/default.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";

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
 * R5-32: Confidence thresholds configuration
 */
export interface ConfidenceThresholdsConfig {
  readonly llmAcceptThreshold: number;
  readonly fallbackThreshold: number;
  readonly minAcceptableConfidence: number;
  readonly enableConfidenceLogging: boolean;
}

/**
 * NL Gateway configuration
 */
export interface NlGatewayConfig {
  readonly conversationWindow: ConversationWindowConfig;
  readonly disambiguation: DisambiguationConfig;
  readonly intent: IntentConfig;
  readonly entityExtraction: EntityExtractionConfig;
  /** R5-32: Configurable confidence thresholds for intent parsing */
  readonly confidenceThresholds: ConfidenceThresholdsConfig;
}

const DEFAULT_NL_CONFIG_PATH = "config/nl-gateway/default.json";

const DEFAULT_NL_GATEWAY_CONFIG: NlGatewayConfig = {
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
    threshold: 0.80,
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
  // R5-32: Default confidence thresholds
  confidenceThresholds: {
    llmAcceptThreshold: 0.75,
    fallbackThreshold: 0.50,
    minAcceptableConfidence: 0.65,
    enableConfidenceLogging: false,
  },
};

/**
 * Load NL Gateway config from file
 */
export function loadNlGatewayConfig(configPath?: string): NlGatewayConfig {
  try {
    const resolvedPath = resolve(configPath ?? DEFAULT_NL_CONFIG_PATH);
    const content = readFileSync(resolvedPath, "utf-8");
    const parsed = JSON.parse(content) as Partial<NlGatewayConfig>;

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
      // R5-32: Merge confidence thresholds from config
      confidenceThresholds: {
        ...DEFAULT_NL_GATEWAY_CONFIG.confidenceThresholds,
        ...parsed.confidenceThresholds,
      },
    };
  } catch {
    return DEFAULT_NL_GATEWAY_CONFIG;
  }
}

/**
 * Get conversation window size for a given task type
 */
export function getConversationWindowSize(
  config: NlGatewayConfig,
  taskType?: string,
): number {
  if (taskType && config.conversationWindow.byTaskType[taskType] !== undefined) {
    return config.conversationWindow.byTaskType[taskType];
  }
  return config.conversationWindow.defaultSize;
}

/**
 * Check if clarification is needed based on config
 */
export function shouldRequestClarification(
  config: NlGatewayConfig,
  confidence: number,
): boolean {
  return (
    config.disambiguation.enableProactiveClarification &&
    confidence < config.disambiguation.threshold
  );
}
