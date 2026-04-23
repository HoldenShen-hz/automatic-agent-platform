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
];
export function isPromptRolloutStage(value) {
    return PROMPT_ROLLOUT_STAGES.includes(value);
}
export function comparePromptRolloutStage(left, right) {
    return PROMPT_ROLLOUT_STAGES.indexOf(left) - PROMPT_ROLLOUT_STAGES.indexOf(right);
}
export function nextPromptRolloutStage(stage) {
    const currentIndex = PROMPT_ROLLOUT_STAGES.indexOf(stage);
    if (currentIndex < 0 || currentIndex >= PROMPT_ROLLOUT_STAGES.length - 1) {
        return null;
    }
    return PROMPT_ROLLOUT_STAGES[currentIndex + 1] ?? null;
}
//# sourceMappingURL=prompt-rollout-stage.js.map