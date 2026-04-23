export type InteractionCapabilityId = "nl-gateway" | "goal-decomposer" | "proactive-agent" | "autonomy" | "dashboard" | "ux";
export interface InteractionCapabilityBaseline {
    readonly capabilityId: InteractionCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly architectureSections: readonly string[];
    readonly baselineServices: readonly string[];
}
export declare const INTERACTION_CAPABILITY_BASELINES: readonly InteractionCapabilityBaseline[];
export declare function listInteractionCapabilityBaselines(): readonly InteractionCapabilityBaseline[];
export declare function resolveInteractionCapabilityBaseline(capabilityId: InteractionCapabilityId): InteractionCapabilityBaseline;
