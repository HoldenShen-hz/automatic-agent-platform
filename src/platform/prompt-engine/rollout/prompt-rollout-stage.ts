/**
 * Execution stages in the order specified by §16.3 canonical pipeline.
 * canary(5%) → canary(20%) → stable → rolled_back
 *
 * Stage progression requires quality gates to pass at each stage.
 * rolled_back is a terminal state indicating rollback occurred.
 */
export const PROMPT_ROLLOUT_STAGES = [
  "canary(5%)",
  "canary(20%)",
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
  // §16.3: stable and rolled_back are terminal states — no further progression.
  // stable→rolled_back is NOT a valid forward transition; stable ends the pipeline.
  // rolled_back→stable or any backward transition is also invalid.
  if (stage === "stable" || stage === "rolled_back") {
    return null;
  }
  // Can only advance to next stage in forward direction
  if (currentIndex >= PROMPT_ROLLOUT_STAGES.length - 1) {
    return null;
  }
  return PROMPT_ROLLOUT_STAGES[currentIndex + 1] ?? null;
}

/**
 * Quality gate thresholds for automatic rollback per §16.3.
 * If error rate exceeds these thresholds at a canary stage, auto-rollback occurs.
 */
export const QUALITY_GATE_THRESHOLDS: Partial<Record<PromptRolloutStage, { readonly maxErrorRate: number; readonly minPassthrough: number } | null>> = {
  "canary(5%)": {
    maxErrorRate: 0.05,  // 5% error rate threshold for 5% canary
    minPassthrough: 0.95,
  },
  "canary(20%)": {
    maxErrorRate: 0.03,  // 3% error rate threshold for 20% canary (stricter)
    minPassthrough: 0.97,
  },
  stable: {
    maxErrorRate: 0.01,  // 1% error rate threshold for stable
    minPassthrough: 0.99,
  },
  rolled_back: null,
} as const;

/**
 * Checks if a stage passes its quality gate.
 * Returns true if the error rate is below the threshold.
 */
export function passesQualityGate(stage: PromptRolloutStage, errorRate: number): boolean {
  const threshold = QUALITY_GATE_THRESHOLDS[stage];
  if (threshold == null) {
    return true; // rolled_back has no threshold
  }
  return errorRate < (threshold?.maxErrorRate ?? 1);
}
