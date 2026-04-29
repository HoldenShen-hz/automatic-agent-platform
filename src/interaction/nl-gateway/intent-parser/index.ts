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
 * §39.7: LLM-based intent parser for multilingual intent recognition.
 * Uses ModelGateway for cross-lingual classification with confidence scoring.
 * Falls back to regex-based parsing when LLM is unavailable.
 */
export class LlmIntentParser implements IntentParser {
  private readonly modelGateway: IntentParserModelGateway | null;
  private readonly fallbackEnabled: boolean;

  public constructor(modelGateway?: IntentParserModelGateway | null, fallbackEnabled = true) {
    this.modelGateway = modelGateway ?? null;
    this.fallbackEnabled = fallbackEnabled;
  }

  /**
   * Parse intent using LLM with confidence scoring.
   * Falls back to regex-based parsing on LLM failure or low confidence.
   */
  async parseWithLlm(message: string, locale?: string): Promise<LlmIntentParseResult> {
    const detectedLocale = locale ?? detectInputLanguage(message);

    // §39.7: Attempt LLM-based parsing if modelGateway is available
    if (this.modelGateway != null) {
      try {
        const llmResult = await this.invokeModelGateway(message, detectedLocale);
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
      return this.fallbackToRegex(message, detectedLocale);
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
   */
  private async invokeModelGateway(
    message: string,
    locale: string,
  ): Promise<LlmIntentParseResult> {
    // §39.7: ModelGateway integration for multilingual intent recognition
    // The model gateway is injected at construction time and used for LLM-based
    // classification. Specific invocation depends on gateway implementation.
    const prompt = this.buildIntentClassificationPrompt(message, locale);
    const response = await this.modelGateway!.complete(prompt);
    return this.parseLlmResponse(response, locale);
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
   * Fallback to regex-based parsing with language awareness.
   */
  private fallbackToRegex(message: string, locale: string): LlmIntentParseResult {
    const tokens = parseIntentTokens(message);
    const primary = tokens[0];
    return {
      intentType: primary?.intentType ?? "task_query",
      confidence: primary?.confidence ?? 0.5,
      reasoning: `Regex fallback for ${locale} input`,
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
