export declare const PROMPT_ROLLOUT_STAGES: readonly ["draft", "review", "staging", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable", "rolled_back"];
export type PromptRolloutStage = (typeof PROMPT_ROLLOUT_STAGES)[number];
export declare function isPromptRolloutStage(value: string): value is PromptRolloutStage;
export declare function comparePromptRolloutStage(left: PromptRolloutStage, right: PromptRolloutStage): number;
export declare function nextPromptRolloutStage(stage: PromptRolloutStage): PromptRolloutStage | null;
