import type { ExtractedEntity } from "../index.js";

export interface IntentParserPort {
  parseIntent(message: string, context?: IntentParserContext): Promise<IntentParserResult>;
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

export type IntentType = "task_create" | "task_query" | "task_modify" | "status_inquiry" | "approval_action" | "why";

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.70;
const LOW_CONFIDENCE_THRESHOLD = 0.50;

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
  { pattern: /(?:status|状态|进度|情况|情况如何)/i, intent: "status_inquiry", confidence: 0.85, reasoning: "Status inquiry keyword detected" },
  { pattern: /(?:summary|摘要|概览|同步)/i, intent: "status_inquiry", confidence: 0.83, reasoning: "Summary request keyword detected" },
  { pattern: /(?:delete|remove|删除|清空|drop)/i, intent: "task_modify", confidence: 0.82, reasoning: "Deletion keyword detected" },
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

function deriveConfidenceFromSignals(
  message: string,
  matchedSignal: IntentSignal | null,
  entityCount: number,
): number {
  if (matchedSignal === null) {
    return 0.55; // Base low confidence for unclear intent
  }

  let confidence = matchedSignal.confidence;

  // Boost for specific entities that anchor the intent
  if (entityCount > 0) {
    confidence = Math.min(0.98, confidence + 0.05 * Math.min(entityCount, 3));
  }

  // Reduce for vague/short messages
  const normalizedLength = message.trim().length;
  if (normalizedLength < 8) {
    confidence -= 0.08;
  } else if (normalizedLength < 15) {
    confidence -= 0.04;
  }

  // Reduce for presence of vague words
  const vaguePatterns = /(?:这个|那些|一些|某个|帮我|一下|处理)/i;
  if (vaguePatterns.test(message)) {
    confidence -= 0.06;
  }

  return Math.max(0.30, Math.min(0.98, confidence));
}

function generateAlternativeIntents(
  primaryIntent: IntentType,
  primaryConfidence: number,
): { intentType: IntentType; confidence: number }[] {
  const allIntents: IntentType[] = ["task_create", "task_query", "task_modify", "status_inquiry", "approval_action", "why"];
  return allIntents
    .filter((intent) => intent !== primaryIntent)
    .map((intent) => ({ intentType: intent, confidence: Math.max(0.10, primaryConfidence - 0.25 - Math.random() * 0.15) }))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3);
}

export function parseIntentTokens(message: string): ParsedIntentToken[] {
  const normalized = message.toLowerCase();

  // Single-word approval commands get high confidence
  if (/(?:approve|审批|通过|批准)/i.test(message) && message.trim().length < 10) {
    return [{ intentType: "approval_action", confidence: 0.94 }];
  }

  // Check structured signals
  const matchedSignal = matchIntentSignal(normalized);
  const entityCount = (message.match(/\b[\w一-龥]{2,}\b/g) ?? []).length;
  const confidence = deriveConfidenceFromSignals(message, matchedSignal, entityCount);

  if (matchedSignal !== null) {
    return [{
      intentType: matchedSignal.intent,
      confidence: Number(confidence.toFixed(2)),
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

  return [{ intentType: "task_query", confidence: normalized.length > 12 ? 0.62 : 0.60 }];
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
