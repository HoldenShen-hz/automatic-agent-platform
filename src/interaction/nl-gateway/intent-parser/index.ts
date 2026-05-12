import type { ExtractedEntity } from "../index.js";

export interface IntentParserPort {
  parseIntent(message: string, context?: IntentParserContext): Promise<IntentParserResult>;
}

export interface IntentParserModelGateway {
  complete(prompt: string): Promise<string>;
}

export interface IntentParserContext {
  readonly locale?: string;
  readonly conversationHistory?: readonly { role: "user" | "assistant"; message: string }[];
  readonly detectedEntities?: readonly ExtractedEntity[];
  readonly domainHint?: string;
}

export interface ParsedIntentToken {
  readonly intentType: IntentType;
  readonly confidence: number;
}

export interface IntentParserResult {
  readonly intentType: IntentType;
  readonly confidence: number;
  readonly reasoning?: string;
  readonly alternativeIntents?: readonly { intentType: IntentType; confidence: number }[];
}

export interface LlmIntentParseResult {
  readonly intentType: IntentType;
  readonly confidence: number;
  readonly reasoning?: string;
  readonly language?: string;
}

export type IntentType = "task_create" | "task_query" | "task_modify" | "status_inquiry" | "approval_action" | "why";

export const INTENT_CONFIDENCE_THRESHOLDS = {
  LLM_ACCEPT_THRESHOLD: 0.75,
  FALLBACK_THRESHOLD: 0.50,
} as const;

interface IntentSignal {
  readonly pattern: RegExp;
  readonly intent: IntentType;
  readonly confidence: number;
  readonly reasoning: string;
}

/**
 * Structured intent signals for heuristic parsing.
 * Multiple signals can match; the highest-confidence result is used.
 */
const INTENT_SIGNALS: readonly IntentSignal[] = [
  { pattern: /(?:approve|审批通过|批准|通行)/i, intent: "approval_action", confidence: 0.92, reasoning: "Approval keyword detected" },
  { pattern: /(?:reject|驳回|否决)/i, intent: "approval_action", confidence: 0.90, reasoning: "Rejection keyword detected" },
  { pattern: /(?:status|状态|进度|情况|情况如何)/i, intent: "status_inquiry", confidence: 0.84, reasoning: "Status inquiry keyword detected" },
  { pattern: /(?:summary|摘要|概览|同步)/i, intent: "status_inquiry", confidence: 0.83, reasoning: "Summary request keyword detected" },
  { pattern: /(?:delete|remove|删除|清空|drop)/i, intent: "task_modify", confidence: 0.80, reasoning: "Deletion keyword detected" },
  { pattern: /(?:update|modify|change|修改|更新|调整)/i, intent: "task_modify", confidence: 0.80, reasoning: "Modification keyword detected" },
  { pattern: /(?:create|make|generate|新建|创建|生成|做一个|做个)/i, intent: "task_create", confidence: 0.88, reasoning: "Creation keyword detected" },
  { pattern: /(?:why|为什么|原因|为何)/i, intent: "why", confidence: 0.75, reasoning: "Why question detected" },
];

function matchIntentSignal(message: string): IntentSignal | null {
  let bestMatch: IntentSignal | null = null;
  for (const signal of INTENT_SIGNALS) {
    if (signal.pattern.test(message)) {
      if (bestMatch === null || signal.confidence > bestMatch.confidence) {
        bestMatch = signal;
      }
    }
  }
  return bestMatch;
}

export function detectInputLanguage(message: string): string {
  if (/[\u4e00-\u9fff]/.test(message)) {
    return "zh-CN";
  }
  if (/[\u3040-\u30ff]/.test(message)) {
    return "ja-JP";
  }
  if (/[äöüß]/i.test(message)) {
    return "de-DE";
  }
  return "en-US";
}

export function parseIntentTokens(message: string): ParsedIntentToken[] {
  const normalized = message.trim().toLowerCase();

  // Single-word approval commands get high confidence
  if (/(?:approve|审批|通过|批准)/i.test(message) && message.trim().length < 10) {
    return [{ intentType: "approval_action", confidence: 0.92 }];
  }

  // Check structured signals
  const matchedSignal = matchIntentSignal(normalized);
  const entityCount = (message.match(/\b[\w一-龥]{2,}\b/g) ?? []).length;

  if (matchedSignal !== null) {
    return [{
      intentType: matchedSignal.intent,
      confidence: matchedSignal.confidence,
    }];
  }

  const questionPatterns = /[?？]|^(?:what|why|how|when|where|who|which|is|are|can|could|would|should)\b|(?:是否|有没有|怎么|怎样|什么|为何|为啥|多少|哪个|哪一个)/i;
  if (questionPatterns.test(message)) {
    return [{ intentType: "task_query", confidence: 0.64 }];
  }

  const requestPatterns = /(?:请|请你|帮我|麻烦|需要|想要|安排|执行|修复|排查|处理|run|fix|investigate|deploy|restart|rollback)/i;
  if (requestPatterns.test(message) || (normalized.length > 20 && entityCount >= 4)) {
    return [{ intentType: "task_create", confidence: normalized.length > 20 ? 0.68 : 0.65 }];
  }

  return [{ intentType: "task_query", confidence: 0.62 }];
}

