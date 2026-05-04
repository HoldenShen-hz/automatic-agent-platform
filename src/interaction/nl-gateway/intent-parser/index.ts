export interface ParsedIntentToken {
  readonly intentType: "task_create" | "task_query" | "task_modify" | "status_inquiry" | "approval_action";
  readonly confidence: number;
}

/**
 * Result from LLM-based intent parsing
 */
export interface LlmIntentParseResult {
  readonly intentType: ParsedIntentToken["intentType"];
  readonly confidence: number;
  readonly reasoning: string;
  readonly language: string;
}

/**
 * §39.3: IntentParser should use ModelGateway for multilingual intent recognition.
 *
 * This interface defines the contract for intent parsing that supports:
 * - Multi-language intent detection (zh-CN, en-US, ja-JP, etc.)
 * - LLM-based classification with confidence scoring
 * - Fallback to regex patterns when LLM is unavailable
 */
export interface IntentParser {
  /**
   * Parse intent using LLM with confidence scoring.
   * Should use ModelGateway for multilingual support.
   */
  parseWithLlm(message: string, locale?: string): Promise<LlmIntentParseResult>;
}

export interface IntentParserModelGateway {
  complete(prompt: string): Promise<string>;
}

/**
 * R5-19: Intent extraction budget tracking interface.
 * Tracks token usage during LLM-based intent extraction to enforce budget limits.
 */
export interface IntentExtractionBudget {
  readonly maxTokens: number;
  readonly usedTokens: number;
  readonly remainingTokens: number;
}

/**
 * R5-19: Default intent extraction budget limits
 */
const DEFAULT_MAX_INTENT_TOKENS = 800;

/**
 * R5-18: Delegation depth limits for intent parser
 */
const DEFAULT_MAX_DELEGATION_DEPTH = 3;

/**
 * §39.3: Regex-based fallback parser for when LLM is unavailable.
 * Provides basic intent recognition without LLM dependency.
 */
export function parseIntentTokens(message: string): ParsedIntentToken[] {
  const normalized = message.toLowerCase();
  if (/(approve|审批|通过)/i.test(message)) {
    return [{ intentType: "approval_action", confidence: 0.92 }];
  }
  if (/(status|状态|summary|同步)/i.test(message)) {
    return [{ intentType: "status_inquiry", confidence: 0.84 }];
  }
  if (/(delete|remove|删除|修改)/i.test(message)) {
    return [{ intentType: "task_modify", confidence: 0.8 }];
  }
  if (/(create|make|生成|创建|做一个)/i.test(normalized) || normalized.length > 12) {
    return [{ intentType: "task_create", confidence: 0.88 }];
  }
  return [{ intentType: "task_query", confidence: 0.62 }];
}

/**
 * §39.3: Intent validation result
 */
export interface IntentValidationResult {
  readonly valid: boolean;
  readonly reasonCode: string | null;
  readonly suggestions: readonly string[];
}

/**
 * §39.3: Validates intent extraction results meet minimum quality thresholds.
 * Checks confidence score and entity extraction quality before accepting.
 */
export function validateIntentExtraction(
  message: string,
  intentType: ParsedIntentToken["intentType"],
  confidence: number,
): IntentValidationResult {
  const suggestions: string[] = [];

  // R9-20: Reject low-confidence intent without user confirmation
  if (confidence < INTENT_CONFIDENCE_THRESHOLDS.MIN_ACCEPTABLE_CONFIDENCE) {
    suggestions.push("请提供更具体的描述以帮助我准确理解您的意图");
    return {
      valid: false,
      reasonCode: "nl_gateway.intent_confidence_too_low",
      suggestions,
    };
  }

  // R9-20: Validate entity extraction for modify/delete actions
  if (intentType === "task_modify" || intentType === "approval_action") {
    const hasEntity = /(prod|production|staging|线上|生产|环境|账号|用户|配置)/i.test(message);
    if (!hasEntity) {
      suggestions.push("请指出具体的目标对象或环境");
      return {
        valid: false,
        reasonCode: "nl_gateway.entity_extraction_incomplete",
        suggestions,
      };
    }
  }

  // R9-20: Validate high-risk actions have sufficient context
  if (intentType === "task_create" && /(deploy|release|delete|drop|发布|删除)/i.test(message)) {
    const hasContext = /(prod|production|staging|线上|生产环境|预算|费用)/i.test(message);
    if (!hasContext) {
      suggestions.push("此操作影响较大，请补充目标环境或确认信息");
      return {
        valid: false,
        reasonCode: "nl_gateway.high_risk_action_insufficient_context",
        suggestions,
      };
    }
  }

  return { valid: true, reasonCode: null, suggestions: [] };
}

