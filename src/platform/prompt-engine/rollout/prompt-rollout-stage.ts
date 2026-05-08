export const PROMPT_ROLLOUT_STAGES = [
  "canary_5",
  "canary_20",
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
  if (currentIndex < 0 || stage === "stable" || stage === "rolled_back") {
    return null;
  }
  if (currentIndex >= PROMPT_ROLLOUT_STAGES.length - 1) {
    return null;
  }
  return PROMPT_ROLLOUT_STAGES[currentIndex + 1] ?? null;
}

export const QUALITY_GATE_THRESHOLDS: Record<Exclude<PromptRolloutStage, "rolled_back">, {
  maxErrorRate: number;
  minPassthrough: number;
}> = {
  canary_5: {
    maxErrorRate: 0.05,
    minPassthrough: 0.95,
  },
  canary_20: {
    maxErrorRate: 0.03,
    minPassthrough: 0.97,
  },
  stable: {
    maxErrorRate: 0.01,
    minPassthrough: 0.99,
  },
};

export function passesQualityGate(stage: PromptRolloutStage, errorRate: number): boolean {
  const threshold = QUALITY_GATE_THRESHOLDS[stage as Exclude<PromptRolloutStage, "rolled_back">];
  if (threshold == null) {
    return true;
  }
  return errorRate < threshold.maxErrorRate;
}
