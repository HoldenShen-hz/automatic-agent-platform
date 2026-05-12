/**
 * NL Gateway Config Loader
 *
 * Loads NL Gateway configuration from config/nl-gateway/default.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";
import { ValidationError } from "../../platform/contracts/errors.js";

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

const DEFAULT_NL_CONFIG_PATH = "config/nl-gateway/default.json";

const FullNlGatewayConfigSchema = z.object({
  conversationWindow: z.object({
    defaultSize: z.number().int().positive(),
    maxSize: z.number().int().positive(),
    byTaskType: z.record(z.string(), z.number().int().positive()),
  }),
  disambiguation: z.object({
    threshold: z.number().min(0).max(1),
    lowConfidenceThreshold: z.number().min(0).max(1),
    maxClarificationQuestions: z.number().int().positive(),
    enableProactiveClarification: z.boolean(),
  }),
  intent: z.object({
    minConfidenceForAutoConfirm: z.number().min(0).max(1),
    fallbackIntent: z.string().min(1),
  }),
  entityExtraction: z.object({
    requiredEntityCount: z.number().int().nonnegative(),
    minMessageLength: z.number().int().nonnegative(),
  }),
});

const PartialNlGatewayConfigSchema = z.object({
  conversationWindow: z.object({
    defaultSize: z.number().int().positive().optional(),
    maxSize: z.number().int().positive().optional(),
    byTaskType: z.record(z.string(), z.number().int().positive()).optional(),
  }).optional(),
  disambiguation: z.object({
    threshold: z.number().min(0).max(1).optional(),
    lowConfidenceThreshold: z.number().min(0).max(1).optional(),
    maxClarificationQuestions: z.number().int().positive().optional(),
    enableProactiveClarification: z.boolean().optional(),
  }).optional(),
  intent: z.object({
    minConfidenceForAutoConfirm: z.number().min(0).max(1).optional(),
    fallbackIntent: z.string().min(1).optional(),
  }).optional(),
  entityExtraction: z.object({
    requiredEntityCount: z.number().int().nonnegative().optional(),
    minMessageLength: z.number().int().nonnegative().optional(),
  }).optional(),
});

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
    // R23-10 FIX: §39.6 requires 0.80 threshold to trigger clarification.
    // Previous value 0.7 allowed 0.7-0.79 to bypass clarification (zone of doubt).
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
};

/**
 * Load NL Gateway config from file
 */
export function loadNlGatewayConfig(configPath?: string): NlGatewayConfig {
  try {
    const resolvedPath = resolve(configPath ?? DEFAULT_NL_CONFIG_PATH);
    const content = readFileSync(resolvedPath, "utf-8");
    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(content) as unknown;
    } catch (error) {
      throw new ValidationError(
        "nl_gateway.invalid_config_json",
        `Invalid NL gateway config JSON at ${resolvedPath}`,
        { details: { cause: error instanceof Error ? error.message : String(error) } },
      );
    }
    const parsedResult = PartialNlGatewayConfigSchema.safeParse(rawParsed);
    if (!parsedResult.success) {
      throw new ValidationError(
        "nl_gateway.invalid_config_schema",
        `Invalid NL gateway config schema at ${resolvedPath}`,
        {
          details: {
            issues: parsedResult.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
      );
    }
    const parsed = parsedResult.data;

    const merged = {
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
    return FullNlGatewayConfigSchema.parse(merged);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof z.ZodError) {
      throw error;
    }
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
