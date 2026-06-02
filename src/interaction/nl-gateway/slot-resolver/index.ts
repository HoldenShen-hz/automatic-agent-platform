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
  readonly escalationRequired: boolean;
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
  const ambiguousSlots = collectAmbiguousSlots(entities);
  for (const entity of entities) {
    if (ambiguousSlots.has(entity.entityType)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(resolved, entity.entityType)) {
      resolved[entity.entityType] = entity.normalized;
    }
  }
  return {
    missing: requiredEntityTypes.filter((item) => ambiguousSlots.has(item) || !Object.prototype.hasOwnProperty.call(resolved, item)),
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
  const ambiguousSlots = collectAmbiguousSlots(entities);

  // First pass: resolve from provided entities
  for (const entity of entities) {
    if (ambiguousSlots.has(entity.entityType)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(resolved, entity.entityType)) {
      resolved[entity.entityType] = entity.normalized;
    }
  }

  const missing = [...new Set(requiredEntityTypes.filter((item) => ambiguousSlots.has(item) || !Object.prototype.hasOwnProperty.call(resolved, item)))];

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
    escalationRequired: false,
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
  if (currentState.isComplete) {
    return currentState;
  }

  // Merge new entities with previously resolved
  const resolved: Record<string, unknown> = {
    ...currentState.resolved,
  };
  const ambiguousSlots = collectAmbiguousSlots(newEntities);
  for (const entity of newEntities) {
    if (ambiguousSlots.has(entity.entityType)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(resolved, entity.entityType)) {
      resolved[entity.entityType] = entity.normalized;
    }
  }

  const missing = [
    ...new Set(currentState.missing.filter((slot) => ambiguousSlots.has(slot) || !Object.prototype.hasOwnProperty.call(resolved, slot))),
  ];

  if (missing.length === 0) {
    return {
      missing,
      resolved,
      questions: [],
      attempt: Math.min(currentState.attempt + 1, maxRounds),
      isComplete: true,
      escalationRequired: false,
      nextExpectedSlot: null,
    };
  }

  if (currentState.attempt >= maxRounds) {
    return {
      missing,
      resolved,
      questions: [buildEscalationPrompt(missing)],
      attempt: currentState.attempt,
      isComplete: false,
      escalationRequired: true,
      nextExpectedSlot: null,
    };
  }

  return {
    missing,
    resolved,
    questions: missing.map((slot) => options.promptBySlot?.[slot] ?? defaultQuestionForSlot(slot)),
    attempt: currentState.attempt + 1,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: missing[0] ?? null,
  };
}

function defaultQuestionForSlot(slot: string): string {
  const safeSlot = /^[a-z][a-z0-9_-]{0,63}$/i.test(slot) ? slot : "目标字段";
  const prompts: Record<string, string> = {
    date: "请提供期望执行的日期或时间窗口。",
    environment: "请确认目标环境，例如 dev、staging 或 production。",
    channel: "请说明通知或回传结果的渠道。",
    money: "请提供预算或金额范围。",
  };
  return prompts[safeSlot] ?? `请补充 ${safeSlot} 相关信息。`;
}

function buildEscalationPrompt(missingSlots: readonly string[]): string {
  if (missingSlots.length === 0) {
    return "已达到最大澄清轮次，需要人工复核。";
  }
  return `已达到最大澄清轮次，仍缺少 ${missingSlots.join("、")}，请转人工确认。`;
}

function collectAmbiguousSlots(entities: readonly ExtractedEntity[]): Set<string> {
  const valuesByType = new Map<string, Set<string>>();
  for (const entity of entities) {
    const bucket = valuesByType.get(entity.entityType) ?? new Set<string>();
    bucket.add(String(entity.normalized));
    valuesByType.set(entity.entityType, bucket);
  }
  return new Set(
    [...valuesByType.entries()]
      .filter(([, values]) => values.size > 1)
      .map(([entityType]) => entityType),
  );
}
