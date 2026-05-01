/**
 * Prompt rollout stages per §16.3:
 * canary(5%) → canary(20%) → stable
 *
 * Removed extra stages: draft, review, staging, shadow, partial_25, partial_50, partial_75
 * These were in the legacy implementation but are not part of the canonical pipeline.
 * The canonical pipeline uses automatic quality gates at each canary stage.
 */
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
  if (currentIndex < 0) {
    return null;
  }
  // rolled_back and stable are terminal states — no further progression
  if (stage === "rolled_back" || stage === "stable") {
    return null;
  }
  return PROMPT_ROLLOUT_STAGES[currentIndex + 1] ?? null;
}

/**
 * Quality gate thresholds for automatic rollback per §16.3.
 * If error rate exceeds these thresholds at a canary stage, auto-rollback occurs.
 */
export const QUALITY_GATE_THRESHOLDS = {
  canary_5: {
    maxErrorRate: 0.05,  // 5% error rate threshold for 5% canary
    minPassthrough: 0.95,
  },
  canary_20: {
    maxErrorRate: 0.03,  // 3% error rate threshold for 20% canary (stricter)
    minPassthrough: 0.97,
  },
  stable: {
    maxErrorRate: 0.01,  // 1% error rate threshold for stable
    minPassthrough: 0.99,
  },
} as const;

/**
 * Checks if a stage passes its quality gate.
 * Returns true if the error rate is below the threshold.
 */
export function passesQualityGate(stage: PromptRolloutStage, errorRate: number): boolean {
  const threshold = QUALITY_GATE_THRESHOLDS[stage];
  if (!threshold) {
    return true; // rolled_back has no threshold
  }
  return errorRate < threshold.maxErrorRate;
}