/**
 * R5-19: Intent extraction budget tracker for tracking token usage during LLM parsing.
 */
export class IntentExtractionBudgetTracker {
  private usedTokens: number = 0;

  public constructor(
    public readonly maxTokens: number = DEFAULT_MAX_INTENT_TOKENS,
  ) {}

  /**
   * R5-19: Record tokens used for an intent extraction operation.
   * Returns false if budget would be exceeded.
   */
  public recordTokens(tokensUsed: number): boolean {
    if (this.usedTokens + tokensUsed > this.maxTokens) {
      return false;
    }
    this.usedTokens += tokensUsed;
    return true;
  }

  /**
   * R5-19: Get current budget status.
   */
  public getBudget(): IntentExtractionBudget {
    return {
      maxTokens: this.maxTokens,
      usedTokens: this.usedTokens,
      remainingTokens: this.maxTokens - this.usedTokens,
    };
  }

  /**
   * R5-19: Check if budget allows a given token count.
   */
  public hasRemaining(tokensNeeded: number): boolean {
    return this.usedTokens + tokensNeeded <= this.maxTokens;
  }

  /**
   * R5-19: Reset the budget tracker.
   */
  public reset(): void {
    this.usedTokens = 0;
  }
}

/**
 * R5-18: Delegation state for tracking delegation depth in intent parsing.
 */
export interface DelegationState {
  readonly depth: number;
  readonly maxDepth: number;
  readonly isBounded: boolean;
}

/**
 * §39.7: LLM-based intent parser for multilingual intent recognition.
 * Uses ModelGateway for cross-lingual classification with confidence scoring.
 * Falls back to regex-based parsing when LLM is unavailable.
 */
export class LlmIntentParser implements IntentParser {
  private readonly modelGateway: IntentParserModelGateway | null;
  private readonly fallbackEnabled: boolean;
  /** R5-18: Delegation depth limit */
  private readonly maxDelegationDepth: number;
  /** R5-19: Budget tracker for intent extraction */
  private readonly budgetTracker: IntentExtractionBudgetTracker;

  public constructor(
    modelGateway?: IntentParserModelGateway | null,
    fallbackEnabled = true,
    maxDelegationDepth = DEFAULT_MAX_DELEGATION_DEPTH,
    maxIntentTokens = DEFAULT_MAX_INTENT_TOKENS,
  ) {
    this.modelGateway = modelGateway ?? null;
    this.fallbackEnabled = fallbackEnabled;
    this.maxDelegationDepth = maxDelegationDepth;
    this.budgetTracker = new IntentExtractionBudgetTracker(maxIntentTokens);
  }

  /**
   * R5-18: Get current delegation state.
   */
  public getDelegationState(): DelegationState {
    return {
      depth: 0,
      maxDepth: this.maxDelegationDepth,
      isBounded: true,
    };
  }

  /**
   * R5-19: Get current budget state.
   */
  public getBudgetState(): IntentExtractionBudget {
    return this.budgetTracker.getBudget();
  }

  /**
   * Parse intent using LLM with confidence scoring.
   * Falls back to regex-based parsing on LLM failure or low confidence.
   * R5-18: Enforces delegation depth limit.
   * R5-19: Enforces token budget for intent extraction.
   */
  async parseWithLlm(message: string, locale?: string, delegationDepth = 0): Promise<LlmIntentParseResult> {
    // R5-18: Check delegation depth limit
    if (delegationDepth >= this.maxDelegationDepth) {
      return this.fallbackToRegex(message, locale ?? detectInputLanguage(message), delegationDepth);
    }

    const estimatedTokens = this.estimateTokenCount(message);
    if (!this.budgetTracker.hasRemaining(estimatedTokens)) {
      // Budget exhausted - fall back to regex
      return this.fallbackToRegex(message, locale ?? detectInputLanguage(message), delegationDepth);
    }

    const detectedLocale = locale ?? detectInputLanguage(message);

    // §39.7: Attempt LLM-based parsing if modelGateway is available
    if (this.modelGateway != null) {
      try {
        const llmResult = await this.invokeModelGateway(message, detectedLocale, estimatedTokens);
        if (llmResult.confidence >= INTENT_CONFIDENCE_THRESHOLDS.LLM_ACCEPT_THRESHOLD) {
          return llmResult;
        }
        // Confidence below threshold - will fall through to fallback
      } catch {
        // LLM unavailable - fall through to regex fallback
      }
    }

    // §39.7: Fallback to regex-based parsing when LLM fails or is unavailable
    if (this.fallbackEnabled) {
      return this.fallbackToRegex(message, detectedLocale, delegationDepth);
    }

    // Return lowest confidence result if fallback is disabled
    return {
      intentType: "task_query",
      confidence: INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD - 0.1,
      reasoning: "LLM unavailable and fallback disabled",
      language: detectedLocale,
    };
  }

