import type { ExtractedEntity } from "../index.js";

export type ClarificationLoopState = "in_progress" | "completed" | "blocked";

export interface ClarificationRound {
  readonly roundNumber: number;
  readonly missingSlots: readonly string[];
  readonly generatedQuestions: readonly string[];
  readonly state: ClarificationLoopState;
}

export interface SlotResolverOptions {
  readonly maxRounds?: number;
  readonly slotConfidenceThreshold?: number;
}

const DEFAULT_MAX_ROUNDS = 3;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Iterative slot-filling (Clarification loop) per §39.2.
 *
 * Resolves required slots across multiple rounds, generating clarification
 * questions when slots cannot be filled from the provided entities.
 * Driven by ClarificationState to track progression through rounds.
 */
export class SlotResolver {
  private readonly maxRounds: number;
  private readonly slotConfidenceThreshold: number;

  public constructor(options?: SlotResolverOptions) {
    this.maxRounds = options?.maxRounds ?? DEFAULT_MAX_ROUNDS;
    this.slotConfidenceThreshold = options?.slotConfidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  }

  /**
   * Resolve required slots with iterative clarification support.
   *
   * @param entities - Extracted entities from user input
   * @param requiredEntityTypes - Required slot types to fill
   * @param priorState - Previous clarification state to continue from (undefined for first pass)
   * @param entityConfidence - Optional per-entity confidence scores
   * @param priorConversationContext - Prior conversation turns for context-aware slot resolution
   * @returns Resolution result with missing slots, resolved values, and updated clarification state
   */
  public resolveRequiredSlots(
    entities: readonly ExtractedEntity[],
    requiredEntityTypes: readonly string[],
    priorState?: ClarificationRound,
    entityConfidence?: Record<string, number>,
    priorConversationContext?: readonly {
      turnNumber: number;
      message: string;
      detectedIntent: { intentType: string };
      timestamp: string;
    }[],
  ): {
    readonly missing: readonly string[];
    readonly resolved: Record<string, unknown>;
    readonly clarificationRound: ClarificationRound;
    readonly shouldRequestClarification: boolean;
    readonly generatedQuestions: readonly string[];
  } {
    const resolved: Record<string, unknown> = {};
    const entityConfidenceMap = entityConfidence ?? {};

    // §39.5: Build context-aware resolution map using prior conversation turns
    const contextSlots = this.extractContextSlots(priorConversationContext);

    // Build resolved map from entities, tracking confidence
    for (const entity of entities) {
      const confidence = entityConfidenceMap[entity.entityType] ?? 1.0;
      // Only resolve if confidence meets threshold
      if (confidence >= this.slotConfidenceThreshold && !(entity.entityType in resolved)) {
        resolved[entity.entityType] = entity.normalized;
      }
    }

    // §39.5: Fill slots from conversation context when not present in entities
    for (const slot of requiredEntityTypes) {
      if (!(slot in resolved) && slot in contextSlots) {
        resolved[slot] = contextSlots[slot];
      }
    }

    const currentMissing = requiredEntityTypes.filter((item) => !(item in resolved));
    const currentRound = (priorState?.roundNumber ?? 0) + 1;

    // Check if we should continue clarification or block
    const state: ClarificationLoopState =
      currentRound >= this.maxRounds ? "blocked"
      : currentMissing.length > 0 ? "in_progress"
      : "completed";

    // Generate clarification questions for missing slots
    const generatedQuestions = state === "in_progress"
      ? this.generateSlotClarificationQuestions(currentMissing, currentRound)
      : [];

    return {
      missing: currentMissing,
      resolved,
      clarificationRound: {
        roundNumber: currentRound,
        missingSlots: currentMissing,
        generatedQuestions,
        state,
      },
      shouldRequestClarification: state === "in_progress",
      generatedQuestions,
    };
  }

  /**
   * §39.5: Extract slot values from prior conversation context.
   * Uses regex patterns to find previously mentioned slot values.
   */
  private extractContextSlots(
    priorContext?: readonly {
      turnNumber: number;
      message: string;
      detectedIntent: { intentType: string };
      timestamp: string;
    }[],
  ): Record<string, unknown> {
    const slots: Record<string, unknown> = {};
    if (!priorContext || priorContext.length === 0) {
      return slots;
    }

    // Patterns for extracting slot values from prior messages
    const slotPatterns: Record<string, RegExp> = {
      date: /(?:在|于|on\s+)?(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
      time: /(?:在|于|at\s+)?(\d{1,2}:\d{2})/,
      budget: /(?:预算|budget|cost)[:\s]*([¥$€]?\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      priority: /(?:优先级|priority)[:\s]*(high|medium|low|高|中|低)/i,
      assignee: /(?:分配给|assign to|负责人)[:\s]*(\S+)/i,
      environment: /(?:环境|environment)[:\s]*(production|staging|dev|生产|测试|开发)/i,
    };

    // Process recent turns (last 3) for context
    const recentTurns = priorContext.slice(-3);
    for (const turn of recentTurns) {
      for (const [slotType, pattern] of Object.entries(slotPatterns)) {
        if (!(slotType in slots)) {
          const match = turn.message.match(pattern);
          if (match && match[1]) {
            slots[slotType] = match[1];
          }
        }
      }
    }

    return slots;
  }

  /**
   * Generate clarifying questions for missing slots.
   */
  private generateSlotClarificationQuestions(missingSlots: readonly string[], round: number): string[] {
    const slotQuestionTemplates: Record<string, string> = {
      date: "请问您希望这个任务在什么日期执行？",
      time: "请问具体希望在什么时间进行？",
      duration: "任务需要持续多长时间？",
      budget: "请问您的预算范围是多少？",
      priority: "这个任务的优先级是怎样的？",
      assignee: "请问由谁来执行这个任务？",
      domain: "这个任务属于哪个业务域？",
      environment: "需要在哪个环境执行？",
      channel: "您希望通过哪个渠道执行？",
    };

    const questions: string[] = [];
    for (const slot of missingSlots) {
      const template = slotQuestionTemplates[slot];
      if (template) {
        questions.push(template);
      } else {
        questions.push(`请提供 ${slot} 信息`);
      }
    }
    return questions;
  }

  /**
   * Check if the clarification loop has exceeded max rounds.
   */
  public isBlocked(clarificationRound: ClarificationRound): boolean {
    return clarificationRound.state === "blocked";
  }

  /**
   * Get the maximum number of clarification rounds allowed.
   */
  public getMaxRounds(): number {
    return this.maxRounds;
  }
}

/**
 * @deprecated Use SlotResolver.resolveRequiredSlots instead - this kept for backward compatibility
 */
export function resolveRequiredSlots(
  entities: readonly ExtractedEntity[],
  requiredEntityTypes: readonly string[],
): { readonly missing: readonly string[]; readonly resolved: Record<string, unknown> } {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots(entities, requiredEntityTypes);
  return {
    missing: result.missing,
    resolved: result.resolved,
  };
}
