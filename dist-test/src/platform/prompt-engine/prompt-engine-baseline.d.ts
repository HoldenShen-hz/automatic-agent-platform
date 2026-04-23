export type PromptEngineCapabilityId = "registry" | "renderer" | "rollout" | "eval" | "conversation-template";
export interface PromptEngineCapabilityBaseline {
    readonly capabilityId: PromptEngineCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const PROMPT_ENGINE_CAPABILITY_BASELINES: readonly PromptEngineCapabilityBaseline[];
export declare function listPromptEngineCapabilityBaselines(): readonly PromptEngineCapabilityBaseline[];
export declare function resolvePromptEngineCapabilityBaseline(capabilityId: PromptEngineCapabilityId): PromptEngineCapabilityBaseline;
