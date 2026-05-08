import type { ExtractedEntity } from "../index.js";

export interface SlotClarificationState {
  readonly missing: string[];
  readonly resolved: Record<string, unknown>;
  readonly questions: readonly string[];
  readonly attempt: number;
  readonly isComplete: boolean;
  readonly nextExpectedSlot: string | null;
}

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

function defaultQuestionForSlot(slot: string): string {
  const prompts: Record<string, string> = {
    date: "请提供期望执行的日期或时间窗口。",
    environment: "请确认目标环境，例如 dev、staging 或 production。",
    channel: "请说明通知或回传结果的渠道。",
    money: "请提供预算或金额范围。",
  };
  return prompts[slot] ?? `请补充 ${slot} 相关信息。`;
}

export function buildSlotClarificationState(
  entities: readonly ExtractedEntity[],
  requiredEntityTypes: readonly string[],
  options: {
    readonly previousResolved?: Readonly<Record<string, unknown>>;
    readonly promptBySlot?: Readonly<Record<string, string>>;
    readonly attempt?: number;
  } = {},
): SlotClarificationState {
  const base = resolveRequiredSlots(entities, requiredEntityTypes);
  const resolved: Record<string, unknown> = {
    ...(options.previousResolved ?? {}),
    ...base.resolved,
  };
  const missing = [...new Set(requiredEntityTypes.filter((item) => !(item in resolved)))];
  return {
    missing,
    resolved,
    questions: missing.map((slot) => options.promptBySlot?.[slot] ?? defaultQuestionForSlot(slot)),
    attempt: Math.max(1, options.attempt ?? 1),
    isComplete: missing.length === 0,
    nextExpectedSlot: missing[0] ?? null,
  };
}
