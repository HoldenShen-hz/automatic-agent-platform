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
  if (/(?:create|make|生成|创建|做一个)/i.test(normalized)) {
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
 * R5-23: Entity extraction validation result
 */
export interface EntityValidationResult {
  readonly valid: boolean;
  readonly reasonCode: string | null;
  readonly validatedEntities: readonly EntityReference[];
  readonly suggestions: readonly string[];
}

/**
 * R5-25: Entity reference for cross-referencing
 */
export interface EntityReference {
  readonly type: string;
  readonly value: string;
  readonly normalized: string;
  readonly confidence: number;
}

/**
 * R5-23: Known entity patterns for validation
 */
const KNOWN_ENTITY_PATTERNS: Record<string, RegExp[]> = {
  environment: [
    /prod(?:uction)?|staging|dev(?:elopment)?|test|线上|生产|测试|开发/i,
    /env(?:ironment)?[:\s]*[a-z0-9_-]+/i,
  ],
  user: [
    /user[:\s]*[a-z0-9_-]+|账号|用户|account[:\s]*[a-z0-9_-]+/i,
    /@[\w.-]+/,
  ],
  resource: [
    /resource[:\s]*[a-z0-9_-]+|配置|config/i,
    /[\w-]+-(?:id|uuid|name)[:\s]*[\w.-]+/i,
  ],
  action: [
    /deploy|release|delete|create|update|modify|发布|删除|创建|修改/i,
  ],
};

/**
 * R5-23: Entity types for extraction validation
 */
type EntityType = keyof typeof KNOWN_ENTITY_PATTERNS;

/**
 * R5-23: Extract and validate entities from a message.
 * Validates that extracted entities match known patterns.
 */
export function validateEntityExtraction(message: string): EntityValidationResult {
  const suggestions: string[] = [];
  const validatedEntities: EntityReference[] = [];

  for (const [type, patterns] of Object.entries(KNOWN_ENTITY_PATTERNS)) {
    for (const pattern of patterns) {
      const matches = message.match(new RegExp(pattern, "gi"));
      if (matches) {
        for (const match of matches) {
          validatedEntities.push({
            type,
            value: match,
            normalized: match.toLowerCase().trim(),
            confidence: 0.85,
          });
        }
      }
    }
  }

  // R5-23: Check for action verbs without entity context
  const hasActionVerb = /(deploy|release|delete|create|update|修改|删除|创建)/i.test(message);
  const hasEntity = validatedEntities.length > 0;

  if (hasActionVerb && !hasEntity) {
    suggestions.push("请提供具体的操作目标（如环境、账号或资源）");
    return {
      valid: false,
      reasonCode: "nl_gateway.entity_extraction_validation_failed",
      validatedEntities,
      suggestions,
    };
  }

  return {
    valid: true,
    reasonCode: null,
    validatedEntities,
    suggestions: [],
  };
}

/**
 * R5-24: Confidence scoring weights for different signal types
 */
const CONFIDENCE_WEIGHTS = {
  EXACT_KEYWORD_MATCH: 0.95,
  PARTIAL_KEYWORD_MATCH: 0.75,
  CONTEXTUAL_MATCH: 0.60,
  FUZZY_MATCH: 0.40,
  NO_MATCH: 0.20,
} as const;

/**
 * R5-24: Intent confidence scoring via regex patterns.
 * Provides fallback confidence scoring when LLM is unavailable.
 */
export function calculateConfidenceScore(message: string, intentType: ParsedIntentToken["intentType"]): number {
  const normalized = message.toLowerCase().trim();
  let score = 0.5;

  // R5-24: Pattern-based keyword scoring
  const keywordPatterns: Record<ParsedIntentToken["intentType"], RegExp[]> = {
    task_create: [
      /(?:create|make|generate|build|新建|创建|生成|做一个)/i,
      /(?:deploy|release|start|begin)/i,
    ],
    task_query: [
      /(?:query|search|find|look\s+up|查询|搜索|查找|看看)/i,
      /(?:status|progress|状态|进度)/i,
    ],
    task_modify: [
      /(?:update|modify|change|edit|修改|更新|改变)/i,
      /(?:delete|remove|取消|删除)/i,
    ],
    status_inquiry: [
      /(?:status|summary|overview|sync|状态|摘要|同步)/i,
      /(?:what.*is.*status|how.*going|进行.*如何)/i,
    ],
    approval_action: [
      /(?:approve|reject|accept|审批|通过|拒绝)/i,
      /(?:confirm|ok|yes|确认|同意)/i,
    ],
  };

  const patterns = keywordPatterns[intentType] ?? [];
  let matchedWeight: number = CONFIDENCE_WEIGHTS.NO_MATCH;

  for (const pattern of patterns) {
    if (pattern.test(normalized)) {
      if (pattern.source.includes("^(?:") || pattern.source.startsWith("^")) {
        matchedWeight = Math.max(matchedWeight, CONFIDENCE_WEIGHTS.EXACT_KEYWORD_MATCH);
      } else {
        matchedWeight = Math.max(matchedWeight, CONFIDENCE_WEIGHTS.PARTIAL_KEYWORD_MATCH);
      }
    }
  }

  // R5-24: Context scoring based on message structure
  const hasEntity = /(?:prod|staging|dev|user|account|env|线上|生产|账号|环境)/i.test(normalized);
  const hasAction = /(?:create|delete|deploy|modify|更新|删除|创建)/i.test(normalized);
  const hasQualifier = /(?:please|帮我|请|can\s+you|could)/i.test(normalized);

  if (hasEntity && hasAction) {
    score = Math.max(score, 0.85);
  }
  if (hasQualifier) {
    score = Math.min(score + 0.05, 0.95);
  }
  if (!hasEntity && hasAction) {
    score = Math.min(score - 0.1, 0.75);
  }

  const rawConfidence = score * matchedWeight;
  return Math.min(Math.max(rawConfidence, 0.2), 0.98) as number;
}

/**
 * R5-25: Cross-reference validation result for entity resolution
 */
export interface CrossReferenceResult {
  readonly consistent: boolean;
  readonly conflicts: readonly string[];
  readonly resolvedEntities: readonly EntityReference[];
}

/**
 * R5-25: Cross-reference entities to validate consistency.
 * Ensures entities referenced across different contexts are coherent.
 */
export function crossReferenceEntities(
  entities: readonly EntityReference[],
  intentType: ParsedIntentToken["intentType"],
): CrossReferenceResult {
  const conflicts: string[] = [];
  const resolvedEntities: EntityReference[] = [];

  // R5-25: Build entity index by type
  const entityByType = new Map<string, EntityReference[]>();
  for (const entity of entities) {
    const existing = entityByType.get(entity.type) ?? [];
    existing.push(entity);
    entityByType.set(entity.type, existing);
  }

  // R5-25: Check for environment/action conflicts
  const environments = entityByType.get("environment") ?? [];
  const actions = entityByType.get("action") ?? [];
  const users = entityByType.get("user") ?? [];

  // R5-25: Validate high-risk actions have environment context
  if (intentType === "task_create" && actions.length > 0 && environments.length === 0) {
    conflicts.push("高风险操作缺少环境上下文 (high-risk action missing environment context)");
  }

  // R5-25: Validate approval actions have target entity
  if (intentType === "approval_action" && (environments.length === 0 && users.length === 0)) {
    conflicts.push("审批操作缺少目标实体 (approval action missing target entity)");
  }

  // R5-25: Detect conflicting environment references
  if (environments.length > 1) {
    const uniqueEnvs = new Set(environments.map(e => e.normalized));
    if (uniqueEnvs.size > 1) {
      conflicts.push(`多个冲突的环境引用 (multiple conflicting environment references): ${Array.from(uniqueEnvs).join(", ")}`);
    }
  }

  // R5-25: Resolve entities by type, keeping highest confidence
  const entityEntries = Array.from(entityByType.entries());
  for (const [type, typeEntities] of entityEntries) {
    const resolved = typeEntities.reduce((highest, current) =>
      current.confidence > highest.confidence ? current : highest
    );
    resolvedEntities.push(resolved);
  }

  return {
    consistent: conflicts.length === 0,
    conflicts,
    resolvedEntities,
  };
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
  // R5-32: Use configurable threshold from DEFAULT_CONFIDENCE_THRESHOLDS
  if (confidence < DEFAULT_CONFIDENCE_THRESHOLDS.minAcceptableConfidence) {
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
 * R5-32: Supports configurable confidence thresholds.
 * R5-34: Supports confidence logging for debugging.
 */
export class LlmIntentParser implements IntentParser {
  private readonly modelGateway: IntentParserModelGateway | null;
  private readonly fallbackEnabled: boolean;
  /** R5-18: Delegation depth limit */
  private readonly maxDelegationDepth: number;
  /** R5-19: Budget tracker for intent extraction */
  private readonly budgetTracker: IntentExtractionBudgetTracker;
  /** R5-32: Configurable confidence thresholds */
  private readonly confidenceThresholds: IntentConfidenceThresholds;
  /** R5-34: Enable confidence logging for debugging */
  private readonly enableConfidenceLogging: boolean;

  /**
   * R5-32: Constructor with options object.
   * Supports backward-compatible signature: (modelGateway, fallbackEnabled, maxDelegationDepth, maxIntentTokens)
   */
  public constructor(
    modelGatewayOrOptions?: IntentParserModelGateway | null | IntentParserOptions,
    fallbackEnabled?: boolean,
    maxDelegationDepth?: number,
    maxIntentTokens?: number,
  ) {
    // R5-32: Support both old positional args and new options object
    let normalizedOptions: IntentParserOptions;
    if (modelGatewayOrOptions && typeof modelGatewayOrOptions === "object" && !("complete" in modelGatewayOrOptions)) {
      // It's an options object
      normalizedOptions = modelGatewayOrOptions as IntentParserOptions;
    } else {
      // Old positional args - convert to options object
      normalizedOptions = {
        ...(modelGatewayOrOptions !== undefined ? { modelGateway: modelGatewayOrOptions } : {}),
        fallbackEnabled: fallbackEnabled ?? true,
        maxDelegationDepth: maxDelegationDepth ?? DEFAULT_MAX_DELEGATION_DEPTH,
        maxIntentTokens: maxIntentTokens ?? DEFAULT_MAX_INTENT_TOKENS,
      };
    }

    this.modelGateway = normalizedOptions.modelGateway ?? null;
    this.fallbackEnabled = normalizedOptions.fallbackEnabled ?? true;
    this.maxDelegationDepth = normalizedOptions.maxDelegationDepth ?? DEFAULT_MAX_DELEGATION_DEPTH;
    this.budgetTracker = new IntentExtractionBudgetTracker(normalizedOptions.maxIntentTokens ?? DEFAULT_MAX_INTENT_TOKENS);
    this.confidenceThresholds = {
      ...DEFAULT_CONFIDENCE_THRESHOLDS,
      ...normalizedOptions.confidenceThresholds,
    };
    this.enableConfidenceLogging = normalizedOptions.enableConfidenceLogging ?? false;
  }

  /**
   * R5-32: Get current confidence thresholds.
   */
  public getConfidenceThresholds(): IntentConfidenceThresholds {
    return { ...this.confidenceThresholds };
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
   * R5-32: Uses configurable confidence thresholds.
   * R5-34: Logs confidence for debugging when enabled.
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
        // R5-32: Use configurable threshold instead of hardcoded
        if (llmResult.confidence >= this.confidenceThresholds.llmAcceptThreshold) {
          // R5-34: Log confidence for debugging
          this.logConfidence("LLM", llmResult.intentType, llmResult.confidence, message);
          return llmResult;
        }
        // Confidence below threshold - will fall through to fallback
        this.logConfidence("LLM_LOW", llmResult.intentType, llmResult.confidence, message);
      } catch (err) {
        // LLM unavailable - fall through to regex fallback
        this.logConfidence("LLM_ERROR", "unknown", 0, message);
      }
    }

    // §39.7: Fallback to regex-based parsing when LLM fails or is unavailable
    if (this.fallbackEnabled) {
      return this.fallbackToRegex(message, detectedLocale, delegationDepth);
    }

    // Return lowest confidence result if fallback is disabled
    return {
      intentType: "task_query",
      confidence: this.confidenceThresholds.fallbackThreshold - 0.1,
      reasoning: "LLM unavailable and fallback disabled",
      language: detectedLocale,
    };
  }

  /**
   * R5-34: Log confidence for debugging when enabled.
   */
  private logConfidence(source: string, intentType: string, confidence: number, message: string): void {
    if (this.enableConfidenceLogging) {
      const truncatedMsg = message.length > 50 ? `${message.slice(0, 47)}...` : message;
      console.log(`[IntentParser] ${source} confidence=${confidence.toFixed(3)} intent=${intentType} msg="${truncatedMsg}"`);
    }
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
   * R5-24: Uses calculateConfidenceScore for regex-based confidence scoring.
   * R5-25: Applies crossReferenceEntities for entity resolution validation.
   */
  private fallbackToRegex(message: string, locale: string, delegationDepth = 0): LlmIntentParseResult {
    const tokens = parseIntentTokens(message);
    const primary = tokens[0];
    const baseIntentType = primary?.intentType ?? "task_query";

    // R5-24: Calculate confidence score using regex fallback logic
    const confidence = calculateConfidenceScore(message, baseIntentType);

    // R5-20: Apply intent validation
    const validation = validateIntentExtraction(message, baseIntentType, confidence);

    // R5-23: Validate entity extraction
    const entityValidation = validateEntityExtraction(message);

    // R5-25: Apply cross-reference validation for entity resolution
    const crossRefResult = crossReferenceEntities(entityValidation.validatedEntities, baseIntentType);

    // R5-25: Build reasoning including entity conflicts
    let entityReasoning = "";
    if (!crossRefResult.consistent) {
      entityReasoning = `; entity_conflicts: ${crossRefResult.conflicts.join("; ")}`;
    }

    // R5-18: Enforce delegation depth in reasoning
    const depthReason = delegationDepth >= this.maxDelegationDepth
      ? "; max delegation depth reached"
      : "";

    const finalConfidence = (!validation.valid || !entityValidation.valid)
      ? confidence * 0.8
      : confidence;

    return {
      intentType: baseIntentType,
      confidence: finalConfidence,
      reasoning: validation.valid && entityValidation.valid
        ? `Regex fallback for ${locale} input${depthReason}${entityReasoning}`
        : `Regex fallback for ${locale} input; ${validation.reasonCode ?? entityValidation.reasonCode}${depthReason}${entityReasoning}`,
      language: locale,
    };
  }
}

/**
 * Intent configuration
 */
export interface IntentConfidenceThresholds {
  /** Minimum confidence to accept LLM result */
  readonly llmAcceptThreshold: number;
  /** Confidence below which fallback is triggered */
  readonly fallbackThreshold: number;
  /** Minimum acceptable confidence for intent to be considered valid */
  readonly minAcceptableConfidence: number;
}

/**
 * R5-32: Intent parser options for configuration
 */
export interface IntentParserOptions {
  /** Model gateway for LLM-based parsing */
  readonly modelGateway?: IntentParserModelGateway | null;
  /** Whether fallback parsing is enabled */
  readonly fallbackEnabled?: boolean;
  /** Maximum delegation depth */
  readonly maxDelegationDepth?: number;
  /** Maximum tokens for intent extraction budget */
  readonly maxIntentTokens?: number;
  /** Configurable confidence thresholds (R5-32) */
  readonly confidenceThresholds?: Partial<IntentConfidenceThresholds>;
  /** Whether to enable confidence logging for debugging (R5-34) */
  readonly enableConfidenceLogging?: boolean;
}

/**
 * R5-32: Default intent confidence thresholds
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS: IntentConfidenceThresholds = {
  llmAcceptThreshold: 0.75,
  fallbackThreshold: 0.50,
  minAcceptableConfidence: 0.65,
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
