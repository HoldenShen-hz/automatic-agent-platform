import type { ExtractedEntity } from "../index.js";

export interface SlotResolutionOptions {
  /** Maximum clarification rounds (default: 3) */
  readonly maxRounds?: number;
  /** Slot-specific prompts for generating clarification questions */
  readonly promptBySlot?: Readonly<Record<string, string>>;
  /** Previous resolved slots from conversation context */
  readonly previousResolved?: Readonly<Record<string, unknown>>;
}

export interface SlotClarificationState {
  readonly missing: string[];
  readonly resolved: Record<string, unknown>;
  readonly questions: readonly string[];
  readonly attempt: number;
  readonly isComplete: boolean;
  readonly nextExpectedSlot: string | null;
}

/**
 * Resolves required slots from extracted entities with multi-pass refinement support.
 *
 * Single-pass mode: returns immediate resolution status without clarification questions.
 * Multi-pass mode: supports iterative slot filling across clarification rounds.
 */
export function resolveRequiredSlots(
  entities: readonly ExtractedEntity[],
  requiredEntityTypes: readonly string[],
): { readonly missing: string[]; readonly resolved: Record<string, unknown> } {
  const resolved: Record<string, unknown> = {};
  for (const entity of entities) {
    if (!(entity.entityType in resolved)) {
      resolved[entity.entityType] = entity.normalized;
    }
  }
  return {
    missing: requiredEntityTypes.filter((item) => !(item in resolved)),
    resolved,
  };
}

/**
 * Builds slot clarification state with multi-pass refinement support.
 *
 * @param entities - Extracted entities from the message
 * @param requiredEntityTypes - Slots that must be filled
 * @param options - Resolution options including max rounds and prompts
 * @returns SlotClarificationState with resolved/missing slots and questions
 */
export function buildSlotClarificationState(
  entities: readonly ExtractedEntity[],
  requiredEntityTypes: readonly string[],
  options: SlotResolutionOptions = {},
): SlotClarificationState {
  const maxRounds = options.maxRounds ?? 3;
  const resolved: Record<string, unknown> = {
    ...(options.previousResolved ?? {}),
  };

  // First pass: resolve from provided entities
  for (const entity of entities) {
    if (!(entity.entityType in resolved)) {
      resolved[entity.entityType] = entity.normalized;
    }
  }

  const missing = [...new Set(requiredEntityTypes.filter((item) => !(item in resolved)))];

  // Generate questions for missing slots
  const questions = missing.map((slot) => {
    if (options.promptBySlot?.[slot] != null) {
      return options.promptBySlot[slot]!;
    }
    return defaultQuestionForSlot(slot);
  });

  return {
    missing,
    resolved,
    questions,
    attempt: 1,
    isComplete: missing.length === 0,
    nextExpectedSlot: missing[0] ?? null,
  };
}

/**
 * Refines slot resolution across multiple clarification rounds.
 * Each round can fill additional slots based on user responses.
 */
export function refineSlotResolution(
  currentState: SlotClarificationState,
  newEntities: readonly ExtractedEntity[],
  options: SlotResolutionOptions = {},
): SlotClarificationState {
  const maxRounds = options.maxRounds ?? 3;

  if (currentState.attempt >= maxRounds) {
    return {
      ...currentState,
      isComplete: true,
      nextExpectedSlot: null,
    };
  }

  // Merge new entities with previously resolved
  const resolved: Record<string, unknown> = {
    ...currentState.resolved,
  };
  for (const entity of newEntities) {
    if (!(entity.entityType in resolved)) {
      resolved[entity.entityType] = entity.normalized;
    }
  }

  const missing = [...new Set(currentState.missing.filter((slot) => !(slot in resolved)))];

  return {
    missing,
    resolved,
    questions: missing.map((slot) => options.promptBySlot?.[slot] ?? defaultQuestionForSlot(slot)),
    attempt: currentState.attempt + 1,
    isComplete: missing.length === 0,
    nextExpectedSlot: missing[0] ?? null,
  };
}

function defaultQuestionForSlot(slot: string): string {
  const prompts: Record<string, string> = {
    date: "请提供期望执行的日期或时间窗口。",
    environment: "请确认目标环境，例如 dev、staging 或 production。",
    channel: "请说明通知或回传结果的渠道。",
    money: "请提供预算或金额范围。",
  };
  return prompts[slot] ?? `请补充 ${slot} 相关信息。`;
}

