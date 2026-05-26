/**
 * NL Gateway Config Loader
 *
 * Loads NL Gateway configuration from config/nl-gateway/default.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";
import {
  INTAKE_DISAMBIGUATION_THRESHOLD,
  INTAKE_LOW_CONFIDENCE_THRESHOLD,
} from "../../platform/contracts/constants/index.js";
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
 * Optional guardrail pattern extensions.
 * These entries extend the built-in defaults instead of replacing them.
 */
export interface GuardrailConfig {
  readonly additionalPromptInjectionPatterns: readonly string[];
  readonly additionalGenericAmbiguousPatterns: readonly string[];
}

export interface NlGatewayRateLimitConfig {
  readonly enabled: boolean;
  readonly windowMs: number;
  readonly perTenantRequestsPerWindow: number;
  readonly perUserRequestsPerWindow: number;
}

/**
 * NL Gateway configuration
 */
export interface NlGatewayConfig {
  readonly conversationWindow: ConversationWindowConfig;
  readonly disambiguation: DisambiguationConfig;
  readonly intent: IntentConfig;
  readonly entityExtraction: EntityExtractionConfig;
  readonly rateLimit: NlGatewayRateLimitConfig;
  readonly guardrails?: GuardrailConfig;
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
  rateLimit: z.object({
    enabled: z.boolean(),
    windowMs: z.number().int().positive(),
    perTenantRequestsPerWindow: z.number().int().positive(),
    perUserRequestsPerWindow: z.number().int().positive(),
  }),
  guardrails: z.object({
    additionalPromptInjectionPatterns: z.array(z.string().min(1)),
    additionalGenericAmbiguousPatterns: z.array(z.string().min(1)),
  }).optional(),
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
  rateLimit: z.object({
    enabled: z.boolean().optional(),
    windowMs: z.number().int().positive().optional(),
    perTenantRequestsPerWindow: z.number().int().positive().optional(),
    perUserRequestsPerWindow: z.number().int().positive().optional(),
  }).optional(),
  guardrails: z.object({
    additionalPromptInjectionPatterns: z.array(z.string().min(1)).optional(),
    additionalGenericAmbiguousPatterns: z.array(z.string().min(1)).optional(),
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
    threshold: INTAKE_DISAMBIGUATION_THRESHOLD,
    lowConfidenceThreshold: INTAKE_LOW_CONFIDENCE_THRESHOLD,
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
  rateLimit: {
    enabled: true,
    windowMs: 60_000,
    perTenantRequestsPerWindow: 120,
    perUserRequestsPerWindow: 30,
  },
  guardrails: {
    additionalPromptInjectionPatterns: [],
    additionalGenericAmbiguousPatterns: [],
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

    const merged: NlGatewayConfig = {
      conversationWindow: {
        defaultSize: parsed.conversationWindow?.defaultSize ?? DEFAULT_NL_GATEWAY_CONFIG.conversationWindow.defaultSize,
        maxSize: parsed.conversationWindow?.maxSize ?? DEFAULT_NL_GATEWAY_CONFIG.conversationWindow.maxSize,
        byTaskType: {
          ...DEFAULT_NL_GATEWAY_CONFIG.conversationWindow.byTaskType,
          ...parsed.conversationWindow?.byTaskType,
        },
      },
      disambiguation: {
        threshold: parsed.disambiguation?.threshold ?? DEFAULT_NL_GATEWAY_CONFIG.disambiguation.threshold,
        lowConfidenceThreshold:
          parsed.disambiguation?.lowConfidenceThreshold ?? DEFAULT_NL_GATEWAY_CONFIG.disambiguation.lowConfidenceThreshold,
        maxClarificationQuestions:
          parsed.disambiguation?.maxClarificationQuestions ?? DEFAULT_NL_GATEWAY_CONFIG.disambiguation.maxClarificationQuestions,
        enableProactiveClarification:
          parsed.disambiguation?.enableProactiveClarification ?? DEFAULT_NL_GATEWAY_CONFIG.disambiguation.enableProactiveClarification,
      },
      intent: {
        minConfidenceForAutoConfirm:
          parsed.intent?.minConfidenceForAutoConfirm ?? DEFAULT_NL_GATEWAY_CONFIG.intent.minConfidenceForAutoConfirm,
        fallbackIntent: parsed.intent?.fallbackIntent ?? DEFAULT_NL_GATEWAY_CONFIG.intent.fallbackIntent,
      },
      entityExtraction: {
        requiredEntityCount:
          parsed.entityExtraction?.requiredEntityCount ?? DEFAULT_NL_GATEWAY_CONFIG.entityExtraction.requiredEntityCount,
        minMessageLength:
          parsed.entityExtraction?.minMessageLength ?? DEFAULT_NL_GATEWAY_CONFIG.entityExtraction.minMessageLength,
      },
      rateLimit: {
        enabled: parsed.rateLimit?.enabled ?? DEFAULT_NL_GATEWAY_CONFIG.rateLimit.enabled,
        windowMs: parsed.rateLimit?.windowMs ?? DEFAULT_NL_GATEWAY_CONFIG.rateLimit.windowMs,
        perTenantRequestsPerWindow:
          parsed.rateLimit?.perTenantRequestsPerWindow ?? DEFAULT_NL_GATEWAY_CONFIG.rateLimit.perTenantRequestsPerWindow,
        perUserRequestsPerWindow:
          parsed.rateLimit?.perUserRequestsPerWindow ?? DEFAULT_NL_GATEWAY_CONFIG.rateLimit.perUserRequestsPerWindow,
      },
      guardrails: {
        additionalPromptInjectionPatterns:
          parsed.guardrails?.additionalPromptInjectionPatterns
          ?? DEFAULT_NL_GATEWAY_CONFIG.guardrails?.additionalPromptInjectionPatterns
          ?? [],
        additionalGenericAmbiguousPatterns:
          parsed.guardrails?.additionalGenericAmbiguousPatterns
          ?? DEFAULT_NL_GATEWAY_CONFIG.guardrails?.additionalGenericAmbiguousPatterns
          ?? [],
      },
    };
    const normalized = FullNlGatewayConfigSchema.parse(merged);
    return {
      conversationWindow: normalized.conversationWindow,
      disambiguation: normalized.disambiguation,
      intent: normalized.intent,
      entityExtraction: normalized.entityExtraction,
      rateLimit: normalized.rateLimit,
      ...(normalized.guardrails == null ? {} : { guardrails: normalized.guardrails }),
    };
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
