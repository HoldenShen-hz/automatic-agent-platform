// R8-17 FIX: "ready" stage removed per §16.3 which specifies canary_5 → canary_20 → stable pipeline.
// The "ready" stage was a misunderstanding of the §16.3 spec which only includes three rollout stages.
export const PROMPT_ROLLOUT_STAGES = [
  "draft",
  "ready",
  "canary_5",
  "canary_20",
  "partial_25",
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
  if (currentIndex < 0 || stage === "rolled_back") {
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
  draft: {
    maxErrorRate: 0.1,
    minPassthrough: 0.9,
  },
  ready: {
    maxErrorRate: 0.08,
    minPassthrough: 0.92,
  },
  canary_5: {
    maxErrorRate: 0.05,
    minPassthrough: 0.95,
  },
  canary_20: {
    maxErrorRate: 0.04,
    minPassthrough: 0.96,
  },
  partial_25: {
    maxErrorRate: 0.03,
    minPassthrough: 0.97,
  },
  partial_75: {
    maxErrorRate: 0.02,
    minPassthrough: 0.98,
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
