/**
 * Disambiguation Handler
 *
 * Implements intent disambiguation when confidence is below threshold.
 * Generates clarification questions to help users refine their intent.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §39
 */

import type { DetectedIntent, ExtractedEntity } from "../index.js";

/**
 * Configuration for disambiguation behavior
 */
export interface DisambiguationConfig {
  /** Confidence threshold below which disambiguation is triggered */
  readonly threshold: number;
  /** Low confidence threshold for severe disambiguation */
  readonly lowConfidenceThreshold: number;
  /** Maximum number of clarification questions to generate */
  readonly maxClarificationQuestions: number;
  /** Whether to proactively ask for clarification */
  readonly enableProactiveClarification: boolean;
}

/**
 * Disambiguation question structure
 */
export interface ClarificationQuestion {
  readonly question: string;
  readonly options?: readonly string[];
  readonly entityType?: string;
  readonly intentHint?: string;
}

/**
 * Disambiguation result
 */
export interface DisambiguationResult {
  readonly requiresClarification: boolean;
  readonly questions: readonly ClarificationQuestion[];
  readonly suggestedIntents?: readonly string[];
  readonly confidenceLevel: "high" | "medium" | "low" | "very_low";
  readonly reason: string;
}

const DEFAULT_DISAMBIGUATION_CONFIG: DisambiguationConfig = {
  threshold: 0.7,
  lowConfidenceThreshold: 0.5,
  maxClarificationQuestions: 3,
  enableProactiveClarification: true,
};

/**
 * Check if disambiguation is needed based on confidence and entities
 */
export function detectAmbiguity(
  message: string,
  confidence: number,
  requiredEntityCount: number,
  extractedEntityCount: number,
): boolean {
  const normalized = message.trim();
  const hasRequiredEntities = extractedEntityCount >= requiredEntityCount;
  const isShortMessage = normalized.length < 6;
  const isLowConfidence = confidence < 0.7;

  // A satisfied single-entity intent should not be forced into clarification
  // purely because the message is terse or the model confidence is conservative.
  // If both signals fire at once, still require clarification.
  if (requiredEntityCount <= 1 && extractedEntityCount >= 1) {
    return isShortMessage && isLowConfidence;
  }

  // Short message is ambiguous when entity extraction did not already anchor intent.
  if (isShortMessage) {
    return true;
  }

  // Low confidence only requires clarification when extraction also failed to anchor intent.
  if (isLowConfidence) {
    return !hasRequiredEntities;
  }

  // Otherwise rely on required entity coverage.
  return !hasRequiredEntities;
}

/**
 * Disambiguation Handler for NL Gateway
 *
 * Generates clarification questions when intent confidence is low.
 */
export class DisambiguationHandler {
  private readonly config: DisambiguationConfig;

  public constructor(config: Partial<DisambiguationConfig> = {}) {
    this.config = { ...DEFAULT_DISAMBIGUATION_CONFIG, ...config };
  }

  /**
   * Determine if clarification is needed for the given intent
   */
  public requiresClarification(
    confidence: number,
    message: string,
    entityCount: number,
  ): boolean {
    if (!this.config.enableProactiveClarification) {
      return false;
    }
    return detectAmbiguity(message, confidence, 1, entityCount);
  }

  /**
   * Get the confidence level category
   */
  public getConfidenceLevel(confidence: number): DisambiguationResult["confidenceLevel"] {
    if (confidence >= 0.85) {
      return "high";
    }
    if (confidence >= this.config.threshold) {
      return "medium";
    }
    if (confidence >= this.config.lowConfidenceThreshold) {
      return "low";
    }
    return "very_low";
  }

  /**
   * Generate clarification questions for low-confidence intents
   */
  public generateClarification(
    message: string,
    confidence: number,
    detectedIntent: DetectedIntent,
    entities: readonly ExtractedEntity[],
  ): DisambiguationResult {
    const confidenceLevel = this.getConfidenceLevel(confidence);
    const questions: ClarificationQuestion[] = [];

    if (confidenceLevel === "very_low") {
      questions.push(...this.generateVeryLowConfidenceQuestions(message, detectedIntent));
    } else if (confidenceLevel === "low") {
      questions.push(...this.generateLowConfidenceQuestions(message, detectedIntent, entities));
    } else if (entities.length === 0) {
      questions.push(...this.generateEntityQuestions(message, detectedIntent));
    }

    const reason = this.buildReason(confidenceLevel, entities.length, message);

    return {
      requiresClarification: questions.length > 0,
      questions: questions.slice(0, this.config.maxClarificationQuestions),
      suggestedIntents: this.suggestAlternativeIntents(detectedIntent),
      confidenceLevel,
      reason,
    };
  }

  /**
   * Build a disambiguation result from intent detection
   */
  public disambiguate(
    message: string,
    confidence: number,
    intent: DetectedIntent,
    allIntents: readonly DetectedIntent[],
  ): DisambiguationResult {
    const confidenceLevel = this.getConfidenceLevel(confidence);

    // If multiple intents detected with similar confidence, ask user to choose
    if (allIntents.length > 1) {
      const topIntents = [...allIntents]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      if (topIntents.length > 1 && topIntents[0]!.confidence - topIntents[1]!.confidence < 0.15) {
        return {
          requiresClarification: true,
          questions: [
            {
              question: "我需要确认您的意图：",
              options: topIntents.map((i) => this.formatIntentOption(i.intentType)),
              intentHint: topIntents[0]!.intentType,
            },
          ],
          suggestedIntents: topIntents.map((i) => i.intentType),
          confidenceLevel,
          reason: "Multiple intents with similar confidence detected",
        };
      }
    }

    return this.generateClarification(message, confidence, intent, intent.entities);
  }

