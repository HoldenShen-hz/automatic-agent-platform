export const PROMPT_ROLLOUT_STAGES = [
  "draft",
  "review",
  "staging",
  "shadow",
  "canary_5",
  "partial_25",
  "partial_50",
  "partial_75",
  "stable",
  "rolled_back",
] as const;

export type PromptRolloutStage = (typeof PROMPT_ROLLOUT_STAGES)[number];

export function isPromptRolloutStage(value: string): value is PromptRolloutStage {
  return (PROMPT_ROLLOUT_STAGES as readonly string[]).includes(value);
}

export function comparePromptRolloutStage(left: PromptRolloutStage, right: PromptRolloutStage): number {
  return PROMPT_ROLLOUT_STAGES.indexOf(left) - PROMPT_ROLLOUT_STAGES.indexOf(right);
}

export function nextPromptRolloutStage(stage: PromptRolloutStage): PromptRolloutStage | null {
  const currentIndex = PROMPT_ROLLOUT_STAGES.indexOf(stage);
  if (currentIndex < 0 || currentIndex >= PROMPT_ROLLOUT_STAGES.length - 1) {
    return null;
  }
  return PROMPT_ROLLOUT_STAGES[currentIndex + 1] ?? null;
}
