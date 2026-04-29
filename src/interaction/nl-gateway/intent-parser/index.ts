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