  /**
   * Format an intent type for user display
   */
  private formatIntentOption(intentType: DetectedIntent["intentType"]): string {
    const labels: Record<DetectedIntent["intentType"], string> = {
      task_create: "创建新任务",
      task_query: "查询/获取信息",
      task_modify: "修改/更新已有内容",
      status_inquiry: "状态查询",
      approval_action: "审批操作",
    };
    return labels[intentType] ?? intentType;
  }

  /**
   * Generate questions for very low confidence (< 0.5)
   */
  private generateVeryLowConfidenceQuestions(
    message: string,
    intent: DetectedIntent,
  ): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];
    const normalized = message.toLowerCase();

    // Generic clarification for very low confidence
    questions.push({
      question: "我无法确定您的意图。请问您希望我：",
      options: [
        "创建一个新任务",
        "查询现有任务状态",
        "修改某个任务",
        "执行系统操作",
      ],
      intentHint: intent.intentType,
    });

    // Context-specific questions
    if (/(deploy|release|发布|上线)/i.test(normalized)) {
      questions.push({
        question: "您是要部署到哪个环境？",
        options: ["生产环境", "测试环境", "开发环境"],
        entityType: "environment",
      });
    }

    if (/(delete|remove|删除|清空)/i.test(normalized)) {
      questions.push({
        question: "删除操作不可恢复，请问您确定要删除什么？",
        options: ["特定资源", "批量资源", "取消操作"],
        intentHint: "task_modify",
      });
    }

    return questions;
  }

  /**
   * Generate questions for low confidence (0.5 - 0.7)
   */
  private generateLowConfidenceQuestions(
    message: string,
    intent: DetectedIntent,
    entities: readonly ExtractedEntity[],
  ): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];
    const normalized = message.toLowerCase();

    // Ask about action type
    if (this.isVagueAction(message)) {
      questions.push({
        question: "你希望我先查询现状、创建新任务，还是修改已有内容？",
        intentHint: intent.intentType,
      });
    }

    // Ask about scope if vague
    if (this.isVagueScope(message)) {
      questions.push({
        question: "请补充更具体的范围，例如：",
        options: ["业务域（工程/营销/HR）", "时间区间", "具体目标对象"],
        entityType: "scope",
      });
    }

    // Ask for missing entities
    if (entities.length === 0 && this.requiresEntities(intent.intentType)) {
      questions.push({
        question: "请指出具体对象或环境，避免误操作：",
        options: ["指定环境", "指定资源类型", "指定时间范围"],
        entityType: "general",
      });
    }

    return questions;
  }

  /**
   * Generate questions for missing entities
   */
  private generateEntityQuestions(
    message: string,
    intent: DetectedIntent,
  ): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];
    const normalized = message.toLowerCase();

    if (this.requiresEntities(intent.intentType)) {
      if (/(deploy|release|发布|上线)/i.test(normalized)) {
        questions.push({
          question: "这是要部署到哪个环境？",
          options: ["生产环境 (prod)", "测试环境 (staging)", "开发环境 (dev)"],
          entityType: "environment",
        });
      }

      if (/(modify|update|修改|更新)/i.test(normalized)) {
        questions.push({
          question: "请指定要修改的对象：",
          options: ["任务 ID", "工作流", "配置项"],
          entityType: "target",
        });
      }
    }

    return questions;
  }

  /**
   * Check if the message contains a vague action
   */
  private isVagueAction(message: string): boolean {
    const vaguePatterns = [
      "做一份报表",
      "处理一下",
      "看一下",
      "帮我处理",
      "帮我做",
      "做一个",
      "optimize this",
      "handle it",
      "fix this",
      "do the report",
    ];
    const normalized = message.toLowerCase();
    return vaguePatterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
  }

  /**
   * Check if the message has vague scope
   */
  private isVagueScope(message: string): boolean {
    const vaguePatterns = [
      "这个",
      "那些",
      "相关的",
      "一些",
      "某个",
      "these",
      "those",
      "some",
      "any",
    ];
    const normalized = message.toLowerCase();
    return vaguePatterns.some((pattern) => normalized.includes(pattern));
  }

  /**
   * Check if intent typically requires entities
   */
  private requiresEntities(intentType: DetectedIntent["intentType"]): boolean {
    return ["task_modify", "approval_action"].includes(intentType);
  }

  /**
   * Suggest alternative intents
   */
  private suggestAlternativeIntents(
    currentIntent: DetectedIntent,
  ): readonly string[] {
    const allIntents: DetectedIntent["intentType"][] = [
      "task_create",
      "task_query",
      "task_modify",
      "status_inquiry",
      "approval_action",
    ];

    return allIntents.filter((i) => i !== currentIntent.intentType);
  }

  /**
   * Build human-readable reason for disambiguation
   */
  private buildReason(
    confidenceLevel: DisambiguationResult["confidenceLevel"],
    entityCount: number,
    message: string,
  ): string {
    switch (confidenceLevel) {
      case "very_low":
        return "意图置信度过低，无法自动处理";
      case "low":
        return "意图置信度较低，需要您确认";
      case "medium":
        if (entityCount === 0) {
          return "缺少必要参数，需要补充信息";
        }
        return "意图基本明确，但可以确认";
      default:
        return "意图置信度较高";
    }
  }
}
