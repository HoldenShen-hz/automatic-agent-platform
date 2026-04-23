export type OrchestrationCapabilityId = "agent-delegation" | "escalation" | "harness" | "hitl" | "oapeflir" | "planner" | "replan" | "routing";
export interface OrchestrationCapabilityBaseline {
    readonly capabilityId: OrchestrationCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const ORCHESTRATION_CAPABILITY_BASELINES: readonly OrchestrationCapabilityBaseline[];
export declare function listOrchestrationCapabilityBaselines(): readonly OrchestrationCapabilityBaseline[];
export declare function resolveOrchestrationCapabilityBaseline(capabilityId: OrchestrationCapabilityId): OrchestrationCapabilityBaseline;