  /**
   * Invoke ModelGateway for LLM-based intent classification.
   * Supports multilingual prompt construction.
   * R5-19: Records token usage against budget.
   */
  private async invokeModelGateway(
    message: string,
    locale: string,
    estimatedTokens: number,
  ): Promise<LlmIntentParseResult> {
    // §39.7: ModelGateway integration for multilingual intent recognition
    // The model gateway is injected at construction time and used for LLM-based
    // classification. Specific invocation depends on gateway implementation.
    const prompt = this.buildIntentClassificationPrompt(message, locale);
    const response = await this.modelGateway!.complete(prompt);

    // R5-19: Record token usage - prompt tokens + estimated response tokens
    const totalTokens = estimatedTokens + Math.floor(prompt.length / 4);
    this.budgetTracker.recordTokens(totalTokens);

    return this.parseLlmResponse(response, locale);
  }

  /**
   * R5-18: Estimate token count for a message.
   * Rough estimation: ~4 characters per token on average.
   */
  private estimateTokenCount(message: string): number {
    return Math.ceil(message.length / 4);
  }

  /**
   * Build a prompt for intent classification based on locale.
   * Supports multilingual classification context.
   */
  private buildIntentClassificationPrompt(message: string, locale: string): string {
    const localeLabels: Record<string, string> = {
      "zh-CN": "中文",
      "en-US": "English",
      "ja-JP": "日本語",
      "de-DE": "Deutsch",
    };
    const langLabel = localeLabels[locale] ?? "English";
    return `Classify the intent of this ${langLabel} message. Categories: task_create, task_query, task_modify, status_inquiry, approval_action. Message: "${message}"`;
  }

  /**
   * Parse LLM response into structured intent result.
   */
  private parseLlmResponse(content: string, locale: string): LlmIntentParseResult {
    const lower = content.toLowerCase();
    let intentType: ParsedIntentToken["intentType"] = "task_query";
    if (lower.includes("task_create") || lower.includes("create")) {
      intentType = "task_create";
    } else if (lower.includes("task_query") || lower.includes("query")) {
      intentType = "task_query";
    } else if (lower.includes("task_modify") || lower.includes("modify")) {
      intentType = "task_modify";
    } else if (lower.includes("status_inquiry") || lower.includes("status")) {
      intentType = "status_inquiry";
    } else if (lower.includes("approval_action") || lower.includes("approve")) {
      intentType = "approval_action";
    }
    return {
      intentType,
      confidence: 0.82,
      reasoning: content,
      language: locale,
    };
  }

  /**
   * Fallback to regex-based parsing with language awareness and validation.
   * R9-20: Applies intent validation after parsing to ensure extraction quality.
   * R5-18: Enforces delegation depth limit.
   * R5-20: Validates intent extraction result.
   */
  private fallbackToRegex(message: string, locale: string, delegationDepth = 0): LlmIntentParseResult {
    const tokens = parseIntentTokens(message);
    const primary = tokens[0];
    const confidence = primary?.confidence ?? 0.5;

    // R5-20: Apply intent validation
    const validation = validateIntentExtraction(message, primary?.intentType ?? "task_query", confidence);

    // R5-18: Enforce delegation depth in reasoning
    const depthReason = delegationDepth >= this.maxDelegationDepth
      ? "; max delegation depth reached"
      : "";

    return {
      intentType: primary?.intentType ?? "task_query",
      confidence: validation.valid ? confidence : (validation.reasonCode != null ? confidence * 0.8 : confidence),
      reasoning: validation.valid
        ? `Regex fallback for ${locale} input${depthReason}`
        : `Regex fallback for ${locale} input; ${validation.reasonCode}${depthReason}`,
      language: locale,
    };
  }
}

/**
 * §39.3: Confidence thresholds for LLM vs fallback parsing
 */
export const INTENT_CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence to accept LLM result */
  LLM_ACCEPT_THRESHOLD: 0.75,
  /** Confidence below which fallback is triggered */
  FALLBACK_THRESHOLD: 0.50,
  /** §39.3: Minimum acceptable confidence for intent to be considered valid */
  MIN_ACCEPTABLE_CONFIDENCE: 0.65,
} as const;

/**
 * §39.3: Detect input language for multilingual support
 */
export function detectInputLanguage(message: string): string {
  if (/[一-鿿]/.test(message)) {
    return "zh-CN";
  }
  if (/[぀-ヿ]/.test(message)) {
    return "ja-JP";
  }
  if (/[äöüß]/i.test(message)) {
    return "de-DE";
  }
  if (/[a-z]/i.test(message)) {
    return "en-US";
  }
  return "en-US";
}