export interface ModelIntentParserPort {
  parseWithLlm(input: {
    readonly message: string;
    readonly locale: string;
  }): Promise<ParsedIntentToken | readonly ParsedIntentToken[] | null>;
}

export async function parseIntentTokensWithModel(
  message: string,
  options: {
    readonly locale?: string;
    readonly parser?: ModelIntentParserPort | null;
    readonly minimumConfidence?: number;
  } = {},
): Promise<ParsedIntentToken[]> {
  const heuristic = parseIntentTokens(message);
  if (options.parser == null) {
    return heuristic;
  }

  try {
    const parsed = await options.parser.parseWithLlm({
      message,
      locale: options.locale ?? "und",
    });
    const normalized = Array.isArray(parsed) ? parsed.filter(Boolean) : parsed == null ? [] : [parsed];
    const primary = normalized[0];
    if (primary == null) {
      return heuristic;
    }
    const minimumConfidence = options.minimumConfidence ?? 0.75;
    if (primary.confidence >= Math.max(minimumConfidence, heuristic[0]?.confidence ?? 0)) {
      return normalized;
    }
  } catch {
    return heuristic;
  }

  return heuristic;
}

function parseIntentTypeFromText(response: string): IntentType {
  const normalized = response.toLowerCase();
  if (normalized.includes("why")) {
    return "why";
  }
  if (normalized.includes("approval_action") || normalized.includes("approve")) {
    return "approval_action";
  }
  if (normalized.includes("status_inquiry") || normalized.includes("status")) {
    return "status_inquiry";
  }
  if (normalized.includes("task_modify") || normalized.includes("modify")) {
    return "task_modify";
  }
  if (normalized.includes("task_create") || normalized.includes("create")) {
    return "task_create";
  }
  if (normalized.includes("task_query") || normalized.includes("query")) {
    return "task_query";
  }
  return "task_query";
}

export class LlmIntentParser {
  public constructor(
    private readonly modelGateway: IntentParserModelGateway | null = null,
    private readonly fallbackToRegex = true,
  ) {}

  public async parseWithLlm(message: string, locale?: string): Promise<LlmIntentParseResult> {
    const resolvedLocale = locale ?? detectInputLanguage(message);
    const fallbackReasoning = `Regex fallback (${resolvedLocale})`;

    if (this.modelGateway == null) {
      const fallback = parseIntentTokens(message)[0] ?? {
        intentType: "task_query" as const,
        confidence: INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD,
      };
      return {
        intentType: fallback.intentType,
        confidence: fallback.confidence,
        reasoning: fallbackReasoning,
        language: resolvedLocale,
      };
    }

    try {
      const localeLabel = resolvedLocale === "zh-CN" ? "中文" : resolvedLocale === "en-US" ? "English" : resolvedLocale;
      const response = await this.modelGateway.complete(`Locale: ${localeLabel}\nMessage: ${message}`);
      try {
        const parsed = JSON.parse(response) as Partial<LlmIntentParseResult>;
        if (typeof parsed.intentType === "string" && typeof parsed.confidence === "number") {
          const normalizedConfidence = parsed.intentType === "task_create"
            ? Math.max(parsed.confidence, 0.82)
            : parsed.confidence;
          return {
            intentType: parsed.intentType as IntentType,
            confidence: normalizedConfidence,
            reasoning: parsed.reasoning ?? response,
            language: parsed.language ?? resolvedLocale,
          };
        }
      } catch {
        // Fall through to keyword extraction from the model response body.
      }

      return {
        intentType: parseIntentTypeFromText(response),
        confidence: INTENT_CONFIDENCE_THRESHOLDS.LLM_ACCEPT_THRESHOLD,
        reasoning: response,
        language: resolvedLocale,
      };
    } catch {
      if (this.fallbackToRegex) {
        const fallback = parseIntentTokens(message)[0] ?? {
          intentType: "task_query" as const,
          confidence: INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD,
        };
        return {
          intentType: fallback.intentType,
          confidence: fallback.confidence,
          reasoning: fallbackReasoning,
          language: resolvedLocale,
        };
      }

      return {
        intentType: "task_query",
        confidence: INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD - 0.1,
        reasoning: fallbackReasoning,
        language: resolvedLocale,
      };
    }
  }
}